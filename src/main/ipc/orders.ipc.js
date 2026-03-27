import { orderRepo } from '../db/repositories/order.repo.js'
import { orderItemRepo } from '../db/repositories/orderItem.repo.js'

export function register(ipcMain) {
  ipcMain.handle('orders:get-open', () => orderRepo.getOpen())

  ipcMain.handle('orders:get-by-table', (_, tableId) => orderRepo.getByTable(tableId))

  ipcMain.handle('orders:get-items', (_, orderId) => orderItemRepo.getByOrder(orderId))

  ipcMain.handle('orders:create', (_, tableId) => orderRepo.create(tableId))

  ipcMain.handle('orders:add-item', (_, orderId, item) => orderItemRepo.add(orderId, item))

  ipcMain.handle('orders:remove-item', (_, itemId) => {
    orderItemRepo.remove(itemId)
    return { success: true }
  })

  ipcMain.handle('orders:update-item', (_, itemId, patch) => orderItemRepo.update(itemId, patch))
}
