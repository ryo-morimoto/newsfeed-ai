import { initDb, isArticleSeen, saveArticle, markAsNotified } from "./db";
import { fetchRss } from "./sources/rss";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchGitHubTrending } from "./sources/github-trending";
import { filterArticles, type ArticleToFilter } from "./filter";
import { summarizeArticles } from "./summarize";
import { sendToDiscord, type NotifyArticle } from "./notify";
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

async function main() {
  console.log("\n🚀 Starting news bot...");
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`GROQ_API_KEY: ${GROQ_API_KEY ? "set" : "not set"}`);
  console.log(`DISCORD_WEBHOOK: ${DISCORD_WEBHOOK ? "set" : "not set"}`);

  // Initialize database
  initDb();
  console.log("✅ Database initialized");

  const allArticles: ArticleToFilter[] = [];

  // Fetch Hacker News
  const hnSource = getHackerNewsSource();
  if (hnSource) {
    console.log(`\n📡 Fetching ${hnSource.name}...`);
    const hnItems = await fetchHackerNews(30);
    console.log(`  Found ${hnItems.length} items`);

    for (const item of hnItems) {
      if (!isArticleSeen(item.url)) {
        allArticles.push({
          title: item.title,
          url: item.url,
          source: hnSource.name,
          category: hnSource.category,
          content: `Score: ${item.score}`,
        });
      }
    }
  }

  // Fetch RSS feeds
  for (const source of getRssSources()) {
    console.log(`📡 Fetching ${source.name}...`);
    const items = await fetchRss(source.url);
    console.log(`  Found ${items.length} items`);

    for (const item of items) {
      if (!isArticleSeen(item.url)) {
        allArticles.push({
          title: item.title,
          url: item.url,
          source: source.name,
          category: source.category,
          content: item.content,
        });
      }
    }
  }

  // Fetch GitHub Trending
  const ghSource = getGitHubTrendingSource();
  if (ghSource) {
    console.log(`📡 Fetching ${ghSource.name}...`);
    const repos = await fetchGitHubTrending(ghSource.languages);
    console.log(`  Found ${repos.length} repos`);

    for (const repo of repos) {
      if (!isArticleSeen(repo.url)) {
        allArticles.push({
          title: repo.title,
          url: repo.url,
          source: `GitHub (${repo.language})`,
          category: ghSource.category,
          content: `${repo.description} (★${repo.stars} today)`,
        });
      }
    }
  }

  console.log(`\n📊 Total new articles: ${allArticles.length}`);

  if (allArticles.length === 0) {
    console.log("No new articles found. Exiting.");
    return;
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
    category: (a as ArticleToFilter).category,
    source: (a as ArticleToFilter).source,
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

  // Print results
  console.log("\n📝 Results:");
  for (const article of toNotify) {
    console.log(`  [${article.category}] ${article.title}`);
    if (article.summary) console.log(`    → ${article.summary}`);
  }

  // Send to Discord
  if (!DRY_RUN && DISCORD_WEBHOOK) {
    console.log("\n📤 Sending to Discord...");
    const success = await sendToDiscord(DISCORD_WEBHOOK, toNotify);
    if (success) {
      markAsNotified(toNotify.map((a) => a.url));
      console.log("✅ Notifications sent!");
    }
  } else {
    console.log("\n⚠️ Dry run - not sending to Discord");
  }

  console.log("\n✨ Done!");
}

main().catch(console.error);
