/**
 * Database module for the web application
 * Re-exports from @newsfeed-ai/core/db with web-specific initialization
 */
import { db, paths } from "@newsfeed-ai/core";

// Re-export types
export type { Article } from "@newsfeed-ai/core";

// Re-export operations
export {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing as getAllArticles,
} from "@newsfeed-ai/core/db";

// Initialize on first use
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await db.ensureDb({ dbPath: paths.database });
    initialized = true;
  }
}

// Auto-initialize wrapper for web (simpler API)
export async function getClient() {
  await ensureInitialized();
  return db.getDb();
}
