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

// Skip search index sync in tests (loads TensorFlow which is slow)
process.env.SKIP_SEARCH_INDEX = "1";

describe("Source → DB Integration", () => {
  beforeEach(async () => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
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

    test("saves RSS items to database", async () => {
      for (const item of mockRssItems) {
        await saveArticle({
          url: item.url,
          title: item.title,
          source: "Dev Blog",
          category: "frontend",
          published_at: item.published?.toISOString(),
          notified: false,
        });
      }

      const recent = await getRecentArticles(24);
      expect(recent.length).toBe(2);
      expect(recent.map(a => a.url)).toContain("https://devblog.com/ts-6");
      expect(recent.map(a => a.url)).toContain("https://devblog.com/rsc");
    });

    test("detects duplicate RSS items via isArticleSeen", async () => {
      // First save
      await saveArticle({
        url: mockRssItems[0].url,
        title: mockRssItems[0].title,
        source: "Dev Blog",
        category: "frontend",
        notified: false,
      });

      // Check duplicate detection
      expect(await isArticleSeen(mockRssItems[0].url)).toBe(true);
      expect(await isArticleSeen(mockRssItems[1].url)).toBe(false);
    });

    test("filters out seen items before saving", async () => {
      // Pre-save one item
      await saveArticle({
        url: mockRssItems[0].url,
        title: "Old title",
        source: "Dev Blog",
        category: "frontend",
        notified: false,
      });

      // Simulate fetch + filter flow
      const newItems: FeedItem[] = [];
      for (const item of mockRssItems) {
        if (!(await isArticleSeen(item.url))) {
          newItems.push(item);
        }
      }
      expect(newItems.length).toBe(1);
      expect(newItems[0].url).toBe("https://devblog.com/rsc");

      // Save only new items
      for (const item of newItems) {
        await saveArticle({
          url: item.url,
          title: item.title,
          source: "Dev Blog",
          category: "frontend",
          notified: false,
        });
      }

      const recent = await getRecentArticles(24);
      expect(recent.length).toBe(2);
    });
  });

  describe("HackerNews → DB flow", () => {
    const mockHNItems: HNItem[] = [
      {
        title: "Show HN: My new AI project",
        url: "https://github.com/user/ai-project",
        score: 150,
        comments: 42,
        published: new Date(),
      },
      {
        title: "Ask HN: Best practices for testing?",
        url: "https://news.ycombinator.com/item?id=12345",
        score: 89,
        comments: 23,
        published: new Date(),
      },
    ];

    test("saves HN items with score in content", async () => {
      for (const item of mockHNItems) {
        await saveArticle({
          url: item.url,
          title: item.title,
          source: "Hacker News",
          category: "tech",
          summary: `Score: ${item.score}`,
          score: item.score / 100, // Normalize to 0-1
          notified: false,
        });
      }

      const recent = await getRecentArticles(24);
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

    test("saves trending repos to database", async () => {
      for (const repo of mockRepos) {
        await saveArticle({
          url: repo.url,
          title: repo.title,
          source: `GitHub (${repo.language})`,
          category: "repos",
          summary: `${repo.description} (★${repo.stars} today)`,
          notified: false,
        });
      }

      const recent = await getRecentArticles(24);
      expect(recent.length).toBe(2);

      const tsRepo = recent.find(a => a.title.includes("typescript"));
      expect(tsRepo?.source).toBe("GitHub (typescript)");
      expect(tsRepo?.summary).toContain("★234");
    });
  });

  describe("Notification flow", () => {
    test("marks articles as notified after send", async () => {
      const urls = [
        "https://example.com/article1",
        "https://example.com/article2",
        "https://example.com/article3",
      ];

      // Save articles
      for (const url of urls) {
        await saveArticle({
          url,
          title: "Test",
          source: "Test",
          category: "tech",
          notified: false,
        });
      }

      // Verify all unnotified
      let articles = await getRecentArticles(24);
      expect(articles.every(a => a.notified === false)).toBe(true);

      // Mark first two as notified
      await markAsNotified(urls.slice(0, 2));

      // Verify state
      articles = await getRecentArticles(24);
      const notifiedCount = articles.filter(a => a.notified === true).length;
      const unnotifiedCount = articles.filter(a => a.notified === false).length;

      expect(notifiedCount).toBe(2);
      expect(unnotifiedCount).toBe(1);
    });

    test("getRecentArticles returns both notified and unnotified", async () => {
      await saveArticle({
        url: "https://example.com/old",
        title: "Old Article",
        source: "Test",
        category: "tech",
        notified: true,
      });

      await saveArticle({
        url: "https://example.com/new",
        title: "New Article",
        source: "Test",
        category: "tech",
        notified: false,
      });

      const articles = await getRecentArticles(24);
      expect(articles.length).toBe(2);
    });
  });
});
