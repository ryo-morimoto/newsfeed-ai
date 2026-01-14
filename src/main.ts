import { initDb, isArticleSeen, saveArticle, markAsNotified } from "./db";
import { Client, GatewayIntentBits, Events } from "discord.js";
import { sendArticlesViaBot } from "./bot-notify";
import { fetchRss } from "./sources/rss";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchGitHubTrending } from "./sources/github-trending";
import { filterArticles, type ArticleToFilter } from "./filter";
import { summarizeArticles } from "./summarize";
import { sendToDiscord, type NotifyArticle } from "./notify";
import { createDigestEmbed, createCategoryEmbeds, sendEmbedsToDiscord } from "./discord-embed";
import {
  getRssSources,
  getHackerNewsSource,
  getGitHubTrendingSource,
} from "./config";

// Environment variables
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const DRY_RUN = process.env.DRY_RUN === "true";
const MAX_ARTICLES = parseInt(process.env.MAX_ARTICLES || "20");
const MAX_PER_SOURCE = parseInt(process.env.MAX_PER_SOURCE || "10"); // Limit per source before filtering
const EMBED_FORMAT = process.env.EMBED_FORMAT || "text"; // text, digest, category
const USE_BOT = process.env.USE_BOT === "true"; // Use Bot instead of webhook

async function main() {
  console.log("\n🚀 Starting news bot...");
  console.log(`DRY_RUN: ${DRY_RUN}`);
  console.log(`GROQ_API_KEY: ${GROQ_API_KEY ? "set" : "not set"}`);
  console.log(`DISCORD_WEBHOOK: ${DISCORD_WEBHOOK ? "set" : "not set"}`);

  // Initialize database
  initDb();
  console.log("✅ Database initialized");

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

  // Print results
  console.log("\n📝 Results:");
  for (const article of toNotify) {
    console.log(`  [${article.category}] ${article.title}`);
    if (article.summary) console.log(`    → ${article.summary}`);
  }

  // Send to Discord
  if (!DRY_RUN) {
    let success = false;

    if (USE_BOT && DISCORD_BOT_TOKEN && DISCORD_CHANNEL_ID) {
      // Use Bot for posting (enables reaction tracking)
      console.log("\n📤 Sending via Discord Bot...");
      
      const client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
        ],
      });

      await client.login(DISCORD_BOT_TOKEN);
      
      // Wait for ready
      await new Promise<void>((resolve) => {
        client.once(Events.ClientReady, () => resolve());
      });

      success = await sendArticlesViaBot(client, DISCORD_CHANNEL_ID, toNotify);
      
      // Disconnect after sending
      client.destroy();
    } else if (DISCORD_WEBHOOK) {
      // Fallback to webhook
      console.log(`\n📤 Sending to Discord webhook (format: ${EMBED_FORMAT})...`);
      
      if (EMBED_FORMAT === "digest") {
        const embeds = createDigestEmbed(toNotify);
        success = await sendEmbedsToDiscord(DISCORD_WEBHOOK, embeds);
      } else if (EMBED_FORMAT === "category") {
        const embeds = createCategoryEmbeds(toNotify);
        success = await sendEmbedsToDiscord(DISCORD_WEBHOOK, embeds);
      } else {
        success = await sendToDiscord(DISCORD_WEBHOOK, toNotify);
      }
    } else {
      console.log("\n⚠️ No Discord credentials configured");
    }

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
