import { ensureDb, isArticleSeen, saveArticle, markAsNotified, updateArticleDetailedSummary, updateArticleOgImage } from "./db";
import { fetchRss } from "./sources/rss";
import { fetchHackerNews } from "./sources/hackernews";
import { fetchGitHubTrending } from "./sources/github-trending";
import { filterArticles, type ArticleToFilter } from "./filter";
import { summarizeArticles } from "./summarize/summarize";
import { generateDetailedSummary, fetchArticleContentWithOgImage } from "./summarize/detailed-summary";
import { sendToDiscord, type NotifyArticle } from "./discord/notify";
import { createDigestEmbed, createCategoryEmbeds, sendEmbedsToDiscord, type DiscordEmbed } from "./discord/discord-embed";
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
 * Check if article has substantial content (>50 chars, not just HN metadata)
 */
function hasSubstantialContent(content?: string): boolean {
  if (!content || content.trim().length < 50) return false;
  if (content.match(/^HN Score:\s*\d+点(、\d+コメント)?$/)) return false;
  return true;
}

/**
 * Fetch content and OG images for articles that lack substantial content
 */
async function enrichArticleContent(
  articles: ArticleToFilter[]
): Promise<ArticleToFilter[]> {
  const needsContent = articles.filter(a => !hasSubstantialContent(a.content));

  if (needsContent.length === 0) {
    console.log("  All articles have substantial content");
    return articles;
  }

  console.log(`  Fetching content for ${needsContent.length} articles...`);

  // Fetch content in parallel with concurrency limit
  const CONCURRENCY = 5;
  const results = new Map<string, { content: string; ogImage: string | null }>();

  for (let i = 0; i < needsContent.length; i += CONCURRENCY) {
    const batch = needsContent.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (article) => {
      try {
        const { content, ogImage } = await fetchArticleContentWithOgImage(article.url);
        if (content && content.length > 50) {
          results.set(article.url, { content, ogImage });
          const ogStatus = ogImage ? "📷" : "";
          console.log(`    ✓ ${article.title.slice(0, 40)}... (${content.length} chars) ${ogStatus}`);
        } else {
          // Still save OG image even if content is empty
          if (ogImage) {
            results.set(article.url, { content: "", ogImage });
            console.log(`    ✗ ${article.title.slice(0, 40)}... (no content, has OG image)`);
          } else {
            console.log(`    ✗ ${article.title.slice(0, 40)}... (no content)`);
          }
        }
      } catch (error) {
        console.log(`    ✗ ${article.title.slice(0, 40)}... (fetch error)`);
      }
    });
    await Promise.all(promises);
  }

  // Merge fetched content and OG images with original articles
  return articles.map(article => {
    const fetched = results.get(article.url);
    if (fetched) {
      return {
        ...article,
        content: fetched.content || article.content,
        og_image: fetched.ogImage || undefined,
      };
    }
    return article;
  });
}

/**
 * Run the newsfeed pipeline and return articles + embeds
 * Can be called from bot.ts for scheduled posting
 */
export async function runNewsfeed(): Promise<NewsfeedResult | null> {
  console.log("\n🚀 Starting newsfeed...");
  console.log(`GROQ_API_KEY: ${GROQ_API_KEY ? "set" : "not set"}`);

  // Initialize database
  await ensureDb();

  const allArticles: ArticleToFilter[] = [];

  // Fetch Hacker News (top stories only)
  const hnSource = await getHackerNewsSource();
  if (hnSource) {
    console.log(`\n📡 Fetching ${hnSource.name}...`);
    const hnItems = await fetchHackerNews(30);
    console.log(`  Found ${hnItems.length} items`);

    let added = 0;
    for (const item of hnItems) {
      if (added >= MAX_PER_SOURCE) break;
      if (!(await isArticleSeen(item.url))) {
        // Include score and comments as supplementary info for title-only articles
        const contentParts = [`HN Score: ${item.score}点`];
        if (item.comments > 0) {
          contentParts.push(`${item.comments}コメント`);
        }
        allArticles.push({
          title: item.title,
          url: item.url,
          source: hnSource.name,
          category: hnSource.category,
          content: contentParts.join("、"),
          published: item.published,
        });
        added++;
      }
    }
    console.log(`  Added ${added} new items`);
  }

  // Fetch RSS feeds (limit per source)
  for (const source of await getRssSources()) {
    console.log(`📡 Fetching ${source.name}...`);
    const items = await fetchRss(source.url);
    console.log(`  Found ${items.length} items`);

    let added = 0;
    for (const item of items) {
      if (added >= MAX_PER_SOURCE) break;
      if (!(await isArticleSeen(item.url))) {
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
  const ghSource = await getGitHubTrendingSource();
  if (ghSource) {
    console.log(`📡 Fetching ${ghSource.name}...`);
    const repos = await fetchGitHubTrending(ghSource.languages);
    console.log(`  Found ${repos.length} repos`);

    let added = 0;
    for (const repo of repos) {
      if (added >= MAX_PER_SOURCE) break;
      if (!(await isArticleSeen(repo.url))) {
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

  // Fetch content for articles lacking substantial content
  console.log("\n📥 Fetching article content...");
  const articlesWithContent = await enrichArticleContent(topArticles);

  // Update OG images in database
  const articlesWithOgImage = articlesWithContent.filter(a => a.og_image);
  if (articlesWithOgImage.length > 0) {
    console.log(`\n🖼️ Saving ${articlesWithOgImage.length} OG images...`);
    for (const article of articlesWithOgImage) {
      if (article.og_image) {
        await updateArticleOgImage(article.url, article.og_image);
      }
    }
  }

  // Summarize
  console.log("\n✍️ Summarizing...");
  const summarized = await summarizeArticles(articlesWithContent, GROQ_API_KEY);

  // Generate detailed summaries for selected articles
  console.log("\n📝 Generating detailed summaries...");
  for (const article of summarized) {
    try {
      const detailed = await generateDetailedSummary(
        {
          title: article.title,
          url: article.url,
          source: article.source,
          category: article.category,
          summary: article.summary,
        },
        GROQ_API_KEY
      );
      // Store in DB
      await updateArticleDetailedSummary(
        article.url,
        detailed.detailedSummary,
        detailed.keyPoints,
        detailed.targetAudience
      );
      console.log(`  ✓ ${article.title.slice(0, 40)}...`);
    } catch (error) {
      console.error(`  ✗ Failed for ${article.url}:`, error);
    }
  }

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
    await saveArticle({
      url: article.url,
      title: article.title,
      source: article.source,
      category: article.category,
      notified: false,
    });
  }

  // Create embeds
  let embeds: DiscordEmbed[];
  if (EMBED_FORMAT === "digest") {
    embeds = await createDigestEmbed(toNotify);
  } else if (EMBED_FORMAT === "category") {
    embeds = await createCategoryEmbeds(toNotify);
  } else {
    embeds = []; // text format uses sendToDiscord directly
  }

  console.log(`\n✨ Prepared ${toNotify.length} articles`);
  return { articles: toNotify, embeds };
}

/**
 * Mark articles as notified (call after successful send)
 */
export async function markArticlesNotified(articles: NotifyArticle[]) {
  await markAsNotified(articles.map((a) => a.url));
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
      await markArticlesNotified(result.articles);
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
