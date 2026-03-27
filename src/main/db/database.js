import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db = null

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.')
  return db
}

export async function initDatabase() {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

  const dbPath = join(dbDir, 'feast.db')
  db = new Database(dbPath)

  // WAL mode for crash safety and concurrent reads
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  await runMigrations(db)
  return db
}

async function runMigrations(database) {
  // Create migrations tracking table
  database.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      ran_at INTEGER NOT NULL
    )
  `)

  const migrations = [
    { name: '001_init', run: (await import('./migrations/001_init.js')).default },
    { name: '002_fix_wall_angle', run: (await import('./migrations/002_fix_wall_angle.js')).default }
  ]

  for (const migration of migrations) {
    const already = database.prepare('SELECT id FROM _migrations WHERE name = ?').get(migration.name)
    if (!already) {
      migration.run(database)
      database.prepare('INSERT INTO _migrations (name, ran_at) VALUES (?, ?)').run(migration.name, Date.now())
      console.log(`✅ Migration ${migration.name} applied`)
    }
  }
}
