import { restaurantRepo } from '../db/repositories/restaurant.repo.js'
import { refreshCache } from './auth.service.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function checkCacheFreshness(mainWindow) {
  const cached = restaurantRepo.get()
  if (!cached) return

  const age = Date.now() - cached.cached_at
  if (age > ONE_DAY_MS) {
    // Try silent refresh using stored secret
    const result = await refreshCache()
    if (result.success) {
      console.log('✅ Menu cache silently refreshed')
      return
    }

    // Silent refresh failed — notify renderer to prompt manually
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cache:stale', {
        cached_at: cached.cached_at,
        age_hours: Math.round(age / 3600000)
      })
    }
  }
}
