// Types
export type { Article, ArticleRow, PendingTaskNotification, DbConfig } from "./types";
export { rowToArticle } from "./types";

// Client
export { ensureDb, getDb, closeDb, setDbClientFactory } from "./client";

// Operations
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
  getDistinctSources,
  getDistinctCategories,
} from "./operations";
export type { ArticleFilters } from "./operations";
