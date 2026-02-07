#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::Manager;

/// Guard that kills the scraper process when dropped (app exit).
struct ScraperProcess(pub Child);

impl Drop for ScraperProcess {
    fn drop(&mut self) {
        let _ = self.0.kill();
    }
}

/// Resolve path to scraper entry (apps/scraper/src/index.js).
/// In dev: relative to workspace root (parent of src-tauri).
fn scraper_entry_path() -> Option<(PathBuf, PathBuf)> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR").ok()?;
    let manifest = PathBuf::from(manifest_dir);
    // src-tauri -> project root
    let root = manifest.parent()?.parent()?;
    let scraper_dir = root.join("apps").join("scraper");
    let entry = scraper_dir.join("src").join("index.js");
    if entry.exists() {
        Some((scraper_dir, entry))
    } else {
        None
    }
}

/// Spawn the Node.js scraper process. Returns None if path not found (e.g. production bundle).
fn spawn_scraper() -> Option<ScraperProcess> {
    let (scraper_dir, entry) = scraper_entry_path()?;
    let child = Command::new("node")
        .arg(entry)
        .current_dir(scraper_dir)
        .spawn()
        .ok()?;
    Some(ScraperProcess(child))
}

/// Proxy HTTP request to the scraper (127.0.0.1:3000).
#[tauri::command]
async fn scraper_request(method: String, path: String, body: Option<String>) -> Result<String, String> {
    let url = format!("http://127.0.0.1:3000{}", path);
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => return Err(format!("Unsupported method: {}", method)),
    };
    if let Some(b) = body {
        req = req.body(b).header("Content-Type", "application/json");
    }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    let text = resp.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

/// Database state for SQLite (path and simple access).
struct DbState(Mutex<Option<rusqlite::Connection>>);

fn init_db(app_handle: &tauri::AppHandle) -> Result<rusqlite::Connection, String> {
    let app_data = tauri::api::path::app_data_dir(&app_handle.config())
        .ok_or("app data dir not available")?;
    std::fs::create_dir_all(&app_data).map_err(|e| e.to_string())?;
    let db_path = app_data.join("threadline.db");
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            platform TEXT NOT NULL,
            profile_url TEXT,
            last_scraped_timestamp INTEGER,
            first_scraped_timestamp INTEGER,
            UNIQUE(username, platform)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS relations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_account_id INTEGER NOT NULL,
            destination_account_id INTEGER NOT NULL,
            last_scraped_timestamp INTEGER,
            first_scraped_timestamp INTEGER,
            FOREIGN KEY (source_account_id) REFERENCES accounts(id),
            FOREIGN KEY (destination_account_id) REFERENCES accounts(id)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS connected_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id_1 INTEGER NOT NULL,
            account_id_2 INTEGER NOT NULL,
            last_scraped_timestamp INTEGER,
            first_scraped_timestamp INTEGER,
            FOREIGN KEY (account_id_1) REFERENCES accounts(id),
            FOREIGN KEY (account_id_2) REFERENCES accounts(id),
            UNIQUE(account_id_1, account_id_2)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Legacy graph tables (for UI force-graph)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS nodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS edges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER NOT NULL,
            target_id INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (source_id) REFERENCES nodes(id),
            FOREIGN KEY (target_id) REFERENCES nodes(id)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    Ok(conn)
}

fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[tauri::command]
fn db_upsert_account(
    username: String,
    platform: String,
    profile_url: Option<String>,
    db_state: tauri::State<DbState>,
) -> Result<i64, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    let now = unix_now();
    conn.execute(
        "INSERT INTO accounts (username, platform, profile_url, last_scraped_timestamp, first_scraped_timestamp)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(username, platform) DO UPDATE SET
           profile_url = excluded.profile_url,
           last_scraped_timestamp = excluded.last_scraped_timestamp",
        rusqlite::params![username, platform, profile_url, now, now],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    let id = if id > 0 {
        id
    } else {
        conn.query_row(
            "SELECT id FROM accounts WHERE username = ?1 AND platform = ?2",
            rusqlite::params![username, platform],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?
    };
    Ok(id)
}

#[tauri::command]
fn db_get_accounts(db_state: tauri::State<DbState>) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    run_select(conn, "SELECT id, username, platform, profile_url, last_scraped_timestamp, first_scraped_timestamp FROM accounts ORDER BY id")
}

