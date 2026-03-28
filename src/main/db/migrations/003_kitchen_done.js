/**
 * Adds kitchen_done_at column to orders table so kitchen "done" state
 * persists across reconnects and page refreshes.
 */
export default function migrate(db) {
  db.exec(`ALTER TABLE orders ADD COLUMN kitchen_done_at INTEGER DEFAULT NULL`)
}
