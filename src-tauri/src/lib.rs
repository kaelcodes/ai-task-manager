use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // NOTE: migration 1's SQL text must remain byte-for-byte identical to its
    // original release — tauri-plugin-sql/sqlx checksums the SQL string
    // (whitespace included). Re-indenting it changes the checksum and breaks
    // existing databases with "migration 1 ... has been modified". Keep the
    // original 12-space indentation; add new work only as later versions.
    let migration_v1 = Migration {
        version: 1,
        description: "create_tasks_table",
        sql: "CREATE TABLE IF NOT EXISTS tasks (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            title              TEXT    NOT NULL,
            description        TEXT,
            priority           TEXT,
            status             TEXT,
            category           TEXT,
            deadline           TEXT,
            estimated_duration INTEGER,
            created_at         TEXT    NOT NULL,
            completed_at       TEXT
        );",
        kind: MigrationKind::Up,
    };

    let migration_v2 = Migration {
        version: 2,
        description: "create_settings_table",
        // Additive key/value store for user preferences (Module 7).
        // Does not touch the existing tasks table.
        sql: "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
        kind: MigrationKind::Up,
    };

    let migrations = vec![migration_v1, migration_v2];

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_keyring::init())
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:tasks.db", migrations)
                .build(),
        )
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::save_api_key,
            commands::get_api_key_status,
            commands::delete_api_key,
            commands::chat,
            commands::import_tasks,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
