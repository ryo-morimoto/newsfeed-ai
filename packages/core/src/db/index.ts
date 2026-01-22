// Types
export type { Article, ArticleRow, PendingTaskNotification, DbConfig } from "./types";
export { rowToArticle } from "./types";

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
  updateArticleOgImage,
  registerTaskNotification,
  getPendingTaskNotifications,
  markTaskNotified,
  getTaskNotification,
  cleanupOldTaskNotifications,
} from "./operations";
