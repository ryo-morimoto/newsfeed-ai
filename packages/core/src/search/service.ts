import {
  searchIndex,
  initSearchIndex,
  rebuildIndexFromSQLite,
  persistIndex,
} from "./orama";
import type { Article, SearchResult, SearchConfig, SearchOptions } from "./types";

let initialized = false;
let initializationFailed = false;
let currentConfig: SearchConfig | null = null;

/**
 * Initialize the search service
 * Should be called at application startup
 */
export async function initSearchService(
  config: SearchConfig,
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  if (initialized && currentConfig === config) return;

  currentConfig = config;

  try {
    await initSearchIndex(config);

    // Check if index is empty and rebuild if needed
    const testResults = await searchIndex("test", 1);
    if (testResults.length === 0) {
      console.log("[search-service] Index appears empty, rebuilding from SQLite...");
      await rebuildIndexFromSQLite(getAllArticles, config.embeddingsPlugin);
      await persistIndex(config);
    }

    initialized = true;
    console.log("[search-service] Search service initialized");
  } catch (error) {
    console.error("[search-service] Failed to initialize search:", error);
    initializationFailed = true;
    initialized = true; // Mark as initialized to avoid repeated attempts
  }
}

/**
 * Fallback search using SQLite LIKE queries
 */
async function fallbackSearch(
  query: string,
  limit: number,
  getAllArticles: () => Promise<Article[]>
): Promise<SearchResult[]> {
  console.log("[search-service] Using fallback SQLite search");

  try {
    const articles = await getAllArticles();
    const lowerQuery = query.toLowerCase();

    // Simple text matching
    const matches = articles
      .filter((article) => {
        const searchText = [article.title, article.summary, article.detailed_summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(lowerQuery);
      })
      .slice(0, limit);

    return matches.map((article, index) => ({
      article: {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      },
      score: 1 - index * 0.01, // Simple decreasing score
    }));
  } catch (error) {
    console.error("[search-service] Fallback search failed:", error);
    return [];
  }
}

/**
 * Search articles using Orama (with SQLite fallback)
 */
export async function searchArticles(
  options: SearchOptions,
  getAllArticles: () => Promise<Article[]>
): Promise<SearchResult[]> {
  const { query, limit = 20 } = options;

  if (!query || query.trim().length === 0) {
    return [];
  }

  // If Orama initialization failed, use fallback
  if (initializationFailed) {
    return fallbackSearch(query, limit, getAllArticles);
  }

  try {
    const results = await searchIndex(query, limit);
    return results;
  } catch (error) {
    console.error("[search-service] Orama search failed, using fallback:", error);
    return fallbackSearch(query, limit, getAllArticles);
  }
}

/**
 * Force rebuild the search index from SQLite
 */
export async function rebuildSearchIndex(
  config: SearchConfig,
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  await rebuildIndexFromSQLite(getAllArticles, config.embeddingsPlugin);
  await persistIndex(config);
  initializationFailed = false;
  console.log("[search-service] Search index rebuilt");
}

/**
 * Persist the search index (should be called on shutdown)
 */
export async function shutdownSearchService(): Promise<void> {
  if (!currentConfig) return;

  try {
    await persistIndex(currentConfig);
    console.log("[search-service] Search index persisted on shutdown");
  } catch (error) {
    console.error("[search-service] Failed to persist index on shutdown:", error);
  }
}
