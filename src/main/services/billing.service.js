import { orderItemRepo } from '../db/repositories/orderItem.repo.js'
import { orderRepo } from '../db/repositories/order.repo.js'
import { checkoutRepo } from '../db/repositories/checkout.repo.js'
import { tableRepo } from '../db/repositories/table.repo.js'
import { getDb } from '../db/database.js'

/**
 * Calculate bill for an order.
 * Returns { items, subtotal, discount_total, grand_total }
 */
export function buildBill(orderId, overrideDiscountPct) {
  const items = orderItemRepo.getByOrder(orderId)

  let subtotal = 0
  let discount_total = 0

  const enriched = items.map((item) => {
    if (item.is_free) {
      return { ...item, line_total: 0, line_discount: item.unit_price * item.quantity }
    }
    const base = item.unit_price * item.quantity
    // null/undefined both mean "no override – fall back to per-item discount"
    const pct = (overrideDiscountPct != null) ? overrideDiscountPct : (item.discount_pct ?? 0)
    const disc = parseFloat((base * pct / 100).toFixed(2))
    const total = parseFloat((base - disc).toFixed(2))
    subtotal += base
    discount_total += disc
    return { ...item, line_total: total, line_discount: disc, applied_pct: pct }
  })

  subtotal = parseFloat(subtotal.toFixed(2))
  discount_total = parseFloat(discount_total.toFixed(2))
  const grand_total = parseFloat((subtotal - discount_total).toFixed(2))

  return { items: enriched, subtotal, discount_total, grand_total }
}

/**
 * Finalize checkout: create checkout record, mark order paid, update table.
 */
export function finalizeCheckout(orderId, paymentMethod, discountPct, cashierNote) {
  const order = orderRepo.getById(orderId)
  if (!order) throw new Error('Order not found')

  const bill = buildBill(orderId, discountPct)

  // Get table name snapshot
  let table_name = null
  if (order.table_id) {
    const tbl = tableRepo.getById(order.table_id)
    table_name = tbl?.name || null
  }

  const db = getDb()
  const tx = db.transaction(() => {
    const checkout = checkoutRepo.create({
      order_id: orderId,
      table_name,
      subtotal: bill.subtotal,
      discount_total: bill.discount_total,
      grand_total: bill.grand_total,
      payment_method: paymentMethod || 'cash',
      cashier_note: cashierNote || null,
      items_snapshot: bill.items
    })

    orderRepo.updateStatus(orderId, 'paid', { checkoutId: checkout.id })

    if (order.table_id) {
      tableRepo.updateStatus(order.table_id, 'empty')
    }

    return checkout
  })

  return tx()
}
