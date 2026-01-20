#!/usr/bin/env bun
/**
 * SQLiteからTursoへのデータ移行スクリプト
 *
 * Usage: bun run scripts/migrate-to-turso.ts [sqlite-path]
 *
 * 環境変数:
 *   TURSO_DATABASE_URL - TursoのURL
 *   TURSO_AUTH_TOKEN - Tursoの認証トークン
 */

import { Database } from "bun:sqlite";
import { createClient } from "@libsql/client";

const SQLITE_PATH = process.argv[2] || "./data/history.db";

async function migrate() {
  // 環境変数チェック
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error("Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set");
    process.exit(1);
  }

  // ローカルSQLiteを開く
  console.log(`Opening local SQLite: ${SQLITE_PATH}`);
  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  // Tursoに接続
  console.log(`Connecting to Turso: ${tursoUrl}`);
  const turso = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  // テーブル作成
  console.log("Creating tables in Turso...");
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS articles (
      url TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT,
      detailed_summary TEXT,
      category TEXT NOT NULL DEFAULT 'tech',
      source TEXT NOT NULL,
      hn_score INTEGER,
      hn_comments INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await turso.execute(`
    CREATE TABLE IF NOT EXISTS task_notifications (
      task_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // articlesテーブルの移行
  console.log("Migrating articles...");
  const articles = sqlite.query("SELECT * FROM articles").all() as any[];
  console.log(`Found ${articles.length} articles to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const article of articles) {
    try {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO articles
              (url, title, summary, detailed_summary, category, source, hn_score, hn_comments, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          article.url,
          article.title,
          article.summary || null,
          article.detailed_summary || null,
          article.category || "tech",
          article.source,
          article.hn_score || null,
          article.hn_comments || null,
          article.created_at || new Date().toISOString(),
        ],
      });
      migrated++;
      if (migrated % 100 === 0) {
        console.log(`  Migrated ${migrated}/${articles.length} articles...`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("UNIQUE constraint")) {
        skipped++;
      } else {
        console.error(`  Error migrating article ${article.url}:`, message);
      }
    }
  }

  console.log(`Articles migration complete: ${migrated} migrated, ${skipped} skipped (already exist)`);

  // task_notificationsテーブルの移行
  try {
    const tasks = sqlite.query("SELECT * FROM task_notifications").all() as any[];
    console.log(`Found ${tasks.length} task notifications to migrate`);

    for (const task of tasks) {
      try {
        await turso.execute({
          sql: `INSERT OR IGNORE INTO task_notifications
                (task_id, channel_id, message_id, created_at)
                VALUES (?, ?, ?, ?)`,
          args: [
            task.task_id,
            task.channel_id,
            task.message_id,
            task.created_at || new Date().toISOString(),
          ],
        });
      } catch (error) {
        // Skip duplicates
      }
    }
    console.log("Task notifications migration complete");
  } catch (error) {
    console.log("No task_notifications table found, skipping...");
  }

  // 検証
  console.log("\nVerifying migration...");
  const tursoCount = await turso.execute("SELECT COUNT(*) as count FROM articles");
  const count = tursoCount.rows[0]?.count ?? 0;
  console.log(`Turso articles count: ${count}`);

  sqlite.close();
  console.log("\nMigration complete!");
}

migrate().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
