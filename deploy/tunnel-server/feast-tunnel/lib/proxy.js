import { getTunnelByAccessKey } from './tunnel-manager.js'
import { relayHttpRequest, relayWsOpen, relayWsMessage, relayWsClose } from './multiplexer.js'

const ACCESS_KEY_PATTERN = /^\/t\/([a-f0-9]{16})(\/.*)?$/   // /t/{accessKey}/rest/of/path

/**
 * Extract token and inner path from a request URL.
 * Returns { token, innerPath } or null if the URL doesn't match.
 *
 * Example: /t/ft_abc123/api/menu → { token: 'ft_abc123', innerPath: '/api/menu' }
 * Example: /t/ft_abc123/         → { token: 'ft_abc123', innerPath: '/' }
 * Example: /t/ft_abc123          → { token: 'ft_abc123', innerPath: '/' }
 */
export function parseTokenUrl(url) {
  // Strip query string for pattern matching
  const qIdx = url.indexOf('?')
  const pathname = qIdx >= 0 ? url.slice(0, qIdx) : url
  const query = qIdx >= 0 ? url.slice(qIdx) : ''

  const match = pathname.match(ACCESS_KEY_PATTERN)
  if (!match) return null

  const token = match[1]
  let innerPath = match[2] || '/'
  // Append query string back
  if (query) innerPath += query

  return { token, innerPath }
}

/**
 * Handle an end-user HTTP request by relaying it through the tunnel.
 * Called from server.js for GET/POST/PATCH/DELETE on /t/{token}/*.
 *
 * @param {object} res - uWebSockets.js HttpResponse
 * @param {object} req - uWebSockets.js HttpRequest
 */
export function handleHttpProxy(res, req) {
  const url = req.getUrl() + (req.getQuery() ? '?' + req.getQuery() : '')
  const parsed = parseTokenUrl(url)

  if (!parsed) {
    res.writeStatus('400 Bad Request')
    res.end(JSON.stringify({ message: 'Invalid tunnel URL' }))
    return
  }

  const tunnel = getTunnelByAccessKey(parsed.token)
  if (!tunnel || !tunnel.alive) {
    res.writeStatus('502 Bad Gateway')
    res.end(JSON.stringify({ message: 'Tunnel not connected' }))
    return
  }

  const method = req.getMethod().toUpperCase()
  const headers = {}
  req.forEach((key, value) => { headers[key] = value })

  // uWS requires us to handle the response asynchronously with onAborted
  let aborted = false
  res.onAborted(() => { aborted = true })

  // Read request body (for POST/PATCH/PUT)
  let bodyChunks = []
  if (method !== 'GET' && method !== 'HEAD') {
    res.onData((chunk, isLast) => {
      bodyChunks.push(Buffer.from(chunk))
      if (isLast) {
        const body = Buffer.concat(bodyChunks).toString()
        doRelay(tunnel, parsed, method, headers, body, res, aborted)
      }
    })
  } else {
    doRelay(tunnel, parsed, method, headers, null, res, aborted)
  }
}

async function doRelay(tunnel, parsed, method, headers, body, res, aborted) {
  try {
    const result = await relayHttpRequest(tunnel, method, parsed.innerPath, headers, body)

    if (aborted) return

    res.cork(() => {
      res.writeStatus(String(result.status))
      if (result.headers) {
        for (const [key, val] of Object.entries(result.headers)) {
          const lk = key.toLowerCase()
          // Skip hop-by-hop headers
          if (lk === 'transfer-encoding' || lk === 'connection') continue
          res.writeHeader(key, String(val))
        }
      }
      res.end(result.body || '')
    })
  } catch (err) {
    if (aborted) return
    res.cork(() => {
      if (err === 'backpressure') {
        res.writeStatus('503 Service Unavailable')
        res.end(JSON.stringify({ message: 'POS is overloaded, try again' }))
      } else if (err === 'timeout') {
        res.writeStatus('504 Gateway Timeout')
        res.end(JSON.stringify({ message: 'POS did not respond in time' }))
      } else {
        res.writeStatus('502 Bad Gateway')
        res.end(JSON.stringify({ message: 'Tunnel relay failed' }))
      }
    })
  }
}

/**
 * Handle end-user WebSocket upgrade by relaying through the tunnel.
 * Called from the uWS WebSocket behavior for /t/{token}/ws.
 *
 * @returns {{ tunnel, streamId }} context for the WS session, or null to reject.
 */
export function handleWsUpgrade(accessKey, path, headers) {
  const tunnel = getTunnelByAccessKey(accessKey)
  if (!tunnel || !tunnel.alive) return null

  const streamId = relayWsOpen(tunnel, path, headers)
  if (streamId === null) return null // backpressure

  return { tunnel, streamId }
}

/**
 * Handle an end-user WebSocket message — relay to POS.
 */
export function handleWsMessage(tunnel, streamId, data) {
  relayWsMessage(tunnel, streamId, data)
}

/**
 * Handle end-user WebSocket close — relay to POS.
 */
export function handleWsClose(tunnel, streamId, code) {
  relayWsClose(tunnel, streamId, code)
}

/**
 * Register an end-user WebSocket in the tunnel's activeWs map.
 * Called after ws_accept from POS, but we register eagerly at open
 * so that ws_msg frames from POS can be forwarded immediately.
 */
export function registerEndUserWs(tunnel, streamId, endUserWs) {
  tunnel.activeWs.set(streamId, endUserWs)
}
