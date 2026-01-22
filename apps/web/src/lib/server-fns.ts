import { createServerFn } from "@tanstack/react-start";
import {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  ensureInitialized,
  type Article,
} from "./db";
import { searchArticles, type SearchResult } from "./search";

export const fetchArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Article[]> => {
    await ensureInitialized();
    return await getArticlesWithDetailedSummary(50);
  }
);

export const fetchArticle = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<Article | null> => {
    await ensureInitialized();
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
      // searchArticles handles fallback internally
      return await searchArticles(query, 20);
    } catch (error) {
      console.error("[server-fns] Search error:", error);
      return [];
    }
  }
);
