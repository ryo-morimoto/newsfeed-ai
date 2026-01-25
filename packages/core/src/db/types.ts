export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  detailed_summary?: string;
  /** JSON array stored as string in database */
  key_points?: string;
  target_audience?: string;
  /** Open Graph image URL */
  og_image?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  /** Whether the article has been notified to Discord */
  notified: boolean;
}

/**
 * Raw article row from database (notified stored as INTEGER 0/1)
 */
export interface ArticleRow {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  detailed_summary?: string;
  key_points?: string;
  target_audience?: string;
  og_image?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  notified: number;
}

/**
 * Convert database row to Article domain type
 */
export function rowToArticle(row: ArticleRow): Article {
  return {
    ...row,
    notified: row.notified === 1,
  };
}

export interface PendingTaskNotification {
  id?: number;
  task_id: string;
  channel_id: string;
  message_id: string;
  created_at?: string;
  notified_at?: string;
}

export interface DbConfig {
  /** Path to SQLite database file (used if Turso not configured) */
  dbPath?: string;
  /** Turso database URL */
  tursoUrl?: string;
  /** Turso auth token */
  tursoToken?: string;
}
