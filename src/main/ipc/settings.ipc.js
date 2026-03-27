import { settingsRepo } from '../db/repositories/settings.repo.js'
import { discountRepo } from '../db/repositories/discount.repo.js'
import { orderRepo } from '../db/repositories/order.repo.js'
import { restaurantRepo } from '../db/repositories/restaurant.repo.js'
import { floorRepo } from '../db/repositories/floor.repo.js'
import { tableRepo } from '../db/repositories/table.repo.js'
import { orderItemRepo } from '../db/repositories/orderItem.repo.js'
import { getDb } from '../db/database.js'

export function register(ipcMain) {
  ipcMain.handle('settings:get', (_, key) => settingsRepo.get(key))

  ipcMain.handle('settings:set', (_, key, value) => {
    settingsRepo.set(key, value)
    return { success: true }
  })

  ipcMain.handle('settings:get-all', () => settingsRepo.getAll())

  ipcMain.handle('settings:get-discounts', () => discountRepo.getAll())

  ipcMain.handle('settings:save-discount', (_, data) => {
    if (data.id) {
      discountRepo.update(data.id, data.label, data.pct)
      return { success: true }
    }
    return discountRepo.create(data.label, data.pct)
  })

  ipcMain.handle('settings:delete-discount', (_, id) => {
    discountRepo.delete(id)
    return { success: true }
  })

  ipcMain.handle('settings:get-unclosed-orders', () => orderRepo.getUnclosed())

  ipcMain.handle('settings:close-order', (_, orderId) => {
    orderRepo.delete(orderId)
    return { success: true }
  })

  ipcMain.handle('settings:export-config', () => {
    try {
      const floors = floorRepo.getAll()
      const tables = []
      const elements = []
      for (const floor of floors) {
        tables.push(...tableRepo.getByFloor(floor.id))
        elements.push(...tableRepo.getFloorElements(floor.id))
      }
      const discounts = discountRepo.getAll()
      const settingsAll = settingsRepo.getAll()
      return {
        version: 1,
        exported_at: Date.now(),
        floors,
        tables,
        floor_elements: elements,
        discounts,
        settings: settingsAll
      }
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('settings:import-config', (_, data) => {
    try {
      const db = getDb()
      const tx = db.transaction(() => {
        // Import settings (skip connected/restaurant_id)
        const skip = new Set(['connected', 'restaurant_id'])
        for (const [key, value] of Object.entries(data.settings || {})) {
          if (!skip.has(key)) settingsRepo.set(key, value)
        }
        // Import discounts
        db.prepare('DELETE FROM predefined_discounts').run()
        for (const d of data.discounts || []) {
          db.prepare('INSERT INTO predefined_discounts (label, pct, is_active, created_at) VALUES (?, ?, 1, ?)')
            .run(d.label, d.pct, Date.now())
        }
        // Import floors/tables/elements
        db.prepare('DELETE FROM floors').run()
        for (const f of data.floors || []) {
          db.prepare('INSERT INTO floors (name, sort_order, created_at) VALUES (?, ?, ?)').run(f.name, f.sort_order, f.created_at)
        }
        const newFloors = floorRepo.getAll()
        const floorIdMap = {}
        for (let i = 0; i < (data.floors || []).length; i++) {
          floorIdMap[data.floors[i].id] = newFloors[i]?.id
        }
        for (const t of data.tables || []) {
          const newFloorId = floorIdMap[t.floor_id]
          if (newFloorId) {
            db.prepare('INSERT INTO tables (floor_id, name, grid_col, grid_row, width, height, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
              .run(newFloorId, t.name, t.grid_col, t.grid_row, t.width, t.height, 'empty', Date.now())
          }
        }
        for (const el of data.floor_elements || []) {
          const newFloorId = floorIdMap[el.floor_id]
          if (newFloorId) {
            db.prepare('INSERT INTO floor_elements (floor_id, type, grid_col, grid_row, width, height, angle, label_text, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
              .run(newFloorId, el.type, el.grid_col, el.grid_row, el.width, el.height, el.angle, el.label_text, Date.now())
          }
        }
      })
      tx()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // Prune old data based on data_retention_days setting
  ipcMain.handle('settings:prune-old-data', () => {
    try {
      const days = parseInt(settingsRepo.get('data_retention_days') || '90', 10)
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
      getDb().prepare("DELETE FROM checkouts WHERE paid_at < ?").run(cutoff)
      getDb().prepare("DELETE FROM orders WHERE status IN ('paid','deleted') AND closed_at < ?").run(cutoff)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}
