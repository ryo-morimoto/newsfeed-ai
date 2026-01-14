import { Database } from "bun:sqlite";
import { join } from "path";

const DB_PATH = join(import.meta.dir, "..", "data", "history.db");

export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  notified: number;
}

let db: Database;

export function initDb() {
  db = new Database(DB_PATH);

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

export function getDb() {
  if (!db) initDb();
  return db;
}

export function isArticleSeen(url: string): boolean {
  const row = getDb().query("SELECT 1 FROM articles WHERE url = ?").get(url);
  return !!row;
}

export function saveArticle(article: Omit<Article, "id" | "created_at">) {
  const stmt = getDb().query(`
    INSERT OR IGNORE INTO articles (url, title, source, category, summary, score, published_at, notified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  return stmt.run(
    article.url,
    article.title,
    article.source,
    article.category,
    article.summary || null,
    article.score || null,
    article.published_at || null,
    article.notified ? 1 : 0
  );
}

export function markAsNotified(urls: string[]) {
  const stmt = getDb().query("UPDATE articles SET notified = 1 WHERE url = ?");
  for (const url of urls) {
    stmt.run(url);
  }
}

export function getRecentArticles(hours: number = 24): Article[] {
  return getDb().query(`
    SELECT * FROM articles 
    WHERE created_at > datetime('now', '-' || ? || ' hours')
    ORDER BY created_at DESC
  `).all(hours) as Article[];
}
