import { Router } from 'express'
import { orderRepo } from '../../db/repositories/order.repo.js'
import { orderItemRepo } from '../../db/repositories/orderItem.repo.js'
import { broadcastToAll, broadcastToKitchen } from '../../services/server.service.js'
import { getDb } from '../../db/database.js'

export function ordersRoutes() {
  const router = Router()

  // GET /api/orders — all open orders (with table names)
  // ?kitchen=1 → filter to last 18 hours only (avoid stale orders from previous days)
  router.get('/', (req, res) => {
    if (req.query.kitchen === '1') {
      res.json(orderRepo.getOpenForKitchen())
    } else {
      res.json(orderRepo.getOpen())
    }
  })

  // GET /api/orders/by-id/:orderId — single order by ID + items (used by kitchen for direct orders)
  router.get('/by-id/:orderId', (req, res) => {
    const order = orderRepo.getById(parseInt(req.params.orderId, 10))
    if (!order) return res.status(404).json({ message: 'Order not found' })
    const items = orderItemRepo.getByOrder(order.id)
    res.json({ ...order, items })
  })

  // GET /api/orders/:tableId — single table's open order + items
  router.get('/:tableId', (req, res) => {
    const order = orderRepo.getByTable(parseInt(req.params.tableId, 10))
    if (!order) return res.status(404).json({ message: 'No open order for table' })
    const items = orderItemRepo.getByOrder(order.id)
    res.json({ ...order, items })
  })

  // POST /api/orders/:tableId/items — add item (auto-creates order)
  router.post('/:tableId/items', (req, res) => {
    const tableId = parseInt(req.params.tableId, 10)
    let order = orderRepo.getByTable(tableId)
    if (!order) order = orderRepo.create(tableId)
    const item = orderItemRepo.add(order.id, req.body)
    const items = orderItemRepo.getByOrder(order.id)
    broadcastToKitchen({ type: 'order:item-added', tableId, item, order_id: order.id })
    broadcastToAll({ type: 'order:updated', tableId, orderId: order.id, items })
    res.json({ order_id: order.id, item })
  })

  // PATCH /api/orders/items/:itemId — update item quantity
  router.patch('/items/:itemId', (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId, 10)
      const row = getDb()
        .prepare('SELECT oi.*, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?')
        .get(itemId)
      if (!row) return res.status(404).json({ error: 'Item not found' })
      const { quantity } = req.body
      if (quantity != null && quantity <= 0) {
        orderItemRepo.remove(itemId)
      } else if (quantity != null) {
        orderItemRepo.update(itemId, { quantity })
      }
      const items = orderItemRepo.getByOrder(row.order_id)
      broadcastToAll({ type: 'order:updated', tableId: row.table_id, orderId: row.order_id, items })
      broadcastToKitchen({ type: 'order:items-changed', tableId: row.table_id, order_id: row.order_id, items })
      res.json({ success: true, items })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // PATCH /api/orders/:orderId/kitchen-done — mark order as kitchen-done
  router.patch('/:orderId/kitchen-done', (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId, 10)
      const order = orderRepo.getById(orderId)
      if (!order) return res.status(404).json({ error: 'Order not found' })
      orderRepo.markKitchenDone(orderId)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // PATCH /api/orders/:orderId/kitchen-undo — undo kitchen-done
  router.patch('/:orderId/kitchen-undo', (req, res) => {
    try {
      const orderId = parseInt(req.params.orderId, 10)
      const order = orderRepo.getById(orderId)
      if (!order) return res.status(404).json({ error: 'Order not found' })
      orderRepo.undoKitchenDone(orderId)
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // DELETE /api/orders/items/:itemId — remove an item
  router.delete('/items/:itemId', (req, res) => {
    try {
      const itemId = parseInt(req.params.itemId, 10)
      const row = getDb()
        .prepare('SELECT oi.*, o.table_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.id = ?')
        .get(itemId)
      if (!row) return res.status(404).json({ error: 'Item not found' })
      orderItemRepo.remove(itemId)
      const items = orderItemRepo.getByOrder(row.order_id)
      broadcastToAll({ type: 'order:updated', tableId: row.table_id, orderId: row.order_id, items })
      broadcastToKitchen({ type: 'order:items-changed', tableId: row.table_id, order_id: row.order_id, items })
      res.json({ success: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
