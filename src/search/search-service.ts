import {
  searchIndex,
  initSearchIndex,
  rebuildIndexFromSQLite,
  persistIndex,
  type SearchResult,
} from "./orama-index";
import type { Article } from "../db";

let initialized = false;
let initializationFailed = false;

/**
 * Initialize the search service
 * Should be called at application startup
 */
export async function initSearchService(
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  if (initialized) return;

  try {
    await initSearchIndex();

    // Check if index is empty and rebuild if needed
    const testResults = await searchIndex("test", 1);
    if (testResults.length === 0) {
      console.log("[search-service] Index appears empty, rebuilding from SQLite...");
      await rebuildIndexFromSQLite(getAllArticles);
      await persistIndex();
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
        const searchText = [
          article.title,
          article.summary,
          article.detailed_summary,
        ]
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

export interface SearchOptions {
  query: string;
  limit?: number;
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
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  await rebuildIndexFromSQLite(getAllArticles);
  await persistIndex();
  initializationFailed = false;
  console.log("[search-service] Search index rebuilt");
}

/**
 * Persist the search index (should be called on shutdown)
 */
export async function shutdownSearchService(): Promise<void> {
  try {
    await persistIndex();
    console.log("[search-service] Search index persisted on shutdown");
  } catch (error) {
    console.error("[search-service] Failed to persist index on shutdown:", error);
  }
}

// Re-export types and functions
export type { SearchResult };
export { addArticleToIndex } from "./orama-index";
