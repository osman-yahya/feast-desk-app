import uWS from 'uWebSockets.js'
import { deriveAccessKey, createToken, consumeToken, startTokenCleanup } from './lib/auth.js'
import {
  registerTunnel, getTunnel, disconnectTunnel,
  reconnectTunnel, removeTunnel, isInGrace,
  handlePong, getStats,
} from './lib/tunnel-manager.js'
import { handlePosFrame } from './lib/multiplexer.js'
import {
  handleHttpProxy, handleWsUpgrade, handleWsMessage,
  handleWsClose, registerEndUserWs, parseTokenUrl,
} from './lib/proxy.js'
import { checkRate, startCleanup as startRateCleanup } from './lib/rate-limiter.js'
import { metrics, getHealthPayload } from './lib/metrics.js'

const PORT = parseInt(process.env.PORT || '4000', 10)
const BIND = process.env.BIND || '127.0.0.1'
const MAX_TUNNELS = parseInt(process.env.MAX_TUNNELS || '10000', 10)
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'tunnel.feast.tr'

// ---- Helpers ----

function jsonResponse(res, status, body) {
  res.cork(() => {
    res.writeStatus(status)
    res.writeHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(body))
  })
}

function readBody(res) {
  return new Promise((resolve) => {
    const chunks = []
    res.onData((chunk, isLast) => {
      chunks.push(Buffer.from(chunk))
      if (isLast) resolve(Buffer.concat(chunks).toString())
    })
  })
}

function getClientIp(res, req) {
  // Cloudflare sets CF-Connecting-IP
  return req.getHeader('cf-connecting-ip') ||
         req.getHeader('x-forwarded-for')?.split(',')[0]?.trim() ||
         Buffer.from(res.getRemoteAddressAsText()).toString()
}

// ---- App ----

const app = uWS.App()

// ---- Health endpoint ----

app.get('/health', (res) => {
  const stats = getStats()
  jsonResponse(res, '200 OK', getHealthPayload(stats))
})

// ---- Registration endpoint ----

app.post('/api/register', (res, req) => {
  let aborted = false
  res.onAborted(() => { aborted = true })

  const ip = getClientIp(res, req)

  // Rate limit: 5 per second per IP
  if (!checkRate(ip, 5, 1000)) {
    if (!aborted) jsonResponse(res, '429 Too Many Requests', { message: 'Rate limited' })
    return
  }

  // uWS requires reading body asynchronously
  readBody(res).then((raw) => {
    if (aborted) return

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      if (!aborted) jsonResponse(res, '400 Bad Request', { message: 'Invalid JSON' })
      return
    }

    const { restaurant_id, secret } = body || {}
    if (!restaurant_id || !secret) {
      if (!aborted) jsonResponse(res, '400 Bad Request', { message: 'restaurant_id and secret required' })
      return
    }

    // Check tunnel capacity
    const stats = getStats()
    if (stats.active >= MAX_TUNNELS) {
      if (!aborted) jsonResponse(res, '503 Service Unavailable', { message: 'Server at capacity' })
      return
    }

    // Derive deterministic access key: SHA-256(id:secret) → first 16 hex chars
    const accessKey = deriveAccessKey(restaurant_id, secret)
    const token = createToken(restaurant_id, accessKey)

    if (!aborted) {
      jsonResponse(res, '200 OK', {
        success: true,
        token,
        access_key: accessKey,
        ws_url: `wss://${TUNNEL_DOMAIN}/tunnel`,
      })
    }
  })
})

// ---- POS Tunnel WebSocket ----

