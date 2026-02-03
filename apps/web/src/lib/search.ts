/**
 * Search module initialization for web app
 * Uses @newsfeed-ai/core with Turso FileSystem adapter for Cloudflare Workers
 */
import * as search from "@newsfeed-ai/core/search";
import type { Article } from "@newsfeed-ai/core/db";
import { tursoFileSystem } from "../adapters/turso-fs";

// Re-export SearchResult type for use by server-fns
export type { SearchResult } from "@newsfeed-ai/core/search";
import { getAllArticles, ensureInitialized as ensureDbInitialized } from "./db";

// Initialization tracking
let initialized = false;
const searchConfig: search.SearchConfig = {
  indexPath: "default",
  fs: tursoFileSystem,
};

/**
 * Ensure search service is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  // Ensure database is initialized before search (getAllArticles requires it)
  await ensureDbInitialized();
  await search.initSearchService(searchConfig, getAllArticles);
  initialized = true;
}

/**
 * Search articles using Orama hybrid search (FTS + Vector) with fulltext fallback
 */
export async function searchArticles(
  query: string,
  limit: number = 20
): Promise<search.SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  await ensureInitialized();
  return search.searchArticles({ query, limit }, getAllArticles);
}

/**
 * Rebuild index from articles
 */
export async function rebuildIndex(articles: Article[]): Promise<void> {
  console.log("[web-search] Rebuilding index...");
  await search.rebuildSearchIndex(searchConfig, async () => articles);
}

/**
 * Persist index to file
 */
export async function persistIndex(): Promise<void> {
  await search.shutdownSearchService();
}
