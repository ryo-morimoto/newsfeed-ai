import { createClient, type Client } from "@libsql/client";
import { paths } from "@newsfeed-ai/core";

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

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;

    if (tursoUrl && tursoToken) {
      client = createClient({
        url: tursoUrl,
        authToken: tursoToken,
      });
    } else {
      // Fall back to local SQLite file
      client = createClient({
        url: `file:${paths.database}`,
      });
    }
  }
  return client;
}

export async function getArticlesWithDetailedSummary(limit: number = 50): Promise<Article[]> {
  const db = getClient();
  const result = await db.execute({
    sql: `
      SELECT * FROM articles
      WHERE detailed_summary IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows as unknown as Article[];
}

export async function getArticleByUrl(url: string): Promise<Article | null> {
  const db = getClient();
  const result = await db.execute({
    sql: "SELECT * FROM articles WHERE url = ?",
    args: [url],
  });
  return (result.rows[0] as unknown as Article) || null;
}

/**
 * Get all articles for search indexing
 */
export async function getAllArticles(): Promise<Article[]> {
  const db = getClient();
  const result = await db.execute(`
    SELECT * FROM articles
    ORDER BY created_at DESC
  `);
  return result.rows as unknown as Article[];
}
