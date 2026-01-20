export interface Article {
  id?: number;
  url: string;
  title: string;
  source: string;
  category: string;
  summary?: string;
  detailed_summary?: string;
  key_points?: string; // JSON array stored as string
  target_audience?: string;
  score?: number;
  published_at?: string;
  created_at?: string;
  notified: number;
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
