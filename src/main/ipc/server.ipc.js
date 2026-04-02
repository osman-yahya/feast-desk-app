import {
  startServer,
  stopServer,
  getServerStatus,
  generateQR,
  setTableNameResolver
} from '../services/server.service.js'
import { settingsRepo } from '../db/repositories/settings.repo.js'
import { createExpressApp } from '../server/express.js'
import { getDb } from '../db/database.js'
import { app } from 'electron'
import { join } from 'path'

let mainWindowRef = null
let cleanupInterval = null

/**
 * Auto-cleanup: remove deleted orders (24h), order_items for paid orders (7d),
 * and old checkouts/orders per retention setting.
 */
function runOrderCleanup() {
  try {
    const db = getDb()
    // Clean up deleted orders and their items after 24 hours
    const deletedCutoff = Date.now() - 24 * 60 * 60 * 1000
    db.prepare(`DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE status = 'deleted' AND closed_at < ?
    )`).run(deletedCutoff)
    db.prepare("DELETE FROM orders WHERE status = 'deleted' AND closed_at < ?").run(deletedCutoff)

    // Clean up order_items for paid orders older than 7 days
    // (checkout.items_snapshot preserves the data for analytics)
    const paidItemsCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    db.prepare(`DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE status = 'paid' AND closed_at < ?
    )`).run(paidItemsCutoff)

    // Standard retention: remove old paid orders and checkouts
    const days = parseInt(settingsRepo.get('data_retention_days') || '90', 10)
    const retentionCutoff = Date.now() - days * 24 * 60 * 60 * 1000
    db.prepare("DELETE FROM checkouts WHERE paid_at < ?").run(retentionCutoff)
    db.prepare("DELETE FROM orders WHERE status = 'paid' AND closed_at < ?").run(retentionCutoff)
  } catch {}
}

export function register(ipcMain, getMainWindow) {
  // Register authoritative table name resolver for WS messages
  setTableNameResolver((tableId) => {
    try {
      const row = getDb().prepare('SELECT name FROM tables WHERE id = ?').get(tableId)
      return row?.name || `Table ${tableId}`
    } catch {
      return `Table ${tableId}`
    }
  })

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
        // Run initial cleanup and start periodic cleanup (every hour)
        runOrderCleanup()
        if (cleanupInterval) clearInterval(cleanupInterval)
        cleanupInterval = setInterval(runOrderCleanup, 60 * 60 * 1000)
      }
      return result
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('server:stop', async () => {
    try {
      if (cleanupInterval) { clearInterval(cleanupInterval); cleanupInterval = null }
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
