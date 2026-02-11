import { Hono } from "hono";
import { IndexPage } from "./pages/index";
import { ArticlePage, NotFoundPage } from "./pages/article";
import { SearchPage } from "./pages/search";
import {
  ensureInitialized,
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getDistinctSources,
  getDistinctCategories,
} from "./lib/db";
import { searchArticles } from "./lib/search";

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Initialize DB before handling requests
app.use("*", async (c, next) => {
  await ensureInitialized(c.env);
  await next();
});

// Home page
app.get("/", async (c) => {
  const source = c.req.query("source") || undefined;
  const category = c.req.query("category") || undefined;

  const [articles, sources, categories] = await Promise.all([
    getArticlesWithDetailedSummary(50, { source, category }),
    getDistinctSources(),
    getDistinctCategories(),
  ]);

  return c.html(
    <IndexPage
      articles={articles}
      sources={sources}
      categories={categories}
      currentSource={source}
      currentCategory={category}
    />
  );
});

// Article detail page
app.get("/article/:url", async (c) => {
  const url = decodeURIComponent(c.req.param("url"));
  const article = await getArticleByUrl(url);
  if (!article) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<ArticlePage article={article} />);
});

// Search page
app.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  let results: Awaited<ReturnType<typeof searchArticles>> = [];
  if (query) {
    results = await searchArticles(query);
  }
  return c.html(<SearchPage results={results} query={query} />);
});

export default app;