app.ws('/tunnel', {
  maxPayloadLength: 1024 * 1024,   // 1MB max frame
  idleTimeout: 120,                 // 2 min idle (keepalive runs every 25s)

  upgrade: (res, req, context) => {
    res.upgrade(
      { ip: getClientIp(res, req) },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context,
    )
  },

  open: (ws) => {
    // POS must send auth frame within 10s
    ws.authTimer = setTimeout(() => {
      try { ws.close() } catch {}
    }, 10_000)
    ws.authenticated = false
    ws.tunnelToken = null
  },

  message: (ws, message) => {
    let frame
    try {
      frame = JSON.parse(Buffer.from(message).toString())
    } catch {
      return
    }

    // First message must be auth
    if (!ws.authenticated) {
      if (frame.t !== 'auth' || !frame.token) {
        try { ws.close() } catch {}
        return
      }

      clearTimeout(ws.authTimer)

      // Check if this is a reconnection during grace period
      if (isInGrace(frame.token)) {
        const tunnel = reconnectTunnel(frame.token, ws)
        if (tunnel) {
          ws.authenticated = true
          ws.tunnelToken = frame.token
          ws.send(JSON.stringify({
            t: 'auth_ok',
            access_url: `https://${TUNNEL_DOMAIN}/t/${tunnel.accessKey}/`,
          }))
          return
        }
      }

      // Normal token consumption
      const result = consumeToken(frame.token)
      if (!result.valid) {
        ws.send(JSON.stringify({ t: 'auth_fail', reason: result.reason }))
        try { ws.close() } catch {}
        return
      }

      registerTunnel(frame.token, result.restaurantId, result.accessKey, ws)
      ws.authenticated = true
      ws.tunnelToken = frame.token

      ws.send(JSON.stringify({
        t: 'auth_ok',
        access_url: `https://${TUNNEL_DOMAIN}/t/${result.accessKey}/`,
      }))
      return
    }

    // Authenticated: handle POS frames
    if (frame.t === 'pong') {
      handlePong(ws.tunnelToken)
      return
    }

    const tunnel = getTunnel(ws.tunnelToken)
    if (tunnel) {
      handlePosFrame(tunnel, frame)
    }
  },

  close: (ws) => {
    clearTimeout(ws.authTimer)
    if (ws.tunnelToken) {
      disconnectTunnel(ws.tunnelToken)
    }
  },
})

// ---- End-User WebSocket (waiter/kitchen) ----

app.ws('/t/:token/ws', {
  maxPayloadLength: 64 * 1024,  // 64KB max
  idleTimeout: 120,

  upgrade: (res, req, context) => {
    const token = req.getParameter(0)
    const query = req.getQuery()
    const path = `/ws${query ? '?' + query : ''}`
    const headers = {}
    req.forEach((key, value) => { headers[key] = value })

    const ctx = handleWsUpgrade(token, path, headers)
    if (!ctx) {
      res.writeStatus('502 Bad Gateway')
      res.end('Tunnel not connected')
      return
    }

    res.upgrade(
      { tunnelToken: token, streamId: ctx.streamId, tunnel: ctx.tunnel },
      req.getHeader('sec-websocket-key'),
      req.getHeader('sec-websocket-protocol'),
      req.getHeader('sec-websocket-extensions'),
      context,
    )
  },

  open: (ws) => {
    registerEndUserWs(ws.tunnel, ws.streamId, ws)
    metrics.endUsersWs++
  },

  message: (ws, message) => {
    const data = Buffer.from(message).toString()
    handleWsMessage(ws.tunnel, ws.streamId, data)
  },

  close: (ws, code) => {
    handleWsClose(ws.tunnel, ws.streamId, code)
    metrics.endUsersWs--
  },
})

// ---- End-User HTTP Proxy (all methods) ----

app.any('/t/*', (res, req) => {
  metrics.httpRequestsTotal++
  handleHttpProxy(res, req)
})

// ---- Catch-all ----

app.any('/*', (res) => {
  jsonResponse(res, '403 Forbidden', { message: 'Access denied' })
})

// ---- Start ----

startTokenCleanup()
startRateCleanup()

app.listen(BIND, PORT, (listenSocket) => {
  if (listenSocket) {
    console.log(`feast-tunnel listening on ${BIND}:${PORT}`)
    console.log(`Max tunnels: ${MAX_TUNNELS}`)
  } else {
    console.error(`Failed to listen on ${BIND}:${PORT}`)
    process.exit(1)
  }
})
