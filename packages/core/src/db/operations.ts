import { getDb } from "./client";
import type { Article, ArticleRow, PendingTaskNotification } from "./types";
import { rowToArticle } from "./types";

// === Article operations ===

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
  return (result.rows as unknown as ArticleRow[]).map(rowToArticle);
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
  return (result.rows as unknown as ArticleRow[]).map(rowToArticle);
}

export async function getArticleByUrl(url: string): Promise<Article | null> {
  const db = await getDb();
  const result = await db.execute({
    sql: "SELECT * FROM articles WHERE url = ?",
    args: [url],
  });
  const row = result.rows[0] as unknown as ArticleRow | undefined;
  return row ? rowToArticle(row) : null;
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
  return (result.rows as unknown as ArticleRow[]).map(rowToArticle);
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
 * Get articles that are notified but don't have detailed summaries yet
 * Used by background job to generate missing summaries
 */
export async function getArticlesWithoutDetailedSummary(limit: number = 10): Promise<Article[]> {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT * FROM articles
      WHERE detailed_summary IS NULL
        AND notified = 1
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return (result.rows as unknown as ArticleRow[]).map(rowToArticle);
}

// === Task notification operations ===

/**
 * Register a task for notification when it completes
 */
export async function registerTaskNotification(
  taskId: string,
  channelId: string,
  messageId: string
) {
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
