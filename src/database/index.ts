import Database from "@tauri-apps/plugin-sql";

// The single database connection, set once during initialization.
let db: Database | null = null;

/**
 * Initializes the SQLite database and runs any pending migrations.
 * The tasks table is created by the Rust migration registered in lib.rs.
 * Safe to call multiple times — returns the existing connection on repeat calls.
 */
export async function initDatabase(): Promise<Database> {
  if (db !== null) {
    return db;
  }

  try {
    db = await Database.load("sqlite:tasks.db");
    console.info("[db] Database initialized successfully.");
    return db;
  } catch (err) {
    console.error("[db] Failed to initialize database:", err);
    throw err;
  }
}

/**
 * Returns the active database connection.
 * Must be called after initDatabase() has resolved.
 */
export function getDatabase(): Database {
  if (db === null) {
    throw new Error(
      "[db] Database has not been initialized. Call initDatabase() first."
    );
  }
  return db;
}
