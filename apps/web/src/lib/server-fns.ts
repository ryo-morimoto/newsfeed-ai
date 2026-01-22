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

export const fetchArticle = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data }): Promise<Article | null> => {
    await ensureInitialized();
    return await getArticleByUrl(data);
  });

export const performSearch = createServerFn({ method: "GET" })
  .inputValidator((data: string) => data)
  .handler(async ({ data }): Promise<SearchResult[]> => {
    if (!data || data.trim().length === 0) {
      return [];
    }

    try {
      // searchArticles handles fallback internally
      return await searchArticles(data, 20);
    } catch (error) {
      console.error("[server-fns] Search error:", error);
      return [];
    }
  });
