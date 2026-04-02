import { connectRestaurant, getRestaurant, disconnect, refreshWithCode, refreshCache } from '../services/auth.service.js'

export function register(ipcMain) {
  ipcMain.handle('auth:connect', async (_, code) => {
    try {
      return await connectRestaurant(code)
    } catch (err) {
      return { success: false, error: 'unexpected', message: err.message }
    }
  })

  ipcMain.handle('auth:get-restaurant', () => {
    try {
      return getRestaurant()
    } catch (err) {
      return null
    }
  })

  ipcMain.handle('auth:disconnect', () => {
    try {
      disconnect()
      return { success: true }
    } catch (err) {
      return { success: false, message: err.message }
    }
  })

  ipcMain.handle('auth:refresh', async (_, code) => {
    try {
      return await refreshWithCode(code)
    } catch (err) {
      return { success: false, error: 'unexpected', message: err.message }
    }
  })

  ipcMain.handle('auth:silent-refresh', async () => {
    try {
      return await refreshCache()
    } catch (err) {
      return { success: false, error: 'unexpected', message: err.message }
    }
  })
}
