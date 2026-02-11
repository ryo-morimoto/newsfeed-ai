/**
 * Database module for the web application
 * Re-exports from @newsfeed-ai/core/db with web-specific initialization
 *
 * For Cloudflare Workers: Uses Turso via TURSO_DATABASE_URL/TURSO_AUTH_TOKEN env vars
 * For local dev: Uses local SQLite via DB_PATH env var
 */
import "../adapters/db-adapter";
import * as db from "@newsfeed-ai/core/db";

// Re-export types
export type { Article, ArticleFilters } from "@newsfeed-ai/core/db";

// Re-export operations
export {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing as getAllArticles,
  getDistinctSources,
  getDistinctCategories,
} from "@newsfeed-ai/core/db";

// Initialize on first use with promise-based guard to prevent race conditions
let initPromise: Promise<void> | null = null;

type DbEnv = {
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
};

export async function ensureInitialized(env?: DbEnv) {
  if (!initPromise) {
    // Pass env vars from Cloudflare Workers bindings (c.env)
    // Falls back to process.env in local development
    initPromise = db
      .ensureDb({
        tursoUrl: env?.TURSO_DATABASE_URL,
        tursoToken: env?.TURSO_AUTH_TOKEN,
      })
      .then(() => {});
  }
  await initPromise;
}

// Auto-initialize wrapper for web (simpler API)
export async function getClient() {
  await ensureInitialized();
  return db.getDb();
}
