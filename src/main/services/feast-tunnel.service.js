import WebSocket from 'ws'
import http from 'http'

const TUNNEL_API = 'https://tunnel.feast.tr'
const RECONNECT_DELAY = 3000
const MAX_RECONNECT_ATTEMPTS = 10

let tunnelWs = null
let tunnelAccessUrl = null
let tunnelAccessKey = null
let tunnelToken = null
let localPort = null
let reconnectAttempts = 0
let reconnectTimer = null
let stopping = false

// Map of streamId → local WS connection (for end-user WS proxying)
const localWsStreams = new Map()

/**
 * Start the feast tunnel client.
 * Registers with the tunnel server, opens a WebSocket, and proxies requests to the local Express server.
 */
export async function startFeastTunnel(port, restaurantId, secret) {
  if (tunnelWs) return { success: false, error: 'Feast tunnel already running' }

  localPort = port
  stopping = false
  reconnectAttempts = 0

  // Step 1: Register with tunnel server
  const regResult = await register(restaurantId, secret)
  if (!regResult.success) return regResult

  tunnelToken = regResult.token
  tunnelAccessKey = regResult.access_key

  // Step 2: Open tunnel WebSocket
  return new Promise((resolve) => {
    connectWebSocket((err) => {
      if (err) {
        resolve({ success: false, error: err })
      } else {
        resolve({
          success: true,
          tunnelUrl: tunnelAccessUrl,
          accessKey: tunnelAccessKey
        })
      }
    })
  })
}

/**
 * Stop the feast tunnel client.
 */
export function stopFeastTunnel() {
  stopping = true
  clearTimeout(reconnectTimer)
  reconnectTimer = null

  // Close all local WS streams
  for (const [, ws] of localWsStreams) {
    try { ws.close() } catch {}
  }
  localWsStreams.clear()

  if (tunnelWs) {
    try { tunnelWs.close() } catch {}
    tunnelWs = null
  }

  tunnelAccessUrl = null
  tunnelAccessKey = null
  tunnelToken = null
  reconnectAttempts = 0
}

/**
 * Get current feast tunnel status.
 */
export function getFeastTunnelStatus() {
  return {
    connected: tunnelWs !== null && tunnelWs.readyState === WebSocket.OPEN,
    tunnelUrl: tunnelAccessUrl,
    accessKey: tunnelAccessKey
  }
}

// ---- Internal ----

