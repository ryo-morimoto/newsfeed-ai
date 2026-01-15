import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import {
  ensureDb,
  closeDb,
  isArticleSeen,
  saveArticle,
  markAsNotified,
  getRecentArticles,
} from "./db";

const TEST_DB_PATH = join(import.meta.dir, "..", "data", "test-history.db");

describe("Database Operations", () => {
  beforeEach(() => {
    // Clean up any existing test DB
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Initialize with test DB path
    ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe("isArticleSeen", () => {
    test("returns false for unseen URL", () => {
      expect(isArticleSeen("https://new-article.com")).toBe(false);
    });

    test("returns true for seen URL", () => {
      saveArticle({
        url: "https://seen-article.com",
        title: "Test Article",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      expect(isArticleSeen("https://seen-article.com")).toBe(true);
    });
  });

  describe("saveArticle", () => {
    test("saves article with required fields", () => {
      const result = saveArticle({
        url: "https://example.com/article1",
        title: "Test Article",
        source: "Test Source",
        category: "tech",
        notified: 0,
      });
      
      expect(result.changes).toBe(1);
    });

    test("saves article with all fields", () => {
      saveArticle({
        url: "https://example.com/article2",
        title: "Full Article",
        source: "Full Source",
        category: "ai",
        summary: "要約テスト",
        score: 0.85,
        published_at: "2024-01-15",
        notified: 1,
      });
      
      expect(isArticleSeen("https://example.com/article2")).toBe(true);
    });

    test("ignores duplicate URLs", () => {
      saveArticle({
        url: "https://example.com/dup",
        title: "Original",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      const result = saveArticle({
        url: "https://example.com/dup",
        title: "Duplicate",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      // INSERT OR IGNORE should not change anything
      expect(result.changes).toBe(0);
    });
  });

  describe("markAsNotified", () => {
    test("marks single article as notified", () => {
      saveArticle({
        url: "https://example.com/notify1",
        title: "To Notify",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      markAsNotified(["https://example.com/notify1"]);
      
      // Verify via getRecentArticles
      const articles = getRecentArticles(1);
      const found = articles.find(a => a.url === "https://example.com/notify1");
      expect(found?.notified).toBe(1);
    });

    test("marks multiple articles as notified", () => {
      const urls = [
        "https://example.com/n1",
        "https://example.com/n2",
        "https://example.com/n3",
      ];
      
      for (const url of urls) {
        saveArticle({
          url,
          title: "Test",
          source: "Test",
          category: "tech",
          notified: 0,
        });
      }
      
      markAsNotified(urls);
      
      const articles = getRecentArticles(1);
      const notifiedCount = articles.filter(a => a.notified === 1).length;
      expect(notifiedCount).toBe(3);
    });

    test("handles non-existent URLs gracefully", () => {
      // Should not throw
      expect(() => markAsNotified(["https://nonexistent.com"])).not.toThrow();
    });
  });

  describe("getRecentArticles", () => {
    test("returns articles within time window", () => {
      saveArticle({
        url: "https://example.com/recent",
        title: "Recent Article",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      const recent = getRecentArticles(24);
      expect(recent.length).toBe(1);
      expect(recent[0].title).toBe("Recent Article");
    });

    test("returns empty array when no recent articles", () => {
      const recent = getRecentArticles(24);
      expect(recent).toEqual([]);
    });
  });
});
