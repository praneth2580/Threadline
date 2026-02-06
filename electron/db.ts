import Database from "better-sqlite3"
import path from "path"
import { log } from "./logger"

let db: Database.Database | null = null

/**
 * Initialize the SQLite database. Call once from main process with userData path.
 */
export function initDb(userDataPath: string): Database.Database {
  if (db) {
    log("db", "initDb: already initialized")
    return db
  }

  const dbPath = path.join(userDataPath, "threadline.db")
  log("db", "initDb: opening", dbPath)
  db = new Database(dbPath)

  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")
  log("db", "initDb: running migrations")
  runMigrations(db)
  log("db", "initDb: done")
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.")
  return db
}

const TABLE_COLUMNS: Record<string, string[]> = {
  users: ["id", "platform", "external_id", "username", "display_name", "avatar_url", "fetched_at", "created_at"],
  edges: ["id", "from_user_id", "to_user_id", "created_at"],
}

const SEARCH_COLUMNS: Record<string, string[]> = {
  users: ["platform", "external_id", "username", "display_name"],
  edges: ["from_user_id", "to_user_id"],
}

export function getTableNames(): string[] {
  log("db", "getTableNames")
  const database = getDb()
  const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]
  const names = rows.map((r) => r.name)
  log("db", "getTableNames: result =", names)
  return names
}

export function queryTable(
  tableName: string,
  search?: string
): { columns: string[]; rows: Record<string, unknown>[] } {
  log("db", "queryTable:", tableName, "search =", search ?? "(none)")
  const database = getDb()
  const columns = TABLE_COLUMNS[tableName]
  if (!columns) {
    log("db", "queryTable: unknown table", tableName)
    throw new Error(`Unknown table: ${tableName}`)
  }
  const searchCols = SEARCH_COLUMNS[tableName] ?? []
  const colList = columns.join(", ")
  let sql = `SELECT ${colList} FROM ${tableName}`
  const params: unknown[] = []
  if (search != null && search.trim() !== "" && searchCols.length > 0) {
    const conditions = searchCols.map((c) => `CAST(${c} AS TEXT) LIKE ?`)
    params.push(...searchCols.map(() => `%${search.trim()}%`))
    sql += ` WHERE ${conditions.join(" OR ")}`
  }
  sql += " ORDER BY id LIMIT 500"
  const stmt = database.prepare(sql)
  const rows = stmt.all(...params) as Record<string, unknown>[]
  log("db", "queryTable: rows =", rows.length)
  return { columns, rows }
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    -- User nodes (profiles from a platform)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      external_id TEXT NOT NULL,
      username TEXT,
      display_name TEXT,
      avatar_url TEXT,
      fetched_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(platform, external_id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_platform_external
      ON users(platform, external_id);

    -- Relationship edges (who follows whom)
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(from_user_id, to_user_id),
      CHECK (from_user_id != to_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_user_id);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_user_id);
  `)
}
