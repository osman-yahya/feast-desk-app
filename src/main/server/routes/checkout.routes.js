import { Router } from 'express'
import { buildBill, finalizeCheckout } from '../../services/billing.service.js'
import { orderRepo } from '../../db/repositories/order.repo.js'
import { broadcastToAll } from '../../services/server.service.js'

export function checkoutRoutes() {
  const router = Router()

  // GET /api/checkout/bill/:orderId?pct=10
  router.get('/bill/:orderId', (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId)
      const pct = req.query.pct != null ? parseFloat(req.query.pct) : null
      const bill = buildBill(orderId, pct > 0 ? pct : null)
      res.json(bill)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // POST /api/checkout/finalize  { orderId, paymentMethod, discountPct?, cashierNote? }
  router.post('/finalize', (req, res) => {
    try {
      const { orderId, paymentMethod, discountPct, cashierNote } = req.body
      if (!orderId) return res.status(400).json({ success: false, error: 'orderId required' })

      const order = orderRepo.getById(orderId)
      const pct = discountPct > 0 ? discountPct : null
      const checkout = finalizeCheckout(orderId, paymentMethod || 'cash', pct, cashierNote || null)

      // Broadcast to all clients so kitchen + waiters know the order is closed
      if (order && order.table_id) {
        broadcastToAll({ type: 'order:paid', tableId: order.table_id, orderId })
      }

      res.json({ success: true, checkout })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
