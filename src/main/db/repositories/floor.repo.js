import { getDb } from '../database.js'

export const floorRepo = {
  getAll() {
    return getDb().prepare('SELECT * FROM floors ORDER BY sort_order ASC, id ASC').all()
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM floors WHERE id = ?').get(id) || null
  },

  create(name) {
    const db = getDb()
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM floors').get()
    const sortOrder = (maxOrder?.m ?? -1) + 1
    const result = db
      .prepare('INSERT INTO floors (name, sort_order, created_at) VALUES (?, ?, ?)')
      .run(name, sortOrder, Date.now())
    return db.prepare('SELECT * FROM floors WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id, name, sortOrder) {
    const db = getDb()
    if (sortOrder !== undefined) {
      db.prepare('UPDATE floors SET name = ?, sort_order = ? WHERE id = ?').run(name, sortOrder, id)
    } else {
      db.prepare('UPDATE floors SET name = ? WHERE id = ?').run(name, id)
    }
    return db.prepare('SELECT * FROM floors WHERE id = ?').get(id)
  },

  delete(id) {
    return getDb().prepare('DELETE FROM floors WHERE id = ?').run(id)
  }
}
