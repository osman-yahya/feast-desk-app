/**
 * Initial migration — creates all tables
 */
export default function migrate(db) {
  db.exec(`
    -- Restaurant cache (always row id=1)
    CREATE TABLE IF NOT EXISTS restaurant_cache (
      id              INTEGER PRIMARY KEY,
      restaurant_id   TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      img_url         TEXT,
      img_local_path  TEXT,
      theme_id        INTEGER,
      level           INTEGER NOT NULL DEFAULT 1,
      menu_json       TEXT NOT NULL,
      cached_at       INTEGER NOT NULL
    );

    -- Floors
    CREATE TABLE IF NOT EXISTS floors (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL DEFAULT 'Floor 1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    -- Tables
    CREATE TABLE IF NOT EXISTS tables (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id   INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
      name       TEXT NOT NULL,
      grid_col   INTEGER NOT NULL,
      grid_row   INTEGER NOT NULL,
      width      INTEGER NOT NULL DEFAULT 2,
      height     INTEGER NOT NULL DEFAULT 2,
      status     TEXT NOT NULL DEFAULT 'empty'
                 CHECK(status IN ('empty','occupied','checkout_pending')),
      created_at INTEGER NOT NULL
    );

    -- Floor decorative elements (walls, labels)
    CREATE TABLE IF NOT EXISTS floor_elements (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      floor_id   INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
      type       TEXT NOT NULL CHECK(type IN ('wall','label')),
      grid_col   INTEGER NOT NULL,
      grid_row   INTEGER NOT NULL,
      width      INTEGER NOT NULL DEFAULT 1,
      height     INTEGER NOT NULL DEFAULT 1,
      angle      INTEGER NOT NULL DEFAULT 0,
      label_text TEXT,
      created_at INTEGER NOT NULL
    );

    -- Orders (table_id NULL = direct order)
    CREATE TABLE IF NOT EXISTS orders (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      table_id    INTEGER REFERENCES tables(id) ON DELETE SET NULL,
      status      TEXT NOT NULL DEFAULT 'open'
                  CHECK(status IN ('open','checkout_pending','paid','deleted')),
      opened_at   INTEGER NOT NULL,
      closed_at   INTEGER,
      deleted_at  INTEGER,
      checkout_id INTEGER REFERENCES checkouts(id)
    );

    -- Order items
    CREATE TABLE IF NOT EXISTS order_items (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      menu_item_id    TEXT NOT NULL,
      menu_item_name  TEXT NOT NULL,
      category_name   TEXT,
      unit_price      REAL NOT NULL,
      quantity        INTEGER NOT NULL DEFAULT 1,
      is_free         INTEGER NOT NULL DEFAULT 0 CHECK(is_free IN (0,1)),
      is_paid_partial INTEGER NOT NULL DEFAULT 0 CHECK(is_paid_partial IN (0,1)),
      discount_pct    REAL,
      note            TEXT,
      added_at        INTEGER NOT NULL
    );

    -- Checkouts (billing records — historical)
    CREATE TABLE IF NOT EXISTS checkouts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id       INTEGER NOT NULL,
      table_name     TEXT,
      subtotal       REAL NOT NULL,
      discount_total REAL NOT NULL DEFAULT 0,
      grand_total    REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      paid_at        INTEGER NOT NULL,
      cashier_note   TEXT,
      items_snapshot TEXT NOT NULL
    );

    -- Predefined discounts
    CREATE TABLE IF NOT EXISTS predefined_discounts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT NOT NULL,
      pct        REAL NOT NULL CHECK(pct >= 0 AND pct <= 100),
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    -- Settings key-value store
    CREATE TABLE IF NOT EXISTS settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_orders_table    ON orders(table_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_ord ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_checkouts_date  ON checkouts(paid_at);
    CREATE INDEX IF NOT EXISTS idx_tables_floor    ON tables(floor_id);
  `)

  // Seed default settings
  const now = Date.now()
  const defaults = [
    ['data_retention_days', '90'],
    ['settings_password', ''],
    ['server_port', '3737'],
    ['server_enabled', 'false'],
    ['connected', 'false'],
    ['restaurant_id', ''],
    ['currency_symbol', '₺'],
    ['menu_display_mode', 'grid']
  ]
  const insertSetting = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  )
  for (const [key, value] of defaults) {
    insertSetting.run(key, value, now)
  }
}
