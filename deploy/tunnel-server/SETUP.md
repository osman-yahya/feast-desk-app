# feast. Tunnel Server — Deployment Guide

## Architecture

```
  Waiter/Kitchen phones
         │ HTTPS (Cloudflare SSL)
         ▼
  ┌─────────────────┐
  │ Cloudflare Edge  │  Free SSL + DDoS + WAF
  │                  │  VPS IP completely hidden
  └────────┬────────┘
           │ cloudflared (outbound-only)
           │
           │  tunnel.feast.tr → feast-tunnel :4000
           ▼
  ┌──────────────────────────────────────────────┐
  │ Hetzner VPS  (2 containers, host network)    │
  │                                              │
  │  cloudflared ──► outbound to Cloudflare      │
  │                                              │
  │  feast-tunnel :4000 (uWebSockets.js)         │
  │       │  POST /api/register → validate creds │
  │       │       └─► generate 256-bit token     │
  │       │  WS /tunnel → POS authenticates      │
  │       │       └─► multiplexed tunnel link    │
  │       │  GET /t/{token}/* → HTTP relay       │
  │       │  WS  /t/{token}/ws → WS relay        │
  │       │  GET /health → metrics               │
  └──────────────────────────────────────────────┘
           ▲
           │ WSS (through Cloudflare)
           │ × 10,000 concurrent
  ┌────────┴─────────┐
  │ Electron POS App │
  │ (local :3737)    │
  └──────────────────┘
```

**Only 1 Cloudflare hostname** — `tunnel.feast.tr → http://localhost:4000`.
Path-based routing (`/t/{token}/`) — no cookies, no wildcard subdomains.

---

## How It Works

```
1. POS app:    POST /api/register { restaurant_id, secret }
               → server validates against feast API
               → returns { token: "ft_..." }

2. POS app:    WS /tunnel → sends { t: "auth", token: "ft_..." }
               → server: { t: "auth_ok", access_url: "https://tunnel.feast.tr/t/ft_.../" }

3. Waiter:     GET /t/ft_.../               → server relays to POS → SPA loads
               WS  /t/ft_.../ws?role=waiter → server relays to POS → real-time orders

4. All HTTP/WS traffic is multiplexed over the single POS tunnel WebSocket.
   POS Express app sees clean paths (/api/menu, /ws) — prefix is stripped.
```

---

## Prerequisites

- Hetzner VPS with Ubuntu 22.04+ (8GB RAM recommended)
- Docker + Docker Compose installed
- Cloudflare account with `feast.tr` domain

---

## Step 1 — Firewall (UFW)

```bash
apt install -y ufw

ufw allow 22/tcp            # SSH

# No other ports needed! cloudflared is outbound-only.
ufw enable
ufw status
```

---

## Step 2 — Kernel Tuning (for 10K+ connections)

```bash
cat > /etc/sysctl.d/99-feast-tunnel.conf << 'EOF'
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.core.netdev_max_backlog = 65535
fs.file-max = 1000000
net.ipv4.tcp_tw_reuse = 1
EOF

sysctl --system

cat > /etc/security/limits.d/feast.conf << 'EOF'
* soft nofile 1000000
* hard nofile 1000000
EOF
```

---

## Step 3 — Create Cloudflare Tunnel

1. Go to https://one.dash.cloudflare.com/ → Networks → Tunnels
2. **Create a tunnel** → select **Cloudflared** connector
3. Name: `feast-tunnel`
4. Copy the **tunnel token**
5. Add **one public hostname**:

| Subdomain | Domain | Service | Settings |
|---|---|---|---|
| `tunnel` | `feast.tr` | `http://localhost:4000` | WebSocket: ON |

> **Important**: Enable **WebSocket** under Additional settings.

---

## Step 4 — Upload Files to VPS

```bash
scp -r deploy/tunnel-server/* root@YOUR_VPS_IP:/opt/feast-tunnel/
```

---

## Step 5 — Configure Secrets

```bash
ssh root@YOUR_VPS_IP
cd /opt/feast-tunnel

cp .env.example .env
nano .env
```

| Variable | Value | How to get |
|---|---|---|
| `CLOUDFLARE_TUNNEL_TOKEN` | Tunnel token | Step 3.4 |
| `FEAST_API_URL` | `https://mutfak.feast.tr` | — |
| `MAX_TUNNELS` | `10000` | Adjust for VPS RAM |

---

## Step 6 — Start the Stack

```bash
cd /opt/feast-tunnel
docker compose up -d
```

Check logs:

```bash
docker compose logs -f              # all services
docker compose logs cloudflared     # tunnel connection
docker compose logs feast-tunnel    # tunnel server
```

---

## Step 7 — Verify

```bash
# Health check
curl https://tunnel.feast.tr/health
# → {"status":"ok","tunnels_active":0,...}

# Unauthorized access
curl -s -o /dev/null -w "%{http_code}" https://tunnel.feast.tr/t/fake-token/
# → 502 (no tunnel connected)

# Invalid credentials
curl -X POST https://tunnel.feast.tr/api/register \
  -H 'Content-Type: application/json' \
  -d '{"restaurant_id":1,"secret":"wrong"}'
# → {"message":"Invalid credentials"}

# Catch-all
curl -s -o /dev/null -w "%{http_code}" https://tunnel.feast.tr/anything
# → 403
```

---

## Port Summary

| Port | Purpose | Exposed to |
|---|---|---|
| 22 | SSH | You |
| 4000 | feast-tunnel | cloudflared (127.0.0.1 only) |

**Not open:** 80, 443, 10000-20000 — cloudflared is outbound-only. Cloudflare handles TLS.

---

## Security

- **No inbound HTTP ports** — cloudflared outbound-only
- **VPS IP hidden from DNS** — Cloudflare CNAME to tunnel
- **Cloudflare SSL** — TLS at edge, no certs on VPS
- **Host network mode** — prevents Docker UFW bypass
- **feast-tunnel on 127.0.0.1** — not externally accessible
- **256-bit cryptographic tokens** — `crypto.randomBytes(16)`
- **30s token TTL** — must be consumed quickly after registration
- **60s grace period** — allows POS reconnection without re-auth
- **Rate limiting** — 5 req/s per IP on /api/register
- **Backpressure** — max 50 pending HTTP + 20 WS per tunnel
- **One tunnel per restaurant** — duplicate kicks the old connection
- **Read-only containers** + no-new-privileges + resource limits
- **Non-root** feast-tunnel (runs as `feast` user)
- **Path isolation** — `/t/{token}/*` prevents cross-restaurant access

---

## Maintenance

```bash
cd /opt/feast-tunnel

# Restart
docker compose restart

# Rebuild after code changes
docker compose build feast-tunnel && docker compose up -d feast-tunnel

# Update cloudflared
docker compose pull cloudflared && docker compose up -d cloudflared

# Logs
docker compose logs -f --tail=100

# Check metrics
curl http://localhost:4000/health
```

---

## Testing with Mock Client

From a development machine:

```bash
cd deploy/tunnel-server/feast-tunnel
npm install
node test/mock-client.js http://localhost:4000 1 test_secret
```

The mock client will print an access URL you can open in a browser.
