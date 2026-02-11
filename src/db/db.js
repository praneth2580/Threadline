import Database from "better-sqlite3";
import path from "path";
import os from "os";

const appDir = path.join(os.homedir(), ".threadline");
const dbPath = path.join(appDir, "threadline.db");

const db = new Database(dbPath);

// Initialize tables — aligned with Threadline: social accounts + connection graph
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    platform TEXT NOT NULL,
    profile_url TEXT,
    last_scraped_timestamp INTEGER,
    first_scraped_timestamp INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username, platform)
  );

  CREATE TABLE IF NOT EXISTS relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_account_id INTEGER NOT NULL,
    destination_account_id INTEGER NOT NULL,
    last_scraped_timestamp INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(source_account_id) REFERENCES accounts(id),
    FOREIGN KEY(destination_account_id) REFERENCES accounts(id),
    UNIQUE(source_account_id, destination_account_id)
  );

  CREATE TABLE IF NOT EXISTS connected_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id_1 INTEGER NOT NULL,
    account_id_2 INTEGER NOT NULL,
    link_type TEXT CHECK(link_type IN ('same_person', 'alt', '')),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(account_id_1) REFERENCES accounts(id),
    FOREIGN KEY(account_id_2) REFERENCES accounts(id),
    UNIQUE(account_id_1, account_id_2),
    CHECK(account_id_1 < account_id_2)
  );
`);

/**
 * List table names for the DB browser (user tables only).
 * @returns {string[]}
 */
export function getTableNames() {
  const rows = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  ).all();
  return rows.map((r) => r.name);
}

/**
 * Query a table with optional search across all columns.
 * @param {string} tableName - must be one of getTableNames()
 * @param {string} [search] - optional search term (LIKE %term% on each column)
 * @returns {{ columns: string[], rows: Record<string, unknown>[] }}
 */
export function queryTable(tableName, search) {
  const allowed = getTableNames();
  if (!allowed.includes(tableName)) {
    throw new Error("Invalid table name");
  }
  const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const columns = info.map((c) => c.name);
  const term = typeof search === "string" && search.trim() ? `%${search.trim()}%` : null;
  let rows;
  if (term) {
    const conditions = columns.map((col) => `CAST(${col} AS TEXT) LIKE ?`).join(" OR ");
    const stmt = db.prepare(`SELECT * FROM ${tableName} WHERE ${conditions}`);
    rows = stmt.all(...columns.map(() => term));
  } else {
    rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  }
  return { columns, rows };
}

/**
 * Delete a row from a table.
 * @param {string} tableName - must be one of getTableNames()
 * @param {string} pkName - primary key column name
 * @param {string|number} pkValue - value of the primary key to match
 */
export function deleteRow(tableName, pkName, pkValue) {
  const allowed = getTableNames();
  if (!allowed.includes(tableName)) {
    throw new Error("Invalid table name");
  }
  // Sanitize pkName (must be one of the table's columns)
  const info = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!info.map((c) => c.name).includes(pkName)) {
    throw new Error("Invalid primary key column");
  }

  const stmt = db.prepare(`DELETE FROM ${tableName} WHERE ${pkName} = ?`);
  return stmt.run(pkValue);
}

export default db;
