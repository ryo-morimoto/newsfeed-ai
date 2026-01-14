import { initDb, isArticleSeen, saveArticle, markAsNotified } from "./db";
import { fetchRss } from "./sources/rss";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchGitHubTrending } from "./sources/github-trending";
import { filterArticles, type ArticleToFilter } from "./filter";
import { summarizeArticles } from "./summarize";
import { sendToDiscord, type NotifyArticle } from "./notify";

// Environment variables
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const DRY_RUN = process.env.DRY_RUN === "true";
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || "20");

// Source definitions
const RSS_SOURCES = [
  { name: "Lobsters", url: "https://lobste.rs/rss", category: "tech" },
  { name: "arXiv AI", url: "https://rss.arxiv.org/rss/cs.AI", category: "ai" },
  { name: "arXiv CL", url: "https://rss.arxiv.org/rss/cs.CL", category: "ai" },
  {
    name: "Hugging Face",
    url: "https://huggingface.co/blog/feed.xml",
    category: "ai",
  },
  { name: "Vercel", url: "https://vercel.com/atom", category: "frontend" },
  {
    name: "Laravel News",
    url: "https://laravel-news.com/feed",
    category: "backend",
  },
  { name: "Zenn", url: "https://zenn.dev/feed", category: "tech-jp" },
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "crypto",
  },
];

async function main() {
  console.log("\n🚀 Starting news bot...");
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`CLAUDE_API_KEY: ${CLAUDE_API_KEY ? "set" : "not set"}`);
  console.log(`DISCORD_WEBHOOK: ${DISCORD_WEBHOOK ? "set" : "not set"}`);

  // Initialize database
  initDb();
  console.log("✅ Database initialized");

  const allArticles: ArticleToFilter[] = [];

  // Fetch Hacker News
  console.log("\n📡 Fetching Hacker News...");
  const hnItems = await fetchHackerNews(30);
  console.log(`  Found ${hnItems.length} items`);

  for (const item of hnItems) {
    if (!isArticleSeen(item.url)) {
      allArticles.push({
        title: item.title,
        url: item.url,
        source: "Hacker News",
        category: "tech",
        content: `Score: ${item.score}`,
      });
    }
  }

  // Fetch RSS feeds
  for (const source of RSS_SOURCES) {
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
  console.log("📡 Fetching GitHub Trending...");
  const repos = await fetchGitHubTrending(["typescript", "rust", "go"]);
  console.log(`  Found ${repos.length} repos`);

  for (const repo of repos) {
    if (!isArticleSeen(repo.url)) {
      allArticles.push({
        title: repo.title,
        url: repo.url,
        source: `GitHub (${repo.language})`,
        category: "repos",
        content: `${repo.description} (★${repo.stars} today)`,
      });
    }
  }

  console.log(`\n📊 Total new articles: ${allArticles.length}`);

  if (allArticles.length === 0) {
    console.log("No new articles found. Exiting.");
    return;
  }

  // Filter with Claude
  console.log("\n🧠 Filtering with Claude...");
  const filtered = await filterArticles(allArticles, CLAUDE_API_KEY);
  console.log(`  Passed filter: ${filtered.length}`);

  // Take top N
  const topArticles = filtered.slice(0, MAX_ARTICLES);
  console.log(`  Top ${topArticles.length} selected`);

  // Summarize
  console.log("\n✍️ Summarizing...");
  const summarized = await summarizeArticles(topArticles, CLAUDE_API_KEY);

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
      notified: false,
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
