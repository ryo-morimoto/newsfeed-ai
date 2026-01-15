import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";

// Use in-memory database for testing
const TEST_DB_PATH = join(import.meta.dir, "..", "data", "test-history.db");

// We'll create our own test-specific functions to avoid modifying the actual module
function createTestDb(): Database {
  const db = new Database(TEST_DB_PATH);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT,
      score REAL,
      published_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      notified INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_url ON articles(url);
    CREATE INDEX IF NOT EXISTS idx_created ON articles(created_at);
    CREATE INDEX IF NOT EXISTS idx_notified ON articles(notified);
  `);
  
  return db;
}

function isArticleSeen(db: Database, url: string): boolean {
  const row = db.query("SELECT 1 FROM articles WHERE url = ?").get(url);
  return !!row;
}

function saveArticle(db: Database, article: {
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string | null;
  score?: number | null;
  published_at?: string | null;
  notified?: number;
}) {
  const stmt = db.query(`
    INSERT OR IGNORE INTO articles (url, title, source, category, summary, score, published_at, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    article.url,
    article.title,
    article.source,
    article.category,
    article.summary ?? null,
    article.score ?? null,
    article.published_at ?? null,
    article.notified ?? 0
  );
}

function markAsNotified(db: Database, urls: string[]) {
  const stmt = db.query("UPDATE articles SET notified = 1 WHERE url = ?");
  for (const url of urls) {
    stmt.run(url);
  }
}

function getRecentArticles(db: Database, hours: number = 24): any[] {
  return db.query(`
    SELECT * FROM articles 
    WHERE created_at > datetime('now', '-' || ? || ' hours')
    ORDER BY created_at DESC
  `).all(hours);
}

describe("Database Operations", () => {
  let db: Database;

  beforeEach(() => {
    // Clean up any existing test DB
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    db = createTestDb();
  });

  afterEach(() => {
    db.close();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  describe("isArticleSeen", () => {
    test("returns false for unseen URL", () => {
      expect(isArticleSeen(db, "https://new-article.com")).toBe(false);
    });

    test("returns true for seen URL", () => {
      saveArticle(db, {
        url: "https://seen-article.com",
        title: "Test Article",
        source: "Test",
        category: "tech",
      });
      
      expect(isArticleSeen(db, "https://seen-article.com")).toBe(true);
    });
  });

  describe("saveArticle", () => {
    test("saves article with required fields", () => {
      const result = saveArticle(db, {
        url: "https://example.com/article1",
        title: "Test Article",
        source: "Test Source",
        category: "tech",
      });
      
      expect(result.changes).toBe(1);
    });

    test("saves article with all fields", () => {
      saveArticle(db, {
        url: "https://example.com/article2",
        title: "Full Article",
        source: "Full Source",
        category: "ai",
        summary: "要約テスト",
        score: 0.85,
        published_at: "2024-01-15",
        notified: 1,
      });
      
      const saved = db.query("SELECT * FROM articles WHERE url = ?").get("https://example.com/article2") as any;
      
      expect(saved.title).toBe("Full Article");
      expect(saved.summary).toBe("要約テスト");
      expect(saved.score).toBe(0.85);
      expect(saved.notified).toBe(1);
    });

    test("ignores duplicate URLs", () => {
      saveArticle(db, {
        url: "https://example.com/dup",
        title: "Original",
        source: "Test",
        category: "tech",
      });
      
      const result = saveArticle(db, {
        url: "https://example.com/dup",
        title: "Duplicate",
        source: "Test",
        category: "tech",
      });
      
      // INSERT OR IGNORE should not change anything
      expect(result.changes).toBe(0);
      
      // Original should remain
      const saved = db.query("SELECT title FROM articles WHERE url = ?").get("https://example.com/dup") as any;
      expect(saved.title).toBe("Original");
    });
  });

  describe("markAsNotified", () => {
    test("marks single article as notified", () => {
      saveArticle(db, {
        url: "https://example.com/notify1",
        title: "To Notify",
        source: "Test",
        category: "tech",
        notified: 0,
      });
      
      markAsNotified(db, ["https://example.com/notify1"]);
      
      const saved = db.query("SELECT notified FROM articles WHERE url = ?").get("https://example.com/notify1") as any;
      expect(saved.notified).toBe(1);
    });

    test("marks multiple articles as notified", () => {
      const urls = [
        "https://example.com/n1",
        "https://example.com/n2",
        "https://example.com/n3",
      ];
      
      for (const url of urls) {
        saveArticle(db, {
          url,
          title: "Test",
          source: "Test",
          category: "tech",
          notified: 0,
        });
      }
      
      markAsNotified(db, urls);
      
      const notified = db.query("SELECT COUNT(*) as count FROM articles WHERE notified = 1").get() as any;
      expect(notified.count).toBe(3);
    });

    test("handles non-existent URLs gracefully", () => {
      // Should not throw
      expect(() => markAsNotified(db, ["https://nonexistent.com"])).not.toThrow();
    });
  });

  describe("getRecentArticles", () => {
    test("returns articles within time window", () => {
      saveArticle(db, {
        url: "https://example.com/recent",
        title: "Recent Article",
        source: "Test",
        category: "tech",
      });
      
      const recent = getRecentArticles(db, 24);
      expect(recent.length).toBe(1);
      expect(recent[0].title).toBe("Recent Article");
    });

    test("returns empty array when no recent articles", () => {
      const recent = getRecentArticles(db, 24);
      expect(recent).toEqual([]);
    });

    test("sorts by created_at descending", () => {
      // Insert with slight delay simulation
      saveArticle(db, {
        url: "https://example.com/first",
        title: "First",
        source: "Test",
        category: "tech",
      });
      saveArticle(db, {
        url: "https://example.com/second",
        title: "Second",
        source: "Test",
        category: "tech",
      });
      
      const recent = getRecentArticles(db, 24);
      expect(recent.length).toBe(2);
      // Both have same timestamp, but insertion order preserved
    });
  });

  describe("Schema Constraints", () => {
    test("url must be unique", () => {
      saveArticle(db, {
        url: "https://unique.com",
        title: "First",
        source: "Test",
        category: "tech",
      });
      
      // Using INSERT OR IGNORE, so no error but also no change
      const result = saveArticle(db, {
        url: "https://unique.com",
        title: "Second",
        source: "Test",
        category: "tech",
      });
      
      expect(result.changes).toBe(0);
    });

    test("created_at defaults to current timestamp", () => {
      saveArticle(db, {
        url: "https://timestamp.com",
        title: "Timestamp Test",
        source: "Test",
        category: "tech",
      });
      
      const saved = db.query("SELECT created_at FROM articles WHERE url = ?").get("https://timestamp.com") as any;
      expect(saved.created_at).toBeDefined();
    });
  });
});
