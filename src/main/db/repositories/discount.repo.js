import { getDb } from '../database.js'

export const discountRepo = {
  getAll() {
    return getDb().prepare('SELECT * FROM predefined_discounts WHERE is_active = 1 ORDER BY label ASC').all()
  },

  create(label, pct) {
    const db = getDb()
    const result = db
      .prepare('INSERT INTO predefined_discounts (label, pct, is_active, created_at) VALUES (?, ?, 1, ?)')
      .run(label, pct, Date.now())
    return db.prepare('SELECT * FROM predefined_discounts WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id, label, pct) {
    getDb().prepare('UPDATE predefined_discounts SET label = ?, pct = ? WHERE id = ?').run(label, pct, id)
  },

  delete(id) {
    getDb().prepare('DELETE FROM predefined_discounts WHERE id = ?').run(id)
  }
}
