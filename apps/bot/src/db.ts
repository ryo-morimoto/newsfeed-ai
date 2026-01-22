/**
 * Database module for the bot application
 * Re-exports everything from @newsfeed-ai/core/db with bot-specific defaults
 */
import { db, paths } from "@newsfeed-ai/core";

// Re-export types
export type { Article, PendingTaskNotification, DbConfig } from "@newsfeed-ai/core";

// Re-export operations (they use getDb internally)
export {
  isArticleSeen,
  saveArticle,
  markAsNotified,
  getRecentArticles,
  getArticlesWithDetailedSummary,
  getArticlesWithoutDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing,
  updateArticleDetailedSummary,
  registerTaskNotification,
  getPendingTaskNotifications,
  markTaskNotified,
  getTaskNotification,
  cleanupOldTaskNotifications,
} from "@newsfeed-ai/core/db";

// Re-export closeDb
export { closeDb } from "@newsfeed-ai/core/db";

/**
 * Initialize database with bot-specific defaults
 * Uses paths.database for local SQLite path
 */
export async function ensureDb(dbPath?: string) {
  return db.ensureDb({
    dbPath: dbPath || paths.database,
  });
}

/**
 * Get the database client (must call ensureDb first)
 */
export async function getDb() {
  return db.getDb();
}
