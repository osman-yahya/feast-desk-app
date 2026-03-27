import { getDb } from '../database.js'

export const settingsRepo = {
  get(key) {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? row.value : null
  },

  set(key, value) {
    getDb()
      .prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)')
      .run(key, String(value), Date.now())
  },

  getAll() {
    const rows = getDb().prepare('SELECT key, value FROM settings').all()
    return Object.fromEntries(rows.map((r) => [r.key, r.value]))
  }
}
