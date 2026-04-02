const express = require('express')
const crypto = require('crypto')
const httpProxy = require('http-proxy')

const app = express()
app.use(express.json({ limit: '1kb' }))

// ─── Config ────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10)
const BIND = process.env.BIND || '127.0.0.1'
const HMAC_SECRET = process.env.HMAC_SECRET
const FEAST_API_URL = process.env.FEAST_API_URL || 'https://mutfak.feast.tr'
const TUNNEL_DOMAIN = process.env.TUNNEL_DOMAIN || 'tunnel.feast.tr'
const LT_URL = 'http://127.0.0.1:3000'
const TOKEN_TTL_MS = 30_000 // 30 seconds

if (!HMAC_SECRET) {
  console.error('HMAC_SECRET is required')
  process.exit(1)
}

// ─── Proxy to localtunnel ──────────────────────────────────────
const proxy = httpProxy.createProxyServer({
  target: LT_URL,
  ws: true,
  xfwd: true
})

proxy.on('error', (err, _req, res) => {
  console.error(`[proxy] ${err.message}`)
  if (res.writeHead) res.writeHead(502).end('Tunnel unavailable')
})

// ─── Rate limiting (simple in-memory) ──────────────────────────
const rateLimitMap = new Map()
const RATE_LIMIT = 5
const RATE_WINDOW_MS = 1_000

function rateLimit(ip) {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > RATE_LIMIT
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_WINDOW_MS * 10) rateLimitMap.delete(ip)
  }
}, 30_000)

// ─── Token maps ────────────────────────────────────────────────
const pending = new Map()  // subdomain → expiry (pre-auth, not yet registered)
const active = new Set()   // subdomains with live tunnels

// Cleanup expired pending tokens every 60s
setInterval(() => {
  const now = Date.now()
  for (const [key, expiry] of pending) {
    if (now > expiry) pending.delete(key)
  }
}, 60_000)

// ─── Helpers ───────────────────────────────────────────────────
function generateSubdomain(restaurantId) {
  const rand = crypto.randomBytes(4).toString('hex')
  const hmac = crypto.createHmac('sha256', HMAC_SECRET)
    .update(`${restaurantId}-${rand}`)
    .digest('hex')
    .slice(0, 8)
  return `r${restaurantId}-${hmac}`
}

function getTunnelCookie(req) {
  const cookies = req.headers.cookie || ''
  const match = cookies.match(/tunnel_id=([a-z0-9-]+)/i)
  return match ? match[1] : null
}

function setTunnelCookie(res, subdomain) {
  res.setHeader('Set-Cookie', `tunnel_id=${subdomain}; Path=/; HttpOnly; SameSite=Lax; Secure`)
}

// ─── POST /api/token ───────────────────────────────────────────
app.post('/api/token', async (req, res) => {
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip
  if (rateLimit(ip)) {
    return res.status(429).json({ success: false, error: 'Too many requests' })
  }

  const { restaurant_id, secret } = req.body || {}

  if (!restaurant_id || !secret) {
    return res.status(400).json({ success: false, error: 'Missing credentials' })
  }

  try {
    const response = await fetch(`${FEAST_API_URL}/rsts/menu/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: Number(restaurant_id), secret: String(secret) })
    })
    console.log("API Response Status:", response.status);
    const errorDetail = await response.text();
    console.log("API Response Body:", errorDetail);
    if (!response.ok) {
      return res.status(403).json({ success: false, error: 'Invalid credentials' })
    }

    const subdomain = generateSubdomain(restaurant_id)
    pending.set(subdomain, Date.now() + TOKEN_TTL_MS)

    console.log(`[auth] Token issued for restaurant ${restaurant_id}: ${subdomain}`)
    return res.json({ success: true, subdomain })
  } catch (err) {
    console.error(`[auth] API call failed: ${err.message}`)
    return res.status(502).json({ success: false, error: 'Auth service unavailable' })
  }
})

// ─── GET /health ───────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', pending: pending.size, active: active.size })
})

// ─── GET /:subdomain — registration or first waiter visit ──────
app.get('/:subdomain', async (req, res, next) => {
  const subdomain = req.params.subdomain

  // Skip if it looks like an API or static file path
  if (subdomain === 'api' || subdomain === 'health' || subdomain.includes('.')) {
    return next()
  }

  // 1. Registration (localtunnel client with valid token)
  if (pending.has(subdomain)) {
    const expiry = pending.get(subdomain)
    if (Date.now() > expiry) {
      pending.delete(subdomain)
      return res.status(403).json({ error: 'Token expired' })
    }

    pending.delete(subdomain)
    active.add(subdomain)
    console.log(`[auth] Registered tunnel: ${subdomain}`)

    // Proxy registration to localtunnel and rewrite the URL in response
    try {
      const ltRes = await fetch(`${LT_URL}/${subdomain}`)
      const data = await ltRes.json()

      // Rewrite URL: https://r42-abc.tunnel.feast.tr → https://tunnel.feast.tr/r42-abc
      if (data.url) {
        data.url = `https://${TUNNEL_DOMAIN}/${subdomain}`
      }

      return res.status(ltRes.status).json(data)
    } catch (err) {
      console.error(`[proxy] Registration failed: ${err.message}`)
      return res.status(502).json({ error: 'Tunnel server unavailable' })
    }
  }

  // 2. Waiter/kitchen first visit — set cookie and redirect
  if (active.has(subdomain)) {
    setTunnelCookie(res, subdomain)
    // Preserve query params (?role=kitchen etc.)
    const query = req._parsedUrl.search || ''
    return res.redirect(`/${query}`)
  }

  return res.status(403).json({ error: 'Unauthorized' })
})

// ─── Block unauth new tunnel creation ──────────────────────────
app.get('/', (req, res, next) => {
  if (req.query.new !== undefined) {
    return res.status(403).json({ error: 'Unauthorized' })
  }
  next()
})

// ─── All other requests — cookie-based proxy ───────────────────
app.use((req, res) => {
  const subdomain = getTunnelCookie(req)

  if (!subdomain || !active.has(subdomain)) {
    return res.status(403).json({ error: 'No active tunnel session' })
  }

  // Rewrite Host header so localtunnel routes to the correct client
  req.headers.host = `${subdomain}.${TUNNEL_DOMAIN}`
  proxy.web(req, res)
})

// ─── Start server + WebSocket upgrade ──────────────────────────
const server = app.listen(PORT, BIND, () => {
  console.log(`[auth-sidecar] Listening on ${BIND}:${PORT}`)
})

// Handle WebSocket upgrades with same cookie-based routing
server.on('upgrade', (req, socket, head) => {
  const subdomain = getTunnelCookie(req)

  if (!subdomain || !active.has(subdomain)) {
    socket.destroy()
    return
  }

  req.headers.host = `${subdomain}.${TUNNEL_DOMAIN}`
  proxy.ws(req, socket, head)
})
