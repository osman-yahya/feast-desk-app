import { restaurantRepo } from '../db/repositories/restaurant.repo.js'

export function register(ipcMain) {
  ipcMain.handle('menu:get', () => {
    const cached = restaurantRepo.get()
    if (!cached) return null
    try {
      return JSON.parse(cached.menu_json)
    } catch {
      return null
    }
  })
}
