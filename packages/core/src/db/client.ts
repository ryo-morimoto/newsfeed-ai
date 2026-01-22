import { createClient, type Client } from "@libsql/client";
import type { DbConfig } from "./types";

let client: Client | null = null;
let initialized = false;
let currentConfig: DbConfig | null = null;

/**
 * Initialize database connection
 * Uses Turso if configured, otherwise falls back to local SQLite
 */
export async function ensureDb(config: DbConfig = {}): Promise<Client> {
  // If already initialized with same config, return existing client
  if (client && initialized && !hasConfigChanged(config)) {
    return client;
  }

  // Close existing connection if any
  if (client) {
    client.close();
    client = null;
  }

  const tursoUrl = config.tursoUrl || process.env.TURSO_DATABASE_URL;
  const tursoToken = config.tursoToken || process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // Use Turso (remote libSQL)
    client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    console.log("[db] Connected to Turso");
  } else {
    // Fall back to local SQLite file
    const dbPath = config.dbPath || process.env.DB_PATH;
    if (!dbPath) {
      throw new Error(
        "Database path not configured. Set DB_PATH environment variable or pass dbPath in config."
      );
    }
    client = createClient({
      url: `file:${dbPath}`,
    });
    console.log(`[db] Using local SQLite: ${dbPath}`);
  }

  // Create tables
  await client.execute(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT,
      detailed_summary TEXT,
      key_points TEXT,
      target_audience TEXT,
      score REAL,
      published_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notified INTEGER DEFAULT 0
    )
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_url ON articles(url)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_created ON articles(created_at)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_notified ON articles(notified)`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS pending_task_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notified_at TEXT
    )
  `);

  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_task_id ON pending_task_notifications(task_id)`
  );
  await client.execute(
    `CREATE INDEX IF NOT EXISTS idx_pending ON pending_task_notifications(notified_at)`
  );

  // Search index table for Orama persistence (used by Workers)
  await client.execute(`
    CREATE TABLE IF NOT EXISTS search_index (
      id TEXT PRIMARY KEY DEFAULT 'default',
      data BLOB NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration: Add new columns to existing tables (ignore errors if columns exist)
  const migrations = [
    "ALTER TABLE articles ADD COLUMN detailed_summary TEXT",
    "ALTER TABLE articles ADD COLUMN key_points TEXT",
    "ALTER TABLE articles ADD COLUMN target_audience TEXT",
    "ALTER TABLE articles ADD COLUMN og_image TEXT",
  ];

  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch (error) {
      // Only ignore "duplicate column" errors, re-throw others
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("duplicate column") && !message.includes("already exists")) {
        console.error(`[db] Migration failed: ${sql}`, error);
        throw error;
      }
    }
  }

  initialized = true;
  currentConfig = config;
  return client;
}

export async function getDb(): Promise<Client> {
  if (!client || !initialized) {
    throw new Error("Database not initialized. Call ensureDb() first.");
  }
  return client;
}

/**
 * Close database connection
 */
export function closeDb(): void {
  if (client) {
    client.close();
    client = null;
    initialized = false;
    currentConfig = null;
  }
}

function hasConfigChanged(newConfig: DbConfig): boolean {
  if (!currentConfig) return true;
  return (
    currentConfig.dbPath !== newConfig.dbPath ||
    currentConfig.tursoUrl !== newConfig.tursoUrl ||
    currentConfig.tursoToken !== newConfig.tursoToken
  );
}
