import { getDb } from '../database.js'

export const orderItemRepo = {
  getByOrder(orderId) {
    return getDb().prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY added_at ASC').all(orderId)
  },

  add(orderId, item) {
    const db = getDb()
    const existing = db
      .prepare('SELECT * FROM order_items WHERE order_id = ? AND menu_item_id = ? AND is_free = 0 AND is_paid_partial = 0')
      .get(orderId, item.menu_item_id)
    if (existing) {
      const newQty = existing.quantity + (item.quantity || 1)
      db.prepare('UPDATE order_items SET quantity = ? WHERE id = ?').run(newQty, existing.id)
      return db.prepare('SELECT * FROM order_items WHERE id = ?').get(existing.id)
    }
    const result = db
      .prepare(
        `INSERT INTO order_items
           (order_id, menu_item_id, menu_item_name, category_name, unit_price, quantity, is_free, discount_pct, note, added_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?)`
      )
      .run(orderId, item.menu_item_id, item.menu_item_name, item.category_name || null, item.unit_price, item.quantity || 1, Date.now())
    return db.prepare('SELECT * FROM order_items WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id, patch) {
    const db = getDb()
    const fields = []
    const vals = []
    if (patch.quantity !== undefined) { fields.push('quantity = ?'); vals.push(patch.quantity) }
    if (patch.is_free !== undefined) { fields.push('is_free = ?'); vals.push(patch.is_free ? 1 : 0) }
    if (patch.is_paid_partial !== undefined) { fields.push('is_paid_partial = ?'); vals.push(patch.is_paid_partial ? 1 : 0) }
    if (patch.discount_pct !== undefined) { fields.push('discount_pct = ?'); vals.push(patch.discount_pct) }
    if (patch.note !== undefined) { fields.push('note = ?'); vals.push(patch.note) }
    if (!fields.length) return null
    db.prepare(`UPDATE order_items SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id)
    return db.prepare('SELECT * FROM order_items WHERE id = ?').get(id)
  },

  remove(id) {
    return getDb().prepare('DELETE FROM order_items WHERE id = ?').run(id)
  },

  markPartialPaid(itemIds) {
    const db = getDb()
    const stmt = db.prepare('UPDATE order_items SET is_paid_partial = 1 WHERE id = ?')
    const tx = db.transaction((ids) => { for (const id of ids) stmt.run(id) })
    tx(itemIds)
  }
}
