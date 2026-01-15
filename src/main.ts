import { ensureDb, isArticleSeen, saveArticle, markAsNotified } from "./db";
import { fetchRss } from "./sources/rss";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchGitHubTrending } from "./sources/github-trending";
import { filterArticles, type ArticleToFilter } from "./filter";
import { summarizeArticles } from "./summarize";
import { sendToDiscord, type NotifyArticle } from "./notify";
import { createDigestEmbed, createCategoryEmbeds, sendEmbedsToDiscord, type DiscordEmbed } from "./discord-embed";
import {
  getRssSources,
  getHackerNewsSource,
  getGitHubTrendingSource,
} from "./config";

// Environment variables
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DRY_RUN = process.env.DRY_RUN === "true";
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || "20");
const MAX_PER_SOURCE = parseInt(process.env.MAX_PER_SOURCE || "10"); // Limit per source before filtering
const EMBED_FORMAT = process.env.EMBED_FORMAT || "text"; // text, digest, category

export interface NewsfeedResult {
  articles: NotifyArticle[];
  embeds: DiscordEmbed[];
}

/**
 * Run the newsfeed pipeline and return articles + embeds
 * Can be called from bot.ts for scheduled posting
 */
export async function runNewsfeed(): Promise<NewsfeedResult | null> {
  console.log("\n🚀 Starting newsfeed...");
  console.log(`GROQ_API_KEY: ${GROQ_API_KEY ? "set" : "not set"}`);

  // Initialize database
  ensureDb();

  const allArticles: ArticleToFilter[] = [];

  // Fetch Hacker News (top stories only)
  const hnSource = getHackerNewsSource();
  if (hnSource) {
    console.log(`\n📡 Fetching ${hnSource.name}...`);
    const hnItems = await fetchHackerNews(30);
    console.log(`  Found ${hnItems.length} items`);

    let added = 0;
    for (const item of hnItems) {
      if (added >= MAX_PER_SOURCE) break;
      if (!isArticleSeen(item.url)) {
        allArticles.push({
          title: item.title,
          url: item.url,
          source: hnSource.name,
          category: hnSource.category,
          content: `Score: ${item.score}`,
          published: item.published,
        });
        added++;
      }
    }
    console.log(`  Added ${added} new items`);
  }

  // Fetch RSS feeds (limit per source)
  for (const source of getRssSources()) {
    console.log(`📡 Fetching ${source.name}...`);
    const items = await fetchRss(source.url);
    console.log(`  Found ${items.length} items`);

    let added = 0;
    for (const item of items) {
      if (added >= MAX_PER_SOURCE) break;
      if (!isArticleSeen(item.url)) {
        allArticles.push({
          title: item.title,
          url: item.url,
          source: source.name,
          category: source.category,
          content: item.content,
          published: item.published,
        });
        added++;
      }
    }
    console.log(`  Added ${added} new items`);
  }

  // Fetch GitHub Trending
  const ghSource = getGitHubTrendingSource();
  if (ghSource) {
    console.log(`📡 Fetching ${ghSource.name}...`);
    const repos = await fetchGitHubTrending(ghSource.languages);
    console.log(`  Found ${repos.length} repos`);

    let added = 0;
    for (const repo of repos) {
      if (added >= MAX_PER_SOURCE) break;
      if (!isArticleSeen(repo.url)) {
        allArticles.push({
          title: repo.title,
          url: repo.url,
          source: `GitHub (${repo.language})`,
          category: ghSource.category,
          content: `${repo.description} (★${repo.stars} today)`,
        });
        added++;
      }
    }
    console.log(`  Added ${added} new repos`);
  }

  console.log(`\n📊 Total new articles: ${allArticles.length}`);

  if (allArticles.length === 0) {
    console.log("No new articles found.");
    return null;
  }

  // Filter with Claude
  console.log("\n🧠 Filtering with Claude...");
  const filtered = await filterArticles(allArticles, GROQ_API_KEY);
  console.log(`  Passed filter: ${filtered.length}`);

  // Take top N
  const topArticles = filtered.slice(0, MAX_ARTICLES);
  console.log(`  Top ${topArticles.length} selected`);

  // Summarize
  console.log("\n✍️ Summarizing...");
  const summarized = await summarizeArticles(topArticles, GROQ_API_KEY);

  // Prepare for notification
  const toNotify: NotifyArticle[] = summarized.map((a) => ({
    title: a.title,
    url: a.url,
    summary: a.summary,
    category: a.category,
    source: a.source,
    published: a.published,
  }));

  // Save all fetched articles to DB (for dedup next time)
  console.log("\n💾 Saving to database...");
  for (const article of allArticles) {
    saveArticle({
      url: article.url,
      title: article.title,
      source: article.source,
      category: article.category,
      notified: 0,
    });
  }

  // Create embeds
  let embeds: DiscordEmbed[];
  if (EMBED_FORMAT === "digest") {
    embeds = createDigestEmbed(toNotify);
  } else if (EMBED_FORMAT === "category") {
    embeds = createCategoryEmbeds(toNotify);
  } else {
    embeds = []; // text format uses sendToDiscord directly
  }

  console.log(`\n✨ Prepared ${toNotify.length} articles`);
  return { articles: toNotify, embeds };
}

/**
 * Mark articles as notified (call after successful send)
 */
export function markArticlesNotified(articles: NotifyArticle[]) {
  markAsNotified(articles.map((a) => a.url));
}

async function main() {
  console.log("Running main.ts directly (CLI mode)...");
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`DISCORD_WEBHOOK: ${DISCORD_WEBHOOK ? "set" : "not set"}`);

  const result = await runNewsfeed();
  if (!result) {
    console.log("No articles to send.");
    return;
  }

  // Print results
  console.log("\n📝 Results:");
  for (const article of result.articles) {
    console.log(`  [${article.category}] ${article.title}`);
    if (article.summary) console.log(`    → ${article.summary}`);
  }

  // Send to Discord (webhook) - for CLI testing
  if (!DRY_RUN && DISCORD_WEBHOOK) {
    console.log(`\n📤 Sending to Discord via webhook...`);
    const success = await sendEmbedsToDiscord(DISCORD_WEBHOOK, result.embeds);
    if (success) {
      markArticlesNotified(result.articles);
      console.log("✅ Notifications sent!");
    }
  } else {
    console.log("\n⚠️ Dry run or no webhook configured");
  }

  console.log("\n✨ Done!");
}

// Only run main() if executed directly (not imported)
if (import.meta.main) {
  main().catch(console.error);
}
