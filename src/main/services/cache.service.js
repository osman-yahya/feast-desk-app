import { restaurantRepo } from '../db/repositories/restaurant.repo.js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function checkCacheFreshness(mainWindow) {
  const cached = restaurantRepo.get()
  if (!cached) return

  const age = Date.now() - cached.cached_at
  if (age > ONE_DAY_MS) {
    // Notify renderer to prompt for manual refresh
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cache:stale', {
        cached_at: cached.cached_at,
        age_hours: Math.round(age / 3600000)
      })
    }
  }
}
