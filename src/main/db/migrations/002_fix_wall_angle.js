/**
 * Recreates floor_elements without the restrictive angle CHECK,
 * and normalises any stored angle values to 0 or 90.
 */
export default function migrate(db) {
  db.exec(`
    -- Create replacement table with relaxed angle constraint
    CREATE TABLE IF NOT EXISTS floor_elements_v2 (
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

    -- Copy existing rows, mapping any angle that isn't 0 or 90 to 0
    INSERT INTO floor_elements_v2
      SELECT id, floor_id, type, grid_col, grid_row, width, height,
             CASE WHEN angle = 90 THEN 90 ELSE 0 END,
             label_text, created_at
      FROM floor_elements;

    DROP TABLE floor_elements;
    ALTER TABLE floor_elements_v2 RENAME TO floor_elements;

    CREATE INDEX IF NOT EXISTS idx_floor_elements_floor ON floor_elements(floor_id);
  `)
}
