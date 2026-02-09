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

export default db;
