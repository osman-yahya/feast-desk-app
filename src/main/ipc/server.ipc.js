import {
  startServer,
  stopServer,
  getServerStatus,
  generateQR
} from '../services/server.service.js'
import { settingsRepo } from '../db/repositories/settings.repo.js'
import { createExpressApp } from '../server/express.js'
import { app } from 'electron'
import { join } from 'path'

let mainWindowRef = null

export function register(ipcMain, getMainWindow) {
  ipcMain.handle('server:start', async (_, mode) => {
    try {
      const port = parseInt(settingsRepo.get('server_port') || '3737', 10)
      mainWindowRef = getMainWindow?.()
      const publicDir = app.isPackaged
        ? join(process.resourcesPath, 'public')
        : join(app.getAppPath(), 'src', 'main', 'server', 'public')
      const expressApp = createExpressApp(publicDir)

      // For feast-tunnel mode, pass restaurant credentials
      let credentials = null
      if (mode === 'feast-tunnel') {
        const restaurantId = settingsRepo.get('restaurant_id')
        const secret = settingsRepo.get('restaurant_secret')
        if (!restaurantId || !secret) {
          return { success: false, error: 'Restaurant credentials not found. Please reconnect your restaurant.' }
        }
        credentials = { restaurantId, secret }
      }

      const result = await startServer(port, expressApp, mainWindowRef, mode || 'local', credentials)
      if (result.success) {
        settingsRepo.set('server_enabled', 'true')
        settingsRepo.set('server_mode', mode || 'local')
      }
      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:stop', async () => {
    try {
      await stopServer()
      settingsRepo.set('server_enabled', 'false')
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:status', () => getServerStatus())

  ipcMain.handle('server:qr', async () => {
    try {
      const qr = await generateQR()
      return { qr }
    } catch (err) {
      return { qr: null, error: err.message }
    }
  })
}
