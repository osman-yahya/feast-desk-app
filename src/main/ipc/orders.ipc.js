import { orderRepo } from '../db/repositories/order.repo.js'
import { orderItemRepo } from '../db/repositories/orderItem.repo.js'
import { broadcastToKitchen, broadcastToAll } from '../services/server.service.js'
import { getDb } from '../db/database.js'

export function register(ipcMain) {
  ipcMain.handle('orders:get-open', () => orderRepo.getOpen())

  ipcMain.handle('orders:get-by-table', (_, tableId) => orderRepo.getByTable(tableId))

  ipcMain.handle('orders:get-items', (_, orderId) => orderItemRepo.getByOrder(orderId))

  ipcMain.handle('orders:create', (_, tableId) => orderRepo.create(tableId))

  ipcMain.handle('orders:add-item', (_, orderId, item) => {
    const added = orderItemRepo.add(orderId, item)
    const order = orderRepo.getById(orderId)
    const items = orderItemRepo.getByOrder(orderId)
    broadcastToKitchen({ type: 'order:item-added', tableId: order?.table_id, orderId, item: added, order_id: orderId })
    broadcastToAll({ type: 'order:updated', tableId: order?.table_id, orderId, items })
    return added
  })

  ipcMain.handle('orders:remove-item', (_, itemId) => {
    const row = getDb()
      .prepare('SELECT oi.*, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?')
      .get(itemId)
    orderItemRepo.remove(itemId)
    if (row) {
      const items = orderItemRepo.getByOrder(row.order_id)
      broadcastToAll({ type: 'order:updated', tableId: row.table_id, orderId: row.order_id, items })
      broadcastToKitchen({ type: 'order:items-changed', tableId: row.table_id, order_id: row.order_id, items })
    }
    return { success: true }
  })

  ipcMain.handle('orders:update-item', (_, itemId, patch) => {
    const updated = orderItemRepo.update(itemId, patch)
    if (updated) {
      const row = getDb()
        .prepare('SELECT oi.*, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?')
        .get(itemId)
      if (row) {
        const items = orderItemRepo.getByOrder(row.order_id)
        broadcastToAll({ type: 'order:updated', tableId: row.table_id, orderId: row.order_id, items })
        broadcastToKitchen({ type: 'order:items-changed', tableId: row.table_id, order_id: row.order_id, items })
      }
    }
    return updated
  })
}
