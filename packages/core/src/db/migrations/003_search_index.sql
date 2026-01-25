-- packages/core/src/db/migrations/003_search_index.sql
CREATE TABLE IF NOT EXISTS search_index (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data BLOB NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
