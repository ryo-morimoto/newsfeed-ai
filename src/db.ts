import { createClient, type Client } from "@libsql/client";
import { join } from "path";

const DEFAULT_DB_PATH = join(import.meta.dir, "..", "data", "history.db");

export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  detailed_summary?: string;
  key_points?: string; // JSON array stored as string
  target_audience?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  notified: number;
}

export interface PendingTaskNotification {
  id?: number;
  task_id: string;
  channel_id: string;
  message_id: string;
  created_at?: string;
  notified_at?: string;
}

let client: Client;
let initialized = false;

/**
 * Initialize database connection
 * Uses Turso if TURSO_DATABASE_URL is set, otherwise falls back to local SQLite
 */
export async function ensureDb(dbPath?: string): Promise<Client> {
  if (client && initialized && !dbPath) {
    return client;
  }

  // Close existing connection if any
  if (client) {
    client.close();
  }

  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    // Use Turso (remote libSQL)
    client = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    });
    console.log("[db] Connected to Turso");
  } else {
    // Fall back to local SQLite file
    const localPath = dbPath || DEFAULT_DB_PATH;
    client = createClient({
      url: `file:${localPath}`,
    });
    console.log(`[db] Using local SQLite: ${localPath}`);
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

  await client.execute(`CREATE INDEX IF NOT EXISTS idx_task_id ON pending_task_notifications(task_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_pending ON pending_task_notifications(notified_at)`);

  // Migration: Add new columns to existing tables (ignore errors if columns exist)
  const migrations = [
    "ALTER TABLE articles ADD COLUMN detailed_summary TEXT",
    "ALTER TABLE articles ADD COLUMN key_points TEXT",
    "ALTER TABLE articles ADD COLUMN target_audience TEXT",
  ];

  for (const sql of migrations) {
    try {
      await client.execute(sql);
    } catch {
      // Column already exists, ignore
    }
  }

  initialized = true;
  return client;
}

export async function getDb(): Promise<Client> {
  if (!client || !initialized) {
    await ensureDb();
  }
  return client;
}

export async function isArticleSeen(url: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT 1 FROM articles WHERE url = ?",
    args: [url],
  });
  return result.rows.length > 0;
}

export async function saveArticle(article: Omit<Article, "id" | "created_at">) {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      INSERT OR IGNORE INTO articles (url, title, source, category, summary, detailed_summary, key_points, target_audience, score, published_at, notified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      article.url,
      article.title,
      article.source,
      article.category,
      article.summary || null,
      article.detailed_summary || null,
      article.key_points || null,
      article.target_audience || null,
      article.score || null,
      article.published_at || null,
      article.notified ? 1 : 0,
    ],
  });

  // Sync to Orama search index if article was inserted (skip in tests)
  if (result.rowsAffected > 0 && !process.env.SKIP_SEARCH_INDEX) {
    try {
      const { addArticleToIndex } = await import("./search/search-service");
      const saved = await getArticleByUrl(article.url);
      if (saved) {
        await addArticleToIndex(saved);
      }
    } catch (error) {
      // Search index sync is not critical, log and continue
      console.warn("[db] Failed to sync article to search index:", error);
    }
  }

  return result;
}

export async function markAsNotified(urls: string[]) {
  const db = await getDb();
  for (const url of urls) {
    await db.execute({
      sql: "UPDATE articles SET notified = 1 WHERE url = ?",
      args: [url],
    });
  }
}

export async function getRecentArticles(hours: number = 24): Promise<Article[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT * FROM articles
      WHERE created_at > datetime('now', '-' || ? || ' hours')
      ORDER BY created_at DESC
    `,
    args: [hours],
  });
  return result.rows as unknown as Article[];
}

export async function getArticlesWithDetailedSummary(limit: number = 50): Promise<Article[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT * FROM articles
      WHERE detailed_summary IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows as unknown as Article[];
}

export async function getArticleByUrl(url: string): Promise<Article | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM articles WHERE url = ?",
    args: [url],
  });
  return (result.rows[0] as unknown as Article) || null;
}

/**
 * Get all articles for search indexing
 */
export async function getAllArticlesForIndexing(): Promise<Article[]> {
  const db = await getDb();
  const result = await db.execute(`
    SELECT * FROM articles
    ORDER BY created_at DESC
  `);
  return result.rows as unknown as Article[];
}

export async function updateArticleDetailedSummary(
  url: string,
  detailedSummary: string,
  keyPoints: string[],
  targetAudience?: string
) {
  const db = await getDb();
  return db.execute({
    sql: `
      UPDATE articles
      SET detailed_summary = ?, key_points = ?, target_audience = ?
      WHERE url = ?
    `,
    args: [detailedSummary, JSON.stringify(keyPoints), targetAudience || null, url],
  });
}

/**
 * Close database connection (for testing cleanup)
 */
export function closeDb() {
  if (client) {
    client.close();
    initialized = false;
  }
}

// === Task notification functions ===

/**
 * Register a task for notification when it completes
 */
export async function registerTaskNotification(taskId: string, channelId: string, messageId: string) {
  const db = await getDb();
  return db.execute({
    sql: `
      INSERT OR REPLACE INTO pending_task_notifications (task_id, channel_id, message_id, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `,
    args: [taskId, channelId, messageId],
  });
}

/**
 * Get all pending task notifications (not yet notified)
 */
export async function getPendingTaskNotifications(): Promise<PendingTaskNotification[]> {
  const db = await getDb();
  const result = await db.execute(`
    SELECT * FROM pending_task_notifications
    WHERE notified_at IS NULL
    ORDER BY created_at ASC
  `);
  return result.rows as unknown as PendingTaskNotification[];
}

/**
 * Mark a task notification as sent
 */
export async function markTaskNotified(taskId: string) {
  const db = await getDb();
  return db.execute({
    sql: `
      UPDATE pending_task_notifications
      SET notified_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `,
    args: [taskId],
  });
}

/**
 * Get a specific pending notification by task ID
 */
export async function getTaskNotification(taskId: string): Promise<PendingTaskNotification | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM pending_task_notifications WHERE task_id = ?",
    args: [taskId],
  });
  return (result.rows[0] as unknown as PendingTaskNotification) || null;
}

/**
 * Clean up old notified tasks (older than specified days)
 */
export async function cleanupOldTaskNotifications(daysOld: number = 7) {
  const db = await getDb();
  return db.execute({
    sql: `
      DELETE FROM pending_task_notifications
      WHERE notified_at IS NOT NULL
      AND notified_at < datetime('now', '-' || ? || ' days')
    `,
    args: [daysOld],
  });
}
