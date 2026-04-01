/**
 * Multiplexer: sends/receives JSON frames over a tunnel WebSocket.
 *
 * Frame types (server → POS):
 *   http_req  { t, s, method, path, headers, body }
 *   ws_open   { t, s, path, headers }
 *   ws_msg    { t, s, data }
 *   ws_close  { t, s, code }
 *   ping      { t }
 *
 * Frame types (POS → server):
 *   http_res  { t, s, status, headers, body }
 *   ws_accept { t, s }
 *   ws_msg    { t, s, data }
 *   ws_close  { t, s, code }
 *   pong      { t }
 */

const MAX_PENDING_HTTP = 50
const MAX_ACTIVE_WS = 20
const HTTP_TIMEOUT = 30_000   // 30s timeout for HTTP relay

/**
 * Send an HTTP request through the tunnel to the POS.
 * Returns a Promise that resolves with { status, headers, body }.
 */
export function relayHttpRequest(tunnel, method, path, headers, body) {
  if (tunnel.pendingHttp.size >= MAX_PENDING_HTTP) {
    return Promise.reject('backpressure')
  }

  const streamId = tunnel.allocStreamId()

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      tunnel.pendingHttp.delete(streamId)
      reject('timeout')
    }, HTTP_TIMEOUT)

    tunnel.pendingHttp.set(streamId, { resolve, reject, timer })

    try {
      tunnel.ws.send(JSON.stringify({
        t: 'http_req',
        s: streamId,
        method,
        path,
        headers: filterHeaders(headers),
        body: body || null,
      }))
    } catch (err) {
      clearTimeout(timer)
      tunnel.pendingHttp.delete(streamId)
      reject('send_failed')
    }
  })
}

/**
 * Open a WebSocket stream through the tunnel to the POS.
 * Returns a streamId that can be used for ws_msg and ws_close.
 */
export function relayWsOpen(tunnel, path, headers) {
  if (tunnel.activeWs.size >= MAX_ACTIVE_WS) {
    return null // backpressure
  }

  const streamId = tunnel.allocStreamId()

  try {
    tunnel.ws.send(JSON.stringify({
      t: 'ws_open',
      s: streamId,
      path,
      headers: filterHeaders(headers),
    }))
  } catch {
    return null
  }

  return streamId
}

/**
 * Send a WebSocket message through the tunnel.
 */
export function relayWsMessage(tunnel, streamId, data) {
  try {
    tunnel.ws.send(JSON.stringify({
      t: 'ws_msg',
      s: streamId,
      data,
    }))
  } catch {}
}

/**
 * Close a WebSocket stream through the tunnel.
 */
export function relayWsClose(tunnel, streamId, code = 1000) {
  try {
    tunnel.ws.send(JSON.stringify({
      t: 'ws_close',
      s: streamId,
      code,
    }))
  } catch {}
  tunnel.activeWs.delete(streamId)
}

/**
 * Handle a frame received from the POS tunnel WebSocket.
 * Dispatches to the appropriate pending request or active WS stream.
 */
export function handlePosFrame(tunnel, frame) {
  switch (frame.t) {
    case 'http_res': {
      const pending = tunnel.pendingHttp.get(frame.s)
      if (pending) {
        clearTimeout(pending.timer)
        tunnel.pendingHttp.delete(frame.s)
        pending.resolve({
          status: frame.status || 200,
          headers: frame.headers || {},
          body: frame.body || '',
        })
      }
      break
    }

    case 'ws_accept': {
      // POS accepted the WS connection — the endUserWs is already stored
      // in tunnel.activeWs by the proxy layer before sending ws_open.
      // Nothing additional to do here.
      break
    }

    case 'ws_msg': {
      const endUserWs = tunnel.activeWs.get(frame.s)
      if (endUserWs) {
        try {
          endUserWs.send(frame.data)
        } catch {}
      }
      break
    }

    case 'ws_close': {
      const endUserWs = tunnel.activeWs.get(frame.s)
      if (endUserWs) {
        try {
          endUserWs.end(frame.code || 1000)
        } catch {}
        tunnel.activeWs.delete(frame.s)
      }
      break
    }

    case 'pong':
      // Handled by tunnel-manager
      break

    default:
      break
  }
}

/**
 * Strip hop-by-hop and internal headers before relaying.
 */
function filterHeaders(headers) {
  if (!headers) return {}
  const filtered = {}
  for (const [key, val] of Object.entries(headers)) {
    const lk = key.toLowerCase()
    if (lk === 'host' || lk === 'connection' || lk === 'upgrade' ||
        lk === 'transfer-encoding' || lk === 'keep-alive' ||
        lk === 'proxy-connection' || lk === 'te' || lk === 'trailer') {
      continue
    }
    filtered[key] = val
  }
  return filtered
}
