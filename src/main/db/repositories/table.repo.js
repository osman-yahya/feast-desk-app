import { getDb } from '../database.js'

export const tableRepo = {
  getByFloor(floorId) {
    return getDb().prepare('SELECT * FROM tables WHERE floor_id = ?').all(floorId)
  },

  getById(id) {
    return getDb().prepare('SELECT * FROM tables WHERE id = ?').get(id) || null
  },

  create(data) {
    const db = getDb()
    const result = db
      .prepare(
        `INSERT INTO tables (floor_id, name, grid_col, grid_row, width, height, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'empty', ?)`
      )
      .run(data.floor_id, data.name, data.grid_col, data.grid_row, data.width || 2, data.height || 2, Date.now())
    return db.prepare('SELECT * FROM tables WHERE id = ?').get(result.lastInsertRowid)
  },

  update(id, data) {
    const db = getDb()
    const fields = []
    const vals = []
    if (data.name !== undefined) { fields.push('name = ?'); vals.push(data.name) }
    if (data.grid_col !== undefined) { fields.push('grid_col = ?'); vals.push(data.grid_col) }
    if (data.grid_row !== undefined) { fields.push('grid_row = ?'); vals.push(data.grid_row) }
    if (data.width !== undefined) { fields.push('width = ?'); vals.push(data.width) }
    if (data.height !== undefined) { fields.push('height = ?'); vals.push(data.height) }
    if (data.status !== undefined) { fields.push('status = ?'); vals.push(data.status) }
    if (!fields.length) return this.getById(id)
    db.prepare(`UPDATE tables SET ${fields.join(', ')} WHERE id = ?`).run(...vals, id)
    return db.prepare('SELECT * FROM tables WHERE id = ?').get(id)
  },

  delete(id) {
    return getDb().prepare('DELETE FROM tables WHERE id = ?').run(id)
  },

  updateStatus(id, status) {
    getDb().prepare("UPDATE tables SET status = ? WHERE id = ?").run(status, id)
  },

  getFloorElements(floorId) {
    return getDb().prepare('SELECT * FROM floor_elements WHERE floor_id = ?').all(floorId)
  },

  replaceFloorElements(floorId, elements) {
    const db = getDb()
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM floor_elements WHERE floor_id = ?').run(floorId)
      const ins = db.prepare(
        `INSERT INTO floor_elements (floor_id, type, grid_col, grid_row, width, height, angle, label_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const el of elements) {
        ins.run(floorId, el.type, el.grid_col, el.grid_row, el.width || 1, el.height || 1, el.angle || 0, el.label_text || null, Date.now())
      }
    })
    tx()
  }
}
