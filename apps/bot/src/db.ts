/**
 * Database module for the bot application
 * Re-exports everything from @newsfeed-ai/core/db with bot-specific defaults
 */
import "./adapters/db-adapter";
import * as db from "@newsfeed-ai/core/db";

// Default database path (relative to monorepo root)
const DEFAULT_DB_PATH = "./data/history.db";

// Re-export types
export type { Article, PendingTaskNotification, DbConfig } from "@newsfeed-ai/core/db";

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
  updateArticleOgImage,
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
 * Uses DB_PATH env var or default path
 */
export async function ensureDb(dbPath?: string) {
  return db.ensureDb({
    dbPath: dbPath || process.env.DB_PATH || DEFAULT_DB_PATH,
  });
}

/**
 * Get the database client (must call ensureDb first)
 */
export async function getDb() {
  return db.getDb();
}
