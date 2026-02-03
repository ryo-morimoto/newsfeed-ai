import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join, dirname } from "path";
import { unlinkSync, existsSync, mkdirSync } from "fs";
import {
  ensureDb,
  closeDb,
  isArticleSeen,
  saveArticle,
  markAsNotified,
  getRecentArticles,
  getArticleByUrl,
} from "./db";

const TEST_DB_PATH = join(import.meta.dir, "..", "data", "test-history.db");

// Skip search index sync in tests (loads TensorFlow which is slow)
process.env.SKIP_SEARCH_INDEX = "1";

describe("Database Operations", () => {
  beforeEach(async () => {
    // Ensure data directory exists
    const dataDir = dirname(TEST_DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    // Clean up any existing test DB
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Initialize with test DB path
    await ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Also clean up WAL files
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  });

  describe("isArticleSeen", () => {
    test("returns false for unseen URL", async () => {
      expect(await isArticleSeen("https://new-article.com")).toBe(false);
    });

    test("returns true for seen URL", async () => {
      await saveArticle({
        url: "https://seen-article.com",
        title: "Test Article",
        source: "Test",
        category: "tech",
        notified: false,
      });

      expect(await isArticleSeen("https://seen-article.com")).toBe(true);
    });
  });

  describe("saveArticle", () => {
    test("saves article with required fields", async () => {
      const result = await saveArticle({
        url: "https://example.com/article1",
        title: "Test Article",
        source: "Test Source",
        category: "tech",
        notified: false,
      });

      expect(result.rowsAffected).toBe(1);
    });

    test("saves article with all fields", async () => {
      await saveArticle({
        url: "https://example.com/article2",
        title: "Full Article",
        source: "Full Source",
        category: "ai",
        summary: "要約テスト",
        score: 0.85,
        published_at: "2024-01-15",
        notified: true,
      });

      expect(await isArticleSeen("https://example.com/article2")).toBe(true);
    });

    test("upserts duplicate URLs without overwriting existing fields", async () => {
      await saveArticle({
        url: "https://example.com/dup",
        title: "Original",
        source: "Test",
        category: "tech",
        notified: false,
      });

      await saveArticle({
        url: "https://example.com/dup",
        title: "Duplicate",
        source: "Test",
        category: "tech",
        summary: "New summary",
        published_at: "2025-01-01T00:00:00Z",
        score: 8,
        notified: false,
      });

      const article = await getArticleByUrl("https://example.com/dup");
      // title is preserved from initial insert
      expect(article?.title).toBe("Original");
      // new fields are updated
      expect(article?.summary).toBe("New summary");
      expect(article?.published_at).toBe("2025-01-01T00:00:00Z");
      expect(article?.score).toBe(8);
    });
  });

  describe("markAsNotified", () => {
    test("marks single article as notified", async () => {
      await saveArticle({
        url: "https://example.com/notify1",
        title: "To Notify",
        source: "Test",
        category: "tech",
        notified: false,
      });

      await markAsNotified(["https://example.com/notify1"]);

      // Verify via getRecentArticles
      const articles = await getRecentArticles(1);
      const found = articles.find(a => a.url === "https://example.com/notify1");
      expect(found?.notified).toBe(true);
    });

    test("marks multiple articles as notified", async () => {
      const urls = [
        "https://example.com/n1",
        "https://example.com/n2",
        "https://example.com/n3",
      ];

      for (const url of urls) {
        await saveArticle({
          url,
          title: "Test",
          source: "Test",
          category: "tech",
          notified: false,
        });
      }

      await markAsNotified(urls);

      const articles = await getRecentArticles(1);
      const notifiedCount = articles.filter(a => a.notified === true).length;
      expect(notifiedCount).toBe(3);
    });

    test("handles non-existent URLs gracefully", async () => {
      // Should not throw
      await markAsNotified(["https://nonexistent.com"]);
    });
  });

  describe("getRecentArticles", () => {
    test("returns articles within time window", async () => {
      await saveArticle({
        url: "https://example.com/recent",
        title: "Recent Article",
        source: "Test",
        category: "tech",
        notified: false,
      });

      const recent = await getRecentArticles(24);
      expect(recent.length).toBe(1);
      expect(recent[0].title).toBe("Recent Article");
    });

    test("returns empty array when no recent articles", async () => {
      const recent = await getRecentArticles(24);
      expect(recent).toEqual([]);
    });
  });
});