async function register(restaurantId, secret) {
  try {
    const res = await fetch(`${TUNNEL_API}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurant_id: restaurantId, secret })
    })
    const data = await res.json()
    if (!data.success) {
      return { success: false, error: data.message || 'Registration failed' }
    }
    return { success: true, token: data.token, access_key: data.access_key, ws_url: data.ws_url }
  } catch (err) {
    return { success: false, error: `Tunnel registration failed: ${err.message}` }
  }
}

function connectWebSocket(onFirstConnect) {
  const wsUrl = `${TUNNEL_API.replace('https', 'wss').replace('http', 'ws')}/tunnel`
  let firstConnectDone = false

  tunnelWs = new WebSocket(wsUrl)

  tunnelWs.on('open', () => {
    // Send auth frame
    tunnelWs.send(JSON.stringify({ t: 'auth', token: tunnelToken }))
  })

  tunnelWs.on('message', (raw) => {
    let frame
    try {
      frame = JSON.parse(raw.toString())
    } catch {
      return
    }

    switch (frame.t) {
      case 'auth_ok':
        tunnelAccessUrl = frame.access_url
        reconnectAttempts = 0
        if (!firstConnectDone) {
          firstConnectDone = true
          onFirstConnect(null)
        }
        break

      case 'auth_fail':
        if (!firstConnectDone) {
          firstConnectDone = true
          onFirstConnect(frame.reason || 'Auth failed')
        }
        break

      case 'ping':
        if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
          tunnelWs.send(JSON.stringify({ t: 'pong' }))
        }
        break

      case 'http_req':
        handleHttpReq(frame)
        break

      case 'ws_open':
        handleWsOpen(frame)
        break

      case 'ws_msg':
        handleWsMsg(frame)
        break

      case 'ws_close':
        handleWsClose(frame)
        break
    }
  })

  tunnelWs.on('close', () => {
    tunnelWs = null
    if (!firstConnectDone) {
      firstConnectDone = true
      onFirstConnect('WebSocket closed before auth')
      return
    }
    if (!stopping) {
      scheduleReconnect()
    }
  })

  tunnelWs.on('error', (err) => {
    if (!firstConnectDone) {
      firstConnectDone = true
      onFirstConnect(`WebSocket error: ${err.message}`)
    }
  })
}

function scheduleReconnect() {
  if (stopping || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return

  reconnectAttempts++
  const delay = RECONNECT_DELAY * Math.min(reconnectAttempts, 5)

  reconnectTimer = setTimeout(async () => {
    if (stopping) return
    // Re-register to get a fresh token (old token is consumed)
    // We need restaurantId and secret — stored in the closure via the settings
    // For reconnect, we re-use the existing accessKey info
    connectWebSocket(() => {})
  }, delay)
}

/**
 * Proxy HTTP request from tunnel server to local Express server.
 */
function handleHttpReq(frame) {
  const options = {
    hostname: '127.0.0.1',
    port: localPort,
    path: frame.path || '/',
    method: frame.method || 'GET',
    headers: frame.headers || {}
  }

  const req = http.request(options, (res) => {
    let body = ''
    res.setEncoding('utf8')
    res.on('data', (chunk) => { body += chunk })
    res.on('end', () => {
      sendFrame({
        t: 'http_res',
        s: frame.s,
        status: res.statusCode,
        headers: Object.fromEntries(
          Object.entries(res.headers).filter(([, v]) => typeof v === 'string')
        ),
        body
      })
    })
  })

  req.on('error', () => {
    sendFrame({
      t: 'http_res',
      s: frame.s,
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Local server unavailable' })
    })
  })

  if (frame.body) req.write(frame.body)
  req.end()
}

/**
 * Proxy WS open from tunnel server — create a local WS connection.
 */
function handleWsOpen(frame) {
  const wsUrl = `ws://127.0.0.1:${localPort}/ws${frame.path?.includes('?') ? frame.path.slice(frame.path.indexOf('?')) : ''}`

  const localWs = new WebSocket(wsUrl)

  localWs.on('open', () => {
    localWsStreams.set(frame.s, localWs)
    sendFrame({ t: 'ws_accept', s: frame.s })
  })

  localWs.on('message', (data) => {
    sendFrame({ t: 'ws_msg', s: frame.s, data: data.toString() })
  })

  localWs.on('close', (code) => {
    localWsStreams.delete(frame.s)
    sendFrame({ t: 'ws_close', s: frame.s, code })
  })

  localWs.on('error', () => {
    localWsStreams.delete(frame.s)
    sendFrame({ t: 'ws_close', s: frame.s, code: 1011 })
  })
}

/**
 * Proxy WS message from tunnel server to local WS connection.
 */
function handleWsMsg(frame) {
  const localWs = localWsStreams.get(frame.s)
  if (localWs && localWs.readyState === WebSocket.OPEN) {
    localWs.send(frame.data)
  }
}

/**
 * Proxy WS close from tunnel server — close local WS connection.
 */
function handleWsClose(frame) {
  const localWs = localWsStreams.get(frame.s)
  if (localWs) {
    try { localWs.close(frame.code || 1000) } catch {}
    localWsStreams.delete(frame.s)
  }
}

function sendFrame(frame) {
  if (tunnelWs && tunnelWs.readyState === WebSocket.OPEN) {
    tunnelWs.send(JSON.stringify(frame))
  }
}
