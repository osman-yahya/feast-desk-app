import { Router } from 'express'
import { orderRepo } from '../../db/repositories/order.repo.js'
import { orderItemRepo } from '../../db/repositories/orderItem.repo.js'
import { broadcastToAll, broadcastToKitchen } from '../../services/server.service.js'

export function ordersRoutes() {
  const router = Router()

  router.get('/', (req, res) => {
    res.json(orderRepo.getOpen())
  })

  router.get('/:tableId', (req, res) => {
    const order = orderRepo.getByTable(parseInt(req.params.tableId, 10))
    if (!order) return res.status(404).json({ message: 'No open order for table' })
    const items = orderItemRepo.getByOrder(order.id)
    res.json({ ...order, items })
  })

  router.post('/:tableId/items', (req, res) => {
    const tableId = parseInt(req.params.tableId, 10)
    let order = orderRepo.getByTable(tableId)
    if (!order) order = orderRepo.create(tableId)
    const item = orderItemRepo.add(order.id, req.body)
    const items = orderItemRepo.getByOrder(order.id)
    broadcastToKitchen({ type: 'order:item-added', tableId, item, order_id: order.id })
    broadcastToAll({ type: 'order:updated', tableId, items })
    res.json({ order_id: order.id, item })
  })

  return router
}
