#!/usr/bin/env bun
/**
 * Backfill OG images for existing articles
 * Run once to populate og_image for articles that don't have it
 *
 * Usage: bun scripts/backfill-og-images.ts
 */

import { ensureDb, getDb } from "../packages/core/src/db";
import { fetchArticleContentWithOgImage } from "../apps/bot/src/summarize/detailed-summary";

const CONCURRENCY = 3; // Limit concurrent requests
const DELAY_MS = 500; // Delay between batches to be nice to servers

interface ArticleToBackfill {
  url: string;
  title: string;
}

async function getArticlesWithoutOgImage(): Promise<ArticleToBackfill[]> {
  const client = await getDb();
  const result = await client.execute(`
    SELECT url, title FROM articles
    WHERE og_image IS NULL
    ORDER BY created_at DESC
  `);
  return result.rows as unknown as ArticleToBackfill[];
}

async function updateOgImage(url: string, ogImage: string): Promise<void> {
  const client = await getDb();
  await client.execute({
    sql: "UPDATE articles SET og_image = ? WHERE url = ?",
    args: [ogImage, url],
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("🖼️  OG Image Backfill Script\n");

  // Initialize database
  await ensureDb({
    dbPath: process.env.DB_PATH,
  });

  // Get articles without OG images
  const articles = await getArticlesWithoutOgImage();
  console.log(`Found ${articles.length} articles without OG images\n`);

  if (articles.length === 0) {
    console.log("✅ Nothing to backfill!");
    return;
  }

  let processed = 0;
  let success = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < articles.length; i += CONCURRENCY) {
    const batch = articles.slice(i, i + CONCURRENCY);

    const promises = batch.map(async (article) => {
      try {
        const { ogImage } = await fetchArticleContentWithOgImage(article.url);
        if (ogImage) {
          await updateOgImage(article.url, ogImage);
          console.log(`  ✓ ${article.title.slice(0, 50)}...`);
          success++;
        } else {
          console.log(`  - ${article.title.slice(0, 50)}... (no OG image)`);
        }
      } catch (error) {
        console.log(`  ✗ ${article.title.slice(0, 50)}... (error)`);
        failed++;
      }
      processed++;
    });

    await Promise.all(promises);

    // Progress update
    const progress = Math.round((processed / articles.length) * 100);
    console.log(`\n[${progress}%] Processed ${processed}/${articles.length}\n`);

    // Delay between batches
    if (i + CONCURRENCY < articles.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n📊 Summary:");
  console.log(`  Total: ${articles.length}`);
  console.log(`  Success: ${success}`);
  console.log(`  No OG image: ${articles.length - success - failed}`);
  console.log(`  Failed: ${failed}`);
  console.log("\n✅ Backfill complete!");
}

main().catch(console.error);
