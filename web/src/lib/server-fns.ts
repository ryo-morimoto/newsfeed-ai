import { createServerFn } from "@tanstack/react-start";
import {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  type Article,
} from "./db";

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
