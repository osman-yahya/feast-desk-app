import { getDb } from '../database.js'

export const restaurantRepo = {
  get() {
    return getDb().prepare('SELECT * FROM restaurant_cache WHERE id = 1').get() || null
  },

  upsert(data) {
    const db = getDb()
    db.prepare(`
      INSERT OR REPLACE INTO restaurant_cache
        (id, restaurant_id, restaurant_name, img_url, img_local_path, theme_id, level, menu_json, cached_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.restaurant_id,
      data.restaurant_name,
      data.img_url || null,
      data.img_local_path || null,
      data.theme_id || null,
      data.level || 1,
      data.menu_json,
      data.cached_at || Date.now()
    )
  },

  updateLocalPath(localPath) {
    getDb()
      .prepare('UPDATE restaurant_cache SET img_local_path = ? WHERE id = 1')
      .run(localPath)
  },

  clear() {
    getDb().prepare('DELETE FROM restaurant_cache WHERE id = 1').run()
  }
}
