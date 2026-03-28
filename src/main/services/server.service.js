import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { networkInterfaces } from 'os'
import QRCode from 'qrcode'
import localtunnel from 'localtunnel'

let httpServer = null
let wss = null
let localIP = null
let serverPort = null
let mainWindowRef = null
let tunnelInstance = null
let connectionMode = 'local' // 'local' | 'tunnel'

// Track connected clients by role
const clients = { waiter: new Set(), kitchen: new Set() }

export function getLocalIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return '127.0.0.1'
}

export async function startServer(port, app, mainWindow, mode = 'local') {
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

  // Start tunnel if mode is 'tunnel'
  if (mode === 'tunnel') {
    try {
      tunnelInstance = await localtunnel({ port: serverPort })
      tunnelInstance.on('close', () => { tunnelInstance = null })
    } catch (err) {
      // Server started but tunnel failed — stop everything and report
      await stopServer()
      return { success: false, error: `Tunnel failed: ${err.message}` }
    }
  }

  return {
    success: true,
    port: serverPort,
    ip: localIP,
    mode: connectionMode,
    tunnelUrl: tunnelInstance?.url || null
  }
}

export async function stopServer() {
  if (tunnelInstance) {
    tunnelInstance.close()
    tunnelInstance = null
  }
  if (!httpServer) return
  for (const ws of [...clients.waiter, ...clients.kitchen]) ws.close()
  clients.waiter.clear()
  clients.kitchen.clear()
  await new Promise((r) => httpServer.close(r))
  httpServer = null
  wss = null
  connectionMode = 'local'
}

export function getServerStatus() {
  return {
    running: !!httpServer,
    port: serverPort,
    ip: localIP,
    mode: connectionMode,
    tunnelUrl: tunnelInstance?.url || null,
    waiter_clients: clients.waiter.size,
    kitchen_clients: clients.kitchen.size
  }
}

export async function generateQR(role = 'waiter') {
  if (!httpServer) return null
  const baseUrl = tunnelInstance?.url || `http://${localIP}:${serverPort}`
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
      // Kitchen marked order done — notify all waiters and main window
      broadcastToWaiters({ type: 'order:done', tableId: msg.tableId, tableName: msg.tableName, orderId: msg.orderId })
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:order-done', { tableId: msg.tableId, tableName: msg.tableName })
      }
    }
  }
}
