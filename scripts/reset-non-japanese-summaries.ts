#!/usr/bin/env bun
/**
 * Reset non-Japanese detailed summaries to allow regeneration
 * Finds articles with detailed_summary that doesn't contain Japanese characters
 * and sets detailed_summary to NULL so the background job can regenerate them
 *
 * Usage: bun scripts/reset-non-japanese-summaries.ts [--dry-run]
 */

// Load DB adapter to set up client factory
import "../apps/bot/src/adapters/db-adapter";
import { ensureDb, getDb } from "../packages/core/src/db";

interface ArticleWithSummary {
  url: string;
  title: string;
  detailed_summary: string;
}

/**
 * Check if text contains substantial Japanese characters
 * Returns true if at least 10% of the text is Japanese
 */
function containsJapanese(text: string): boolean {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g;
  const matches = text.match(japaneseRegex);
  if (!matches) return false;
  // At least 10% should be Japanese characters for a meaningful Japanese summary
  return matches.length >= text.length * 0.1;
}

async function getArticlesWithNonJapaneseSummaries(): Promise<ArticleWithSummary[]> {
  const client = await getDb();
  const result = await client.execute(`
    SELECT url, title, detailed_summary FROM articles
    WHERE detailed_summary IS NOT NULL
      AND detailed_summary != ''
    ORDER BY created_at DESC
  `);

  // Filter to only non-Japanese summaries
  return (result.rows as unknown as ArticleWithSummary[]).filter(
    (article) => !containsJapanese(article.detailed_summary)
  );
}

async function resetDetailedSummary(url: string): Promise<void> {
  const client = await getDb();
  await client.execute({
    sql: "UPDATE articles SET detailed_summary = NULL, key_points = NULL, target_audience = NULL WHERE url = ?",
    args: [url],
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("🔄 Reset Non-Japanese Summaries Script\n");
  if (dryRun) {
    console.log("⚠️  DRY RUN MODE - no changes will be made\n");
  }

  // Initialize database
  await ensureDb({
    tursoUrl: process.env.TURSO_DATABASE_URL,
    tursoToken: process.env.TURSO_AUTH_TOKEN,
    dbPath: process.env.DB_PATH,
  });

  // Get articles with non-Japanese summaries
  const articles = await getArticlesWithNonJapaneseSummaries();
  console.log(`Found ${articles.length} articles with non-Japanese summaries\n`);

  if (articles.length === 0) {
    console.log("✅ All summaries are in Japanese!");
    return;
  }

  // Show preview
  console.log("Articles to reset:");
  for (const article of articles) {
    console.log(`  - ${article.title.slice(0, 60)}...`);
    console.log(`    URL: ${article.url}`);
    console.log(`    Summary preview: ${article.detailed_summary.slice(0, 100)}...`);
    console.log();
  }

  if (dryRun) {
    console.log(`\n⚠️  DRY RUN: Would reset ${articles.length} articles`);
    console.log("Run without --dry-run to apply changes");
    return;
  }

  // Reset summaries
  console.log("\nResetting summaries...");
  let success = 0;
  for (const article of articles) {
    try {
      await resetDetailedSummary(article.url);
      console.log(`  ✓ ${article.title.slice(0, 50)}...`);
      success++;
    } catch (error) {
      console.error(`  ✗ ${article.title.slice(0, 50)}...`, error);
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Total non-Japanese: ${articles.length}`);
  console.log(`  Reset: ${success}`);
  console.log("\n✅ Reset complete!");
  console.log("Run the bot or wait for background job to regenerate summaries in Japanese.");
}

main().catch(console.error);
