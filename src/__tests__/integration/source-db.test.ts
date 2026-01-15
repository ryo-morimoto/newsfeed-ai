import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import {
  ensureDb,
  closeDb,
  isArticleSeen,
  saveArticle,
  markAsNotified,
  getRecentArticles,
} from "../../db";
import type { FeedItem } from "../../sources/rss";
import type { HNItem } from "../../sources/hackernews";
import type { TrendingRepo } from "../../sources/github-trending";

const TEST_DB_PATH = join(import.meta.dir, "..", "..", "..", "data", "integration-test.db");

describe("Source → DB Integration", () => {
  beforeEach(() => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe("RSS → DB flow", () => {
    const mockRssItems: FeedItem[] = [
      {
        title: "New TypeScript 6.0 Released",
        url: "https://devblog.com/ts-6",
        published: new Date("2024-01-15"),
        content: "TypeScript 6.0 brings exciting new features...",
      },
      {
        title: "React Server Components Deep Dive",
        url: "https://devblog.com/rsc",
        published: new Date("2024-01-14"),
        content: "Understanding RSC architecture...",
      },
    ];

    test("saves RSS items to database", () => {
      for (const item of mockRssItems) {
        saveArticle({
          url: item.url,
          title: item.title,
          source: "Dev Blog",
          category: "frontend",
          published_at: item.published?.toISOString(),
          notified: 0,
        });
      }

      const recent = getRecentArticles(24);
      expect(recent.length).toBe(2);
      expect(recent.map(a => a.url)).toContain("https://devblog.com/ts-6");
      expect(recent.map(a => a.url)).toContain("https://devblog.com/rsc");
    });

    test("detects duplicate RSS items via isArticleSeen", () => {
      // First save
      saveArticle({
        url: mockRssItems[0].url,
        title: mockRssItems[0].title,
        source: "Dev Blog",
        category: "frontend",
        notified: 0,
      });

      // Check duplicate detection
      expect(isArticleSeen(mockRssItems[0].url)).toBe(true);
      expect(isArticleSeen(mockRssItems[1].url)).toBe(false);
    });

    test("filters out seen items before saving", () => {
      // Pre-save one item
      saveArticle({
        url: mockRssItems[0].url,
        title: "Old title",
        source: "Dev Blog",
        category: "frontend",
        notified: 0,
      });

      // Simulate fetch + filter flow
      const newItems = mockRssItems.filter(item => !isArticleSeen(item.url));
      expect(newItems.length).toBe(1);
      expect(newItems[0].url).toBe("https://devblog.com/rsc");

      // Save only new items
      for (const item of newItems) {
        saveArticle({
          url: item.url,
          title: item.title,
          source: "Dev Blog",
          category: "frontend",
          notified: 0,
        });
      }

      const recent = getRecentArticles(24);
      expect(recent.length).toBe(2);
    });
  });

  describe("HackerNews → DB flow", () => {
    const mockHNItems: HNItem[] = [
      {
        title: "Show HN: My new AI project",
        url: "https://github.com/user/ai-project",
        score: 150,
        published: new Date(),
      },
      {
        title: "Ask HN: Best practices for testing?",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 89,
        published: new Date(),
      },
    ];

    test("saves HN items with score in content", () => {
      for (const item of mockHNItems) {
        saveArticle({
          url: item.url,
          title: item.title,
          source: "Hacker News",
          category: "tech",
          summary: `Score: ${item.score}`,
          score: item.score / 100, // Normalize to 0-1
          notified: 0,
        });
      }

      const recent = getRecentArticles(24);
      expect(recent.length).toBe(2);
      
      const aiProject = recent.find(a => a.url.includes("ai-project"));
      expect(aiProject?.score).toBe(1.5);
    });
  });

  describe("GitHub Trending → DB flow", () => {
    const mockRepos: TrendingRepo[] = [
      {
        title: "microsoft/typescript",
        url: "https://github.com/microsoft/typescript",
        description: "TypeScript is a superset of JavaScript",
        stars: 234,
        language: "typescript",
      },
      {
        title: "rust-lang/rust",
        url: "https://github.com/rust-lang/rust",
        description: "Empowering everyone to build reliable software",
        stars: 456,
        language: "rust",
      },
    ];

    test("saves trending repos to database", () => {
      for (const repo of mockRepos) {
        saveArticle({
          url: repo.url,
          title: repo.title,
          source: `GitHub (${repo.language})`,
          category: "repos",
          summary: `${repo.description} (★${repo.stars} today)`,
          notified: 0,
        });
      }

      const recent = getRecentArticles(24);
      expect(recent.length).toBe(2);
      
      const tsRepo = recent.find(a => a.title.includes("typescript"));
      expect(tsRepo?.source).toBe("GitHub (typescript)");
      expect(tsRepo?.summary).toContain("★234");
    });
  });

  describe("Notification flow", () => {
    test("marks articles as notified after send", () => {
      const urls = [
        "https://example.com/article1",
        "https://example.com/article2",
        "https://example.com/article3",
      ];

      // Save articles
      for (const url of urls) {
        saveArticle({
          url,
          title: "Test",
          source: "Test",
          category: "tech",
          notified: 0,
        });
      }

      // Verify all unnotified
      let articles = getRecentArticles(24);
      expect(articles.every(a => a.notified === 0)).toBe(true);

      // Mark first two as notified
      markAsNotified(urls.slice(0, 2));

      // Verify state
      articles = getRecentArticles(24);
      const notifiedCount = articles.filter(a => a.notified === 1).length;
      const unnotifiedCount = articles.filter(a => a.notified === 0).length;
      
      expect(notifiedCount).toBe(2);
      expect(unnotifiedCount).toBe(1);
    });

    test("getRecentArticles returns both notified and unnotified", () => {
      saveArticle({
        url: "https://example.com/old",
        title: "Old Article",
        source: "Test",
        category: "tech",
        notified: 1,
      });

      saveArticle({
        url: "https://example.com/new",
        title: "New Article",
        source: "Test",
        category: "tech",
        notified: 0,
      });

      const articles = getRecentArticles(24);
      expect(articles.length).toBe(2);
    });
  });
});
