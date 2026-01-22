/**
 * Search module initialization for web app
 * Uses @newsfeed-ai/core with runtime adapter selection:
 * - Cloudflare Workers: Turso FileSystem adapter
 * - Node.js/Bun: Node.js FileSystem adapter
 */
import { search, paths, type Article } from "@newsfeed-ai/core";

// Re-export SearchResult type for use by server-fns
export type { SearchResult } from "@newsfeed-ai/core/search";
import { getAllArticles, ensureInitialized as ensureDbInitialized } from "./db";

// Detect if running on Cloudflare Workers
const isCloudflareWorkers =
  typeof globalThis.caches !== "undefined" &&
  typeof (globalThis as Record<string, unknown>).WebSocketPair !== "undefined";

// Lazy load the appropriate adapter
async function getFileSystem(): Promise<search.FileSystem> {
  if (isCloudflareWorkers) {
    const { tursoFileSystem } = await import("../adapters/turso-fs");
    return tursoFileSystem;
  } else {
    const { nodeFileSystem } = await import("../adapters/fs");
    return nodeFileSystem;
  }
}

// Initialization tracking
let initialized = false;
let searchConfig: search.SearchConfig | null = null;

async function getSearchConfig(): Promise<search.SearchConfig> {
  if (!searchConfig) {
    const fs = await getFileSystem();
    searchConfig = {
      indexPath: isCloudflareWorkers ? "default" : paths.searchIndex,
      fs,
    };
  }
  return searchConfig;
}

/**
 * Ensure search service is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  // Ensure database is initialized before search (getAllArticles requires it)
  await ensureDbInitialized();
  const config = await getSearchConfig();
  await search.initSearchService(config, getAllArticles);
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
  const config = await getSearchConfig();
  await search.rebuildSearchIndex(config, async () => articles);
}

/**
 * Persist index to file
 */
export async function persistIndex(): Promise<void> {
  await search.shutdownSearchService();
}
