// Types
export type { Article, PendingTaskNotification, DbConfig } from "./types";

// Client
export { ensureDb, getDb, closeDb } from "./client";

// Operations
export {
  isArticleSeen,
  saveArticle,
  markAsNotified,
  getRecentArticles,
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing,
  updateArticleDetailedSummary,
  registerTaskNotification,
  getPendingTaskNotifications,
  markTaskNotified,
  getTaskNotification,
  cleanupOldTaskNotifications,
} from "./operations";
