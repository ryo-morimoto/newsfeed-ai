import { createServerFn } from "@tanstack/react-start";
import {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  type Article,
} from "./db";
import {
  smartSearch,
  type WebSearchResponse,
} from "../../../src/web-search";

export const fetchArticles = createServerFn({ method: "GET" }).handler(
  async (): Promise<Article[]> => {
    return getArticlesWithDetailedSummary(50);
  }
);

export const fetchArticle = createServerFn({ method: "GET" }).handler(
  async (ctx): Promise<Article | null> => {
    const url = ctx.data as unknown as string;
    return getArticleByUrl(url);
  }
);

export const performSearch = createServerFn({ method: "POST" }).handler(
  async (ctx): Promise<WebSearchResponse> => {
    const query = ctx.data as unknown as string;
    if (!query || typeof query !== "string") {
      throw new Error("Query is required");
    }
    return smartSearch(query);
  }
);

export type { WebSearchResponse };
