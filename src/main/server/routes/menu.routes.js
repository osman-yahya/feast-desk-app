import { Router } from 'express'
import { restaurantRepo } from '../../db/repositories/restaurant.repo.js'

export function menuRoutes() {
  const router = Router()

  router.get('/', (req, res) => {
    const cached = restaurantRepo.get()
    if (!cached) return res.status(404).json({ message: 'Menu not available' })
    try {
      return res.json(JSON.parse(cached.menu_json))
    } catch {
      return res.status(500).json({ message: 'Menu parse error' })
    }
  })

  return router
}
