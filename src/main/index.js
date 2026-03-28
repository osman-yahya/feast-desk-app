import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './db/database.js'
import { checkCacheFreshness } from './services/cache.service.js'

// IPC handlers
import { register as registerAuth } from './ipc/auth.ipc.js'
import { register as registerMenu } from './ipc/menu.ipc.js'
import { register as registerTables } from './ipc/tables.ipc.js'
import { register as registerOrders } from './ipc/orders.ipc.js'
import { register as registerCheckout } from './ipc/checkout.ipc.js'
import { register as registerAnalyze } from './ipc/analyze.ipc.js'
import { register as registerServer } from './ipc/server.ipc.js'
import { register as registerSettings } from './ipc/settings.ipc.js'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#FFFDF8',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Register custom protocol to serve local files (file:// is blocked in renderer)
protocol.registerSchemesAsPrivileged([
  { scheme: 'feast-local', privileges: { bypassCSP: true, supportFetchAPI: true } }
])

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('tr.feast.desk')

  // Handle feast-local:// URLs → serve local files safely
  protocol.handle('feast-local', (request) => {
    const filePath = decodeURIComponent(request.url.replace('feast-local://', ''))
    return net.fetch(pathToFileURL(filePath).href)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  try {
    await initDatabase()
    console.log('✅ Database initialized')
  } catch (err) {
    console.error('❌ Database init failed:', err)
  }

  // Register all IPC handlers
  registerAuth(ipcMain)
  registerMenu(ipcMain)
  registerTables(ipcMain)
  registerOrders(ipcMain)
  registerCheckout(ipcMain)
  registerAnalyze(ipcMain)
  registerServer(ipcMain, () => mainWindow)
  registerSettings(ipcMain)

  createWindow()

  // Background cache freshness check (non-blocking)
  setTimeout(async () => {
    try {
      await checkCacheFreshness(mainWindow)
    } catch (err) {
      console.error('Cache freshness check failed:', err)
    }
  }, 3000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
