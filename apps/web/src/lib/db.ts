/**
 * Database module for the web application
 * Re-exports from @newsfeed-ai/core/db with web-specific initialization
 *
 * For Cloudflare Workers: Uses Turso via TURSO_DATABASE_URL/TURSO_AUTH_TOKEN env vars
 * For local dev: Uses local SQLite via DB_PATH env var
 */
import * as db from "@newsfeed-ai/core/db";

// Re-export types
export type { Article } from "@newsfeed-ai/core/db";

// Re-export operations
export {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing as getAllArticles,
} from "@newsfeed-ai/core/db";

// Initialize on first use with promise-based guard to prevent race conditions
let initPromise: Promise<void> | null = null;

export async function ensureInitialized() {
  if (!initPromise) {
    // No dbPath needed - db module reads from environment variables:
    // - TURSO_DATABASE_URL + TURSO_AUTH_TOKEN for Cloudflare Workers
    // - DB_PATH for local development
    initPromise = db.ensureDb().then(() => {});
  }
  await initPromise;
}

// Auto-initialize wrapper for web (simpler API)
export async function getClient() {
  await ensureInitialized();
  return db.getDb();
}
