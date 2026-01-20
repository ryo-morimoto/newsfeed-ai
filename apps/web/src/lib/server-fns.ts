import { createServerFn } from "@tanstack/react-start";
import {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticles,
  type Article,
} from "./db";
import {
  searchArticles,
  fallbackSearch,
  type SearchResult,
} from "./search";

export const fetchArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Article[]> => {
    return await getArticlesWithDetailedSummary(50);
  }
);

export const fetchArticle = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<Article | null> => {
    const url = ctx.data as unknown as string;
    return await getArticleByUrl(url);
  }
);

export const performSearch = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<SearchResult[]> => {
    const query = ctx.data as unknown as string;
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      // Try Orama search first
      const results = await searchArticles(query, 20);
      if (results.length > 0) {
        return results;
      }

      // If no results, try fallback
      return await fallbackSearch(query, 20, getAllArticles);
    } catch (error) {
      console.error("[server-fns] Search error:", error);
      // Use fallback on error
      return await fallbackSearch(query, 20, getAllArticles);
    }
  }
);
