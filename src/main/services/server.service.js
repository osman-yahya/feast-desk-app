import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { networkInterfaces } from 'os'
import QRCode from 'qrcode'
import { startFeastTunnel, stopFeastTunnel, getFeastTunnelStatus } from './feast-tunnel.service.js'

let httpServer = null
let wss = null
let localIP = null
let serverPort = null
let mainWindowRef = null
let connectionMode = 'local' // 'local' | 'feast-tunnel'
let resolveTableNameFn = null

// Track connected clients by role
const clients = { waiter: new Set(), kitchen: new Set() }

export function setTableNameResolver(fn) {
  resolveTableNameFn = fn
}

export function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

export async function startServer(port, app, mainWindow, mode = 'local', credentials = null) {
  if (httpServer) return { success: false, error: 'already_running' }

  serverPort = port || 3737
  localIP = getLocalIP()
  mainWindowRef = mainWindow
  connectionMode = mode

  httpServer = createServer(app)
  wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws, req) => {
    const role = new URL(req.url, `http://localhost`).searchParams.get('role') || 'waiter'
    if (role === 'kitchen') clients.kitchen.add(ws)
    else clients.waiter.add(ws)

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        handleClientMessage(msg, ws, role, mainWindow)
      } catch {}
    })

    ws.on('close', () => {
      clients.waiter.delete(ws)
      clients.kitchen.delete(ws)
    })

    ws.send(JSON.stringify({ type: 'connected', role }))
  })

  await new Promise((resolve, reject) => {
    httpServer.listen(serverPort, () => resolve())
    httpServer.on('error', reject)
  })

  // Start feast tunnel if mode is 'feast-tunnel'
  if (mode === 'feast-tunnel') {
    if (!credentials?.restaurantId || !credentials?.secret) {
      await stopServer()
      return { success: false, error: 'Restaurant credentials required for feast tunnel' }
    }
    const result = await startFeastTunnel(serverPort, credentials.restaurantId, credentials.secret)
    if (!result.success) {
      await stopServer()
      return { success: false, error: result.error }
    }
    return {
      success: true,
      port: serverPort,
      ip: localIP,
      mode: connectionMode,
      tunnelUrl: result.tunnelUrl
    }
  }

  return {
    success: true,
    port: serverPort,
    ip: localIP,
    mode: connectionMode,
    tunnelUrl: null
  }
}

export async function stopServer() {
  if (connectionMode === 'feast-tunnel') {
    try { stopFeastTunnel() } catch {}
  }

  // Terminate all WS connections immediately (no close handshake)
  for (const ws of [...clients.waiter, ...clients.kitchen]) {
    try { ws.terminate() } catch {}
  }
  clients.waiter.clear()
  clients.kitchen.clear()

  // Close WebSocket server
  if (wss) {
    try { wss.close() } catch {}
    wss = null
  }

  // Force-close remaining HTTP connections and shut down server
  if (httpServer) {
    try { httpServer.closeAllConnections() } catch {}
    await new Promise((r) => httpServer.close(r))
    httpServer = null
  }

  // Reset all state
  mainWindowRef = null
  connectionMode = 'local'
}

export function getServerStatus() {
  const feastTunnel = connectionMode === 'feast-tunnel' ? getFeastTunnelStatus() : null
  return {
    running: !!httpServer,
    port: serverPort,
    ip: localIP,
    mode: connectionMode,
    tunnelUrl: feastTunnel?.tunnelUrl || null,
    waiter_clients: clients.waiter.size,
    kitchen_clients: clients.kitchen.size
  }
}

export async function generateQR(role = 'waiter') {
  if (!httpServer) return null
  const feastTunnel = connectionMode === 'feast-tunnel' ? getFeastTunnelStatus() : null
  const baseUrl = feastTunnel?.tunnelUrl || `http://${localIP}:${serverPort}`
  const url = role === 'kitchen' ? `${baseUrl}?role=kitchen` : `${baseUrl}/waiter`
  return QRCode.toDataURL(url)
}

export function broadcastToKitchen(message) {
  const raw = JSON.stringify(message)
  for (const ws of clients.kitchen) {
    if (ws.readyState === 1) ws.send(raw)
  }
}

export function broadcastToAll(message) {
  const raw = JSON.stringify(message)
  for (const ws of [...clients.waiter, ...clients.kitchen]) {
    if (ws.readyState === 1) ws.send(raw)
  }
  // Also forward to the Electron host renderer (not a WS client)
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    mainWindowRef.webContents.send('server:message', message)
  }
}

export function broadcastToWaiters(message) {
  const raw = JSON.stringify(message)
  for (const ws of clients.waiter) {
    if (ws.readyState === 1) ws.send(raw)
  }
}

function handleClientMessage(msg, ws, role, mainWindow) {
  if (role === 'waiter') {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:message', msg)
    }
    if (msg.type === 'order:add' || msg.type === 'order:update') {
      broadcastToKitchen({ ...msg, from: 'waiter' })
    }
  } else if (role === 'kitchen') {
    if (msg.type === 'order:done') {
      // Resolve table name from DB for accuracy; direct orders (no tableId) use client-provided name
      const tableName = msg.tableId
        ? (resolveTableNameFn ? resolveTableNameFn(msg.tableId) : (msg.tableName || `Table ${msg.tableId}`))
        : (msg.tableName || 'Direct Order')
      broadcastToWaiters({ type: 'order:done', tableId: msg.tableId, tableName, orderId: msg.orderId })
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:order-done', { tableId: msg.tableId, tableName, orderId: msg.orderId })
      }
    }
  }
}