#[tauri::command]
fn db_upsert_relation(
    source_account_id: i64,
    destination_account_id: i64,
    db_state: tauri::State<DbState>,
) -> Result<i64, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    let now = unix_now();
    conn.execute(
        "INSERT INTO relations (source_account_id, destination_account_id, last_scraped_timestamp, first_scraped_timestamp)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![source_account_id, destination_account_id, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn db_get_relations(db_state: tauri::State<DbState>) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    run_select(conn, "SELECT id, source_account_id, destination_account_id, last_scraped_timestamp, first_scraped_timestamp FROM relations ORDER BY id")
}

#[tauri::command]
fn db_upsert_connected_account(
    account_id_1: i64,
    account_id_2: i64,
    db_state: tauri::State<DbState>,
) -> Result<i64, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    let now = unix_now();
    let (a, b) = if account_id_1 <= account_id_2 {
        (account_id_1, account_id_2)
    } else {
        (account_id_2, account_id_1)
    };
    conn.execute(
        "INSERT INTO connected_accounts (account_id_1, account_id_2, last_scraped_timestamp, first_scraped_timestamp)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(account_id_1, account_id_2) DO UPDATE SET
           last_scraped_timestamp = excluded.last_scraped_timestamp",
        rusqlite::params![a, b, now, now],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn db_get_connected_accounts(db_state: tauri::State<DbState>) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    run_select(conn, "SELECT id, account_id_1, account_id_2, last_scraped_timestamp, first_scraped_timestamp FROM connected_accounts ORDER BY id")
}

#[tauri::command]
fn db_execute(
    sql: String,
    db_state: tauri::State<DbState>,
) -> Result<(), String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    conn.execute(&sql, []).map_err(|e| e.to_string())?;
    Ok(())
}

fn value_to_string(v: &rusqlite::types::Value) -> String {
    use rusqlite::types::Value;
    match v {
        Value::Null => String::new(),
        Value::Integer(i) => i.to_string(),
        Value::Real(f) => f.to_string(),
        Value::Text(s) => s.clone(),
        Value::Blob(_) => String::new(),
    }
}

fn run_select(
    conn: &rusqlite::Connection,
    sql: &str,
) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let column_count = stmt.column_count();
    let column_names: Vec<String> = (0..column_count)
        .map(|i| stmt.column_name(i).unwrap_or("").to_string())
        .collect();
    let rows = stmt
        .query_map([], |row| {
            let mut map = std::collections::HashMap::new();
            for (i, name) in column_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get(i).unwrap_or(rusqlite::types::Value::Null);
                map.insert(name.clone(), value_to_string(&val));
            }
            Ok(map)
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
fn db_query(
    sql: String,
    db_state: tauri::State<DbState>,
) -> Result<Vec<std::collections::HashMap<String, String>>, String> {
    let guard = db_state.0.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("DB not initialized")?;
    run_select(conn, &sql)
}

fn main() {
    let scraper_guard = spawn_scraper();

    tauri::Builder::default()
        .manage(DbState(Mutex::new(None)))
        .setup(|app| {
            match init_db(&app.handle()) {
                Ok(conn) => {
                    if let Some(state) = app.try_state::<DbState>() {
                        if let Ok(mut guard) = state.0.lock() {
                            *guard = Some(conn);
                        }
                    }
                }
                Err(e) => eprintln!("DB init warning: {}", e),
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            scraper_request,
            db_execute,
            db_query,
            db_upsert_account,
            db_get_accounts,
            db_upsert_relation,
            db_get_relations,
            db_upsert_connected_account,
            db_get_connected_accounts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // When run() returns, app is exiting. Scraper guard is dropped and process is killed.
    drop(scraper_guard);
}
