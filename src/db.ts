import { Database } from "bun:sqlite";
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

let db: Database;
let currentDbPath: string = DEFAULT_DB_PATH;

/**
 * Initialize database with optional custom path (for testing)
 */
export function ensureDb(dbPath?: string) {
  // Close existing connection if any
  if (db) {
    try {
      db.close();
    } catch {
      // Ignore close errors
    }
  }
  currentDbPath = dbPath || DEFAULT_DB_PATH;
  db = new Database(currentDbPath);

  db.exec(`
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
    );

    CREATE INDEX IF NOT EXISTS idx_url ON articles(url);
    CREATE INDEX IF NOT EXISTS idx_created ON articles(created_at);
    CREATE INDEX IF NOT EXISTS idx_notified ON articles(notified);

    CREATE TABLE IF NOT EXISTS pending_task_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT UNIQUE NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notified_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_task_id ON pending_task_notifications(task_id);
    CREATE INDEX IF NOT EXISTS idx_pending ON pending_task_notifications(notified_at);
  `);

  // Migration: Add new columns to existing tables
  const columns = db.query("PRAGMA table_info(articles)").all() as { name: string }[];
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes("detailed_summary")) {
    db.exec("ALTER TABLE articles ADD COLUMN detailed_summary TEXT");
  }
  if (!columnNames.includes("key_points")) {
    db.exec("ALTER TABLE articles ADD COLUMN key_points TEXT");
  }
  if (!columnNames.includes("target_audience")) {
    db.exec("ALTER TABLE articles ADD COLUMN target_audience TEXT");
  }

  return db;
}

export function getDb() {
  if (!db) ensureDb();
  return db;
}

export function isArticleSeen(url: string): boolean {
  const row = getDb().query("SELECT 1 FROM articles WHERE url = ?").get(url);
  return !!row;
}

export function saveArticle(article: Omit<Article, "id" | "created_at">) {
  const stmt = getDb().query(`
    INSERT OR IGNORE INTO articles (url, title, source, category, summary, detailed_summary, key_points, target_audience, score, published_at, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
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
    article.notified ? 1 : 0
  );
}

export function markAsNotified(urls: string[]) {
  const stmt = getDb().query("UPDATE articles SET notified = 1 WHERE url = ?");
  for (const url of urls) {
    stmt.run(url);
  }
}

export function getRecentArticles(hours: number = 24): Article[] {
  return getDb().query(`
    SELECT * FROM articles
    WHERE created_at > datetime('now', '-' || ? || ' hours')
    ORDER BY created_at DESC
  `).all(hours) as Article[];
}

export function getArticlesWithDetailedSummary(limit: number = 50): Article[] {
  return getDb().query(`
    SELECT * FROM articles
    WHERE detailed_summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Article[];
}

export function getArticleByUrl(url: string): Article | null {
  return getDb().query(`
    SELECT * FROM articles WHERE url = ?
  `).get(url) as Article | null;
}

export function updateArticleDetailedSummary(
  url: string,
  detailedSummary: string,
  keyPoints: string[],
  targetAudience?: string
) {
  const stmt = getDb().query(`
    UPDATE articles
    SET detailed_summary = ?, key_points = ?, target_audience = ?
    WHERE url = ?
  `);
  return stmt.run(
    detailedSummary,
    JSON.stringify(keyPoints),
    targetAudience || null,
    url
  );
}

/**
 * Close database connection (for testing cleanup)
 */
export function closeDb() {
  if (db) {
    db.close();
    db = undefined!;
  }
}

// === Task notification functions ===

/**
 * Register a task for notification when it completes
 */
export function registerTaskNotification(taskId: string, channelId: string, messageId: string) {
  const stmt = getDb().query(`
    INSERT OR REPLACE INTO pending_task_notifications (task_id, channel_id, message_id, created_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
  return stmt.run(taskId, channelId, messageId);
}

/**
 * Get all pending task notifications (not yet notified)
 */
export function getPendingTaskNotifications(): PendingTaskNotification[] {
  return getDb().query(`
    SELECT * FROM pending_task_notifications
    WHERE notified_at IS NULL
    ORDER BY created_at ASC
  `).all() as PendingTaskNotification[];
}

/**
 * Mark a task notification as sent
 */
export function markTaskNotified(taskId: string) {
  const stmt = getDb().query(`
    UPDATE pending_task_notifications
    SET notified_at = CURRENT_TIMESTAMP
    WHERE task_id = ?
  `);
  return stmt.run(taskId);
}

/**
 * Get a specific pending notification by task ID
 */
export function getTaskNotification(taskId: string): PendingTaskNotification | null {
  return getDb().query(`
    SELECT * FROM pending_task_notifications
    WHERE task_id = ?
  `).get(taskId) as PendingTaskNotification | null;
}

/**
 * Clean up old notified tasks (older than specified days)
 */
export function cleanupOldTaskNotifications(daysOld: number = 7) {
  const stmt = getDb().query(`
    DELETE FROM pending_task_notifications
    WHERE notified_at IS NOT NULL
    AND notified_at < datetime('now', '-' || ? || ' days')
  `);
  return stmt.run(daysOld);
}
