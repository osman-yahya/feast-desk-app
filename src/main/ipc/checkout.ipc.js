import { buildBill, finalizeCheckout } from '../services/billing.service.js'
import { orderRepo } from '../db/repositories/order.repo.js'
import { orderItemRepo } from '../db/repositories/orderItem.repo.js'
import { broadcastToAll } from '../services/server.service.js'
import { getDb } from '../db/database.js'

export function register(ipcMain) {
  ipcMain.handle('checkout:build-bill', (_, orderId, discountPct) => {
    try {
      return buildBill(orderId, discountPct)
    } catch (err) {
      return { error: err.message }
    }
  })

  ipcMain.handle('checkout:mark-free', (_, itemId, isFree) => {
    orderItemRepo.update(itemId, { is_free: isFree })
    return { success: true }
  })

  ipcMain.handle('checkout:mark-partial-paid', (_, itemIds) => {
    orderItemRepo.markPartialPaid(itemIds)
    return { success: true }
  })

  ipcMain.handle('checkout:apply-discount', (_, itemId, pct) => {
    orderItemRepo.update(itemId, { discount_pct: pct })
    return { success: true }
  })

  ipcMain.handle('checkout:finalize', (_, orderId, paymentMethod, discountPct, cashierNote) => {
    try {
      const order = orderRepo.getById(orderId)
      const checkout = finalizeCheckout(orderId, paymentMethod, discountPct, cashierNote)
      const tableName = order?.table_id
        ? (getDb().prepare('SELECT name FROM tables WHERE id = ?').get(order.table_id)?.name || `Table ${order.table_id}`)
        : null
      if (order && !order.table_id) {
        // Direct order: kitchen still needs to prepare it — send distinct message so kitchen keeps it visible with TTL
        broadcastToAll({ type: 'order:direct-paid', orderId, tableName })
      } else {
        broadcastToAll({ type: 'order:paid', tableId: order?.table_id, orderId, tableName })
      }
      return { success: true, checkout }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('checkout:delete-order', (_, orderId) => {
    const order = orderRepo.getById(orderId)
    const ok = orderRepo.delete(orderId)
    if (ok) {
      const tableName = order?.table_id
        ? (getDb().prepare('SELECT name FROM tables WHERE id = ?').get(order.table_id)?.name || `Table ${order.table_id}`)
        : null
      broadcastToAll({ type: 'order:paid', tableId: order?.table_id, orderId, tableName })
    }
    return { success: ok }
  })
}
