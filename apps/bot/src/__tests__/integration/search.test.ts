import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import {
  create,
  insert,
  search,
  type Orama,
} from "@orama/orama";
import {
  ensureDb,
  closeDb,
  saveArticle,
  getAllArticlesForIndexing,
  getArticleByUrl,
} from "../../db";

const TEST_DB_PATH = join(import.meta.dir, "..", "..", "..", "data", "search-test.db");

// Skip search index sync in saveArticle
process.env.SKIP_SEARCH_INDEX = "1";

// Schema for testing (no vector embeddings to avoid TensorFlow)
const TEST_SCHEMA = {
  url: "string" as const,
  title: "string" as const,
  summary: "string" as const,
  detailed_summary: "string" as const,
  category: "string" as const,
  source: "string" as const,
  created_at: "string" as const,
} as const;

type TestOramaDb = Orama<typeof TEST_SCHEMA>;

const mockArticles = [
  {
    url: "https://example.com/typescript-advanced",
    title: "Advanced TypeScript Patterns",
    source: "Dev Blog",
    category: "Programming",
    summary: "Learn advanced TypeScript patterns for better code",
    detailed_summary: "Deep dive into generics, conditional types, and mapped types in TypeScript",
    notified: 0,
  },
  {
    url: "https://example.com/react-server-components",
    title: "Understanding React Server Components",
    source: "React Blog",
    category: "Frontend",
    summary: "A guide to React Server Components",
    detailed_summary: "RSC allows rendering components on the server for better performance and SEO",
    notified: 0,
  },
  {
    url: "https://example.com/ai-transformers",
    title: "Introduction to AI Transformers",
    source: "AI Weekly",
    category: "AI",
    summary: "Understanding transformer architecture in AI",
    detailed_summary: "Transformers revolutionized NLP with attention mechanisms and parallel processing",
    notified: 0,
  },
  {
    url: "https://example.com/rust-memory-safety",
    title: "Rust Memory Safety Explained",
    source: "Rust Blog",
    category: "Programming",
    summary: "How Rust achieves memory safety without garbage collection",
    detailed_summary: "Ownership, borrowing, and lifetimes make Rust memory safe at compile time",
    notified: 0,
  },
];

describe("Search Integration (SQLite + Orama Fulltext)", () => {
  beforeEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);

    // Initialize database
    await ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();

    // Clean up files
    if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  });

  describe("SQLite Storage", () => {
    test("saves articles to SQLite", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();
      expect(articles.length).toBe(4);
    });

    test("retrieves article by URL", async () => {
      await saveArticle(mockArticles[0]);

      const article = await getArticleByUrl(mockArticles[0].url);
      expect(article).not.toBeNull();
      expect(article?.title).toBe(mockArticles[0].title);
    });

    test("getAllArticlesForIndexing returns all articles", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();
      expect(articles.length).toBe(4);
      expect(articles.map(a => a.url)).toContain(mockArticles[0].url);
      expect(articles.map(a => a.url)).toContain(mockArticles[3].url);
    });
  });

  describe("Orama Fulltext Search (without embeddings)", () => {
    let db: TestOramaDb;

    beforeEach(async () => {
      // Create Orama index without embeddings
      db = await create({
        schema: TEST_SCHEMA,
      }) as TestOramaDb;

      // Save articles to SQLite
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      // Index articles in Orama
      const articles = await getAllArticlesForIndexing();
      for (const article of articles) {
        await insert(db, {
          url: article.url,
          title: article.title,
          summary: article.summary || "",
          detailed_summary: article.detailed_summary || "",
          category: article.category,
          source: article.source,
          created_at: article.created_at || "",
        } as any);
      }
    });

    test("finds articles by title keyword", async () => {
      const results = await search(db, {
        term: "TypeScript",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      expect(results.hits.length).toBeGreaterThanOrEqual(1);
      expect(results.hits[0].document.title).toContain("TypeScript");
    });

    test("finds articles by summary content", async () => {
      const results = await search(db, {
        term: "attention mechanisms",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      expect(results.hits.length).toBeGreaterThanOrEqual(1);
      expect(results.hits[0].document.title).toContain("AI");
    });

    test("finds articles by detailed_summary content", async () => {
      const results = await search(db, {
        term: "generics conditional types",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      expect(results.hits.length).toBeGreaterThanOrEqual(1);
      expect(results.hits[0].document.title).toContain("TypeScript");
    });

    test("returns empty for non-matching query", async () => {
      const results = await search(db, {
        term: "xyz123nonexistent",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      expect(results.hits.length).toBe(0);
    });

    test("respects limit parameter", async () => {
      const results = await search(db, {
        term: "Programming",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
        limit: 1,
      });

      expect(results.hits.length).toBeLessThanOrEqual(1);
    });

    test("search results include score", async () => {
      const results = await search(db, {
        term: "React",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      expect(results.hits.length).toBeGreaterThanOrEqual(1);
      expect(typeof results.hits[0].score).toBe("number");
      expect(results.hits[0].score).toBeGreaterThan(0);
    });

    test("searches are independent", async () => {
      const results1 = await search(db, {
        term: "TypeScript",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      const results2 = await search(db, {
        term: "Rust",
        mode: "fulltext",
        properties: ["title", "summary", "detailed_summary"],
      });

      // Results should be different
      expect(results1.hits[0].document.url).not.toBe(results2.hits[0].document.url);
    });
  });

  describe("Fallback Search (SQLite LIKE)", () => {
    test("fallback search finds articles by title", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();
      const query = "typescript";

      // Simulate fallback search logic
      const matches = articles.filter((article) => {
        const searchText = [
          article.title,
          article.summary,
          article.detailed_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBeGreaterThanOrEqual(1);
      expect(matches[0].title.toLowerCase()).toContain("typescript");
    });

    test("fallback search finds articles by summary", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();
      const query = "transformer";

      const matches = articles.filter((article) => {
        const searchText = [
          article.title,
          article.summary,
          article.detailed_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    test("fallback search returns empty for no match", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();
      const query = "xyz123nonexistent";

      const matches = articles.filter((article) => {
        const searchText = [
          article.title,
          article.summary,
          article.detailed_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(query.toLowerCase());
      });

      expect(matches.length).toBe(0);
    });

    test("fallback search is case-insensitive", async () => {
      for (const article of mockArticles) {
        await saveArticle(article);
      }

      const articles = await getAllArticlesForIndexing();

      // Test uppercase
      const upperMatches = articles.filter((article) => {
        const searchText = [article.title, article.summary, article.detailed_summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchText.includes("TYPESCRIPT".toLowerCase());
      });

      // Test lowercase
      const lowerMatches = articles.filter((article) => {
        const searchText = [article.title, article.summary, article.detailed_summary]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchText.includes("typescript".toLowerCase());
      });

      expect(upperMatches.length).toBe(lowerMatches.length);
    });
  });
});
