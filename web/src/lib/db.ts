import { Database } from "bun:sqlite";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ESM環境で__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// DBパスは親プロジェクトのdata/history.db
// ビルド後は dist/server/assets/ にあるので4階層上
const DB_PATH = join(__dirname, "..", "..", "..", "..", "data", "history.db");

export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  detailed_summary?: string;
  key_points?: string;
  target_audience?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  notified: number;
}

let db: Database | null = null;

function getDb(): Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true });
  }
  return db;
}

export function getArticlesWithDetailedSummary(limit: number = 50): Article[] {
  const stmt = getDb().prepare(`
    SELECT * FROM articles
    WHERE detailed_summary IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as Article[];
}

export function getArticleByUrl(url: string): Article | null {
  const stmt = getDb().prepare(`
    SELECT * FROM articles WHERE url = ?
  `);
  return stmt.get(url) as Article | null;
}
