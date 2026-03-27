import { buildBill, finalizeCheckout } from '../services/billing.service.js'
import { orderRepo } from '../db/repositories/order.repo.js'
import { orderItemRepo } from '../db/repositories/orderItem.repo.js'

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
      const checkout = finalizeCheckout(orderId, paymentMethod, discountPct, cashierNote)
      return { success: true, checkout }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('checkout:delete-order', (_, orderId) => {
    const ok = orderRepo.delete(orderId)
    return { success: ok }
  })
}
