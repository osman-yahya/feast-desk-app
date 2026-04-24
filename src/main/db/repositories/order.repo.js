import { getDb } from '../database.js'

export const orderRepo = {
  getById(id) {
    return getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id) || null
  },

  getByTable(tableId) {
    return (
      getDb()
        .prepare("SELECT * FROM orders WHERE table_id = ? AND status IN ('open','checkout_pending') ORDER BY opened_at DESC LIMIT 1")
        .get(tableId) || null
    )
  },

  getOpen() {
    return getDb()
      .prepare("SELECT o.*, t.name as table_name FROM orders o LEFT JOIN tables t ON o.table_id = t.id WHERE o.status IN ('open','checkout_pending') ORDER BY o.opened_at DESC")
      .all()
  },

  getUnclosed() {
    return getDb()
      .prepare("SELECT o.*, t.name as table_name FROM orders o LEFT JOIN tables t ON o.table_id = t.id WHERE o.status NOT IN ('paid','deleted') ORDER BY o.opened_at DESC")
      .all()
  },

  create(tableId) {
    const db = getDb()
    const result = db
      .prepare("INSERT INTO orders (table_id, status, opened_at) VALUES (?, 'open', ?)")
      .run(tableId || null, Date.now())
    if (tableId) {
      db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(tableId)
    }
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid)
  },

  updateStatus(id, status, extra) {
    const db = getDb()
    if (status === 'paid' || status === 'deleted') {
      db.prepare('UPDATE orders SET status = ?, closed_at = ? WHERE id = ?').run(status, Date.now(), id)
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id)
    }
    if (extra?.checkoutId) {
      db.prepare('UPDATE orders SET checkout_id = ? WHERE id = ?').run(extra.checkoutId, id)
    }
  },

  delete(id) {
    const db = getDb()
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
    if (!order) return false
    db.prepare("UPDATE orders SET status = 'deleted', deleted_at = ? WHERE id = ?").run(Date.now(), id)
    if (order.table_id) {
      // Check if table still has other open orders
      const other = db
        .prepare("SELECT id FROM orders WHERE table_id = ? AND status IN ('open','checkout_pending') AND id != ?")
        .get(order.table_id, id)
      if (!other) {
        db.prepare("UPDATE tables SET status = 'empty' WHERE id = ?").run(order.table_id)
      }
    }
    return true
  },

  markKitchenDone(id) {
    getDb().prepare('UPDATE orders SET kitchen_done_at = ? WHERE id = ?').run(Date.now(), id)
  },

  undoKitchenDone(id) {
    getDb().prepare('UPDATE orders SET kitchen_done_at = NULL WHERE id = ?').run(id)
  },

  getOpenForKitchen(maxAgeMs = 18 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAgeMs
    return getDb()
      .prepare("SELECT o.*, t.name as table_name FROM orders o LEFT JOIN tables t ON o.table_id = t.id WHERE o.status IN ('open','checkout_pending') AND o.opened_at > ? ORDER BY o.opened_at DESC")
      .all(cutoff)
  },

  getHistory(fromTs, toTs) {
    return getDb()
      .prepare("SELECT o.*, t.name as table_name FROM orders o LEFT JOIN tables t ON o.table_id = t.id WHERE o.status = 'paid' AND o.closed_at BETWEEN ? AND ? ORDER BY o.closed_at DESC")
      .all(fromTs, toTs)
  }
}
