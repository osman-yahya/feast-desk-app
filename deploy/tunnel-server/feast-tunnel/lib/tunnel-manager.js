import { metrics } from './metrics.js'

const PING_INTERVAL = 25_000     // send ping every 25s
const PONG_TIMEOUT = 10_000      // pong must arrive within 10s
const MAX_MISSED_PONGS = 3       // 3 missed pongs = dead
const GRACE_PERIOD = 60_000      // 60s grace on disconnect for reconnection

/**
 * Represents a single POS tunnel connection.
 */
class TunnelConnection {
  constructor(token, restaurantId, accessKey, ws) {
    this.token = token
    this.restaurantId = restaurantId
    this.accessKey = accessKey
    this.ws = ws
    this.missedPongs = 0
    this.nextStreamId = 1
    this.pendingHttp = new Map()     // streamId → { res, timer }
    this.activeWs = new Map()        // streamId → endUserWs
    this.graceTimer = null
    this.pingTimer = null
    this.alive = true
    this.createdAt = Date.now()
  }

  allocStreamId() {
    return this.nextStreamId++
  }
}

// token → TunnelConnection
const tunnels = new Map()
// restaurantId → token (for kicking duplicate connections)
const restaurantToToken = new Map()
// accessKey → token (for routing end-user requests by deterministic key)
const accessKeyToToken = new Map()
// token → TunnelConnection (grace period: tunnel disconnected but may reconnect)
const graceTunnels = new Map()

/**
 * Register a new tunnel after WebSocket auth succeeds.
 * If this restaurant already has an active tunnel, kick the old one.
 */
export function registerTunnel(token, restaurantId, accessKey, ws) {
  // Kick existing tunnel for same restaurant
  const existingToken = restaurantToToken.get(restaurantId)
  if (existingToken) {
    removeTunnel(existingToken, 'replaced')
  }

  // Also clear any grace entry for this restaurant
  for (const [gToken, gTunnel] of graceTunnels) {
    if (gTunnel.restaurantId === restaurantId) {
      clearTimeout(gTunnel.graceTimer)
      graceTunnels.delete(gToken)
    }
  }

  const tunnel = new TunnelConnection(token, restaurantId, accessKey, ws)
  tunnels.set(token, tunnel)
  restaurantToToken.set(restaurantId, token)
  accessKeyToToken.set(accessKey, token)
  metrics.tunnelsActive = tunnels.size

  startPing(tunnel)
  return tunnel
}

/**
 * Get an active tunnel by token (for proxying end-user requests).
 */
export function getTunnel(token) {
  return tunnels.get(token) || null
}

/**
 * Get an active tunnel by its deterministic access key (for end-user routing).
 */
export function getTunnelByAccessKey(accessKey) {
  const token = accessKeyToToken.get(accessKey)
  return token ? tunnels.get(token) || null : null
}

/**
 * Called when the POS tunnel WebSocket disconnects.
 * Starts a grace period — if POS reconnects with same token within 60s, tunnel resumes.
 */
export function disconnectTunnel(token) {
  const tunnel = tunnels.get(token)
  if (!tunnel) return

  tunnel.alive = false
  stopPing(tunnel)

  // Move to grace
  tunnels.delete(token)
  restaurantToToken.delete(tunnel.restaurantId)
  accessKeyToToken.delete(tunnel.accessKey)
  metrics.tunnelsActive = tunnels.size

  tunnel.graceTimer = setTimeout(() => {
    // Grace expired — fully remove
    cleanupTunnel(tunnel)
    graceTunnels.delete(token)
  }, GRACE_PERIOD)

  graceTunnels.set(token, tunnel)
}

/**
 * Reconnect an existing tunnel during grace period.
 * Returns the tunnel if grace token is valid, null otherwise.
 */
export function reconnectTunnel(token, ws) {
  const tunnel = graceTunnels.get(token)
  if (!tunnel) return null

  clearTimeout(tunnel.graceTimer)
  graceTunnels.delete(token)

  // Revive
  tunnel.ws = ws
  tunnel.alive = true
  tunnel.missedPongs = 0
  tunnels.set(token, tunnel)
  restaurantToToken.set(tunnel.restaurantId, token)
  accessKeyToToken.set(tunnel.accessKey, token)
  metrics.tunnelsActive = tunnels.size

  startPing(tunnel)
  return tunnel
}

/**
 * Forcefully remove a tunnel (kicked, or fatal error).
 */
export function removeTunnel(token, reason = 'removed') {
  const tunnel = tunnels.get(token)
  if (!tunnel) {
    // Check grace
    const graceTunnel = graceTunnels.get(token)
    if (graceTunnel) {
      clearTimeout(graceTunnel.graceTimer)
      cleanupTunnel(graceTunnel)
      graceTunnels.delete(token)
    }
    return
  }

  stopPing(tunnel)
  tunnels.delete(token)
  restaurantToToken.delete(tunnel.restaurantId)
  accessKeyToToken.delete(tunnel.accessKey)
  metrics.tunnelsActive = tunnels.size

  cleanupTunnel(tunnel)

  // Close the POS WebSocket
  try {
    tunnel.ws.close()
  } catch {}
}

/**
 * Check if a token is in grace period (for reconnection).
 */
export function isInGrace(token) {
  return graceTunnels.has(token)
}

/**
 * Get tunnel stats.
 */
export function getStats() {
  let totalPendingHttp = 0
  let totalActiveWs = 0
  for (const tunnel of tunnels.values()) {
    totalPendingHttp += tunnel.pendingHttp.size
    totalActiveWs += tunnel.activeWs.size
  }
  return {
    active: tunnels.size,
    grace: graceTunnels.size,
    pendingHttp: totalPendingHttp,
    activeWs: totalActiveWs,
  }
}

// ---- Internal helpers ----

function startPing(tunnel) {
  tunnel.pingTimer = setInterval(() => {
    if (!tunnel.alive) return

    try {
      tunnel.ws.send(JSON.stringify({ t: 'ping' }))
    } catch {
      tunnel.missedPongs = MAX_MISSED_PONGS
    }

    // Check if previous pong arrived
    tunnel.missedPongs++
    if (tunnel.missedPongs > MAX_MISSED_PONGS) {
      disconnectTunnel(tunnel.token)
    }
  }, PING_INTERVAL)
  tunnel.pingTimer.unref?.()
}

function stopPing(tunnel) {
  if (tunnel.pingTimer) {
    clearInterval(tunnel.pingTimer)
    tunnel.pingTimer = null
  }
}

/**
 * Handle pong from POS — reset missed counter.
 */
export function handlePong(token) {
  const tunnel = tunnels.get(token)
  if (tunnel) tunnel.missedPongs = 0
}

function cleanupTunnel(tunnel) {
  // Close all proxied end-user WebSockets
  for (const [, endUserWs] of tunnel.activeWs) {
    try { endUserWs.close() } catch {}
  }
  tunnel.activeWs.clear()

  // Reject all pending HTTP requests
  for (const [, pending] of tunnel.pendingHttp) {
    clearTimeout(pending.timer)
    try {
      pending.reject?.('tunnel_closed')
    } catch {}
  }
  tunnel.pendingHttp.clear()
}
