/**
 * Search service initialization for bot app
 * Uses @newsfeed-ai/core with bot-specific adapters
 */
import { search, type Article } from "@newsfeed-ai/core";
import { getSearchConfig, initSearchIndex } from "./orama-index";

/**
 * Initialize the search service
 * Should be called at application startup
 */
export async function initSearchService(
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  await initSearchIndex();
  await search.initSearchService(getSearchConfig(), getAllArticles);
}

/**
 * Persist the search index (should be called on shutdown)
 */
export async function shutdownSearchService(): Promise<void> {
  await search.shutdownSearchService();
}
