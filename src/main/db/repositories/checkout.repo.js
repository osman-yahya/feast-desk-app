import { getDb } from '../database.js'

export const checkoutRepo = {
  create(data) {
    const db = getDb()
    const result = db
      .prepare(
        `INSERT INTO checkouts
           (order_id, table_name, subtotal, discount_total, grand_total, payment_method, paid_at, cashier_note, items_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        data.order_id,
        data.table_name || null,
        data.subtotal,
        data.discount_total || 0,
        data.grand_total,
        data.payment_method || 'cash',
        Date.now(),
        data.cashier_note || null,
        JSON.stringify(data.items_snapshot || [])
      )
    return db.prepare('SELECT * FROM checkouts WHERE id = ?').get(result.lastInsertRowid)
  },

  getByRange(fromTs, toTs) {
    return getDb()
      .prepare('SELECT * FROM checkouts WHERE paid_at BETWEEN ? AND ? ORDER BY paid_at DESC')
      .all(fromTs, toTs)
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM checkouts WHERE id = ?').get(id) || null
  }
}
