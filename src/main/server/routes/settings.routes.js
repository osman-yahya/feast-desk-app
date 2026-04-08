import { Router } from 'express'
import { settingsRepo } from '../../db/repositories/settings.repo.js'
import { discountRepo } from '../../db/repositories/discount.repo.js'

export function settingsRoutes() {
  const router = Router()

  // GET /api/settings – kitchen-relevant settings for the SPA
  router.get('/', (req, res) => {
    try {
      const s = settingsRepo.getAll()
      res.json({
        kitchen_approval_enabled: s.kitchen_approval_enabled !== 'false',
        kitchen_timer_green:  parseInt(s.kitchen_timer_green  || '5'),
        kitchen_timer_red:    parseInt(s.kitchen_timer_red    || '20'),
        kitchen_timer_done:   parseInt(s.kitchen_timer_done   || '30'),
        currency_symbol:      s.currency_symbol || '₺',
        language:             s.language || 'en'
      })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // GET /api/settings/discounts
  router.get('/discounts', (req, res) => {
    try {
      res.json(discountRepo.getAll())
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
