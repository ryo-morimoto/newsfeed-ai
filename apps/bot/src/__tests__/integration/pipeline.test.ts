import { test, expect, describe, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { join } from "path";
import { unlinkSync, existsSync } from "fs";
import { ensureDb, closeDb, isArticleSeen, getRecentArticles, saveArticle } from "../../db";
import { filterArticles, type ArticleToFilter } from "../../filter";
import { summarizeArticles, type ArticleToSummarize } from "../../summarize/summarize";
import { createCategoryEmbeds } from "../../discord/discord-embed";
import type { NotifyArticle } from "../../discord/notify";

const TEST_DB_PATH = join(import.meta.dir, "..", "..", "..", "data", "pipeline-test.db");

// Skip search index sync in tests (loads TensorFlow which is slow)
process.env.SKIP_SEARCH_INDEX = "1";

describe("Filter → Summarize Pipeline", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // Articles with substantial content (>50 chars) for proper summarization
  const testArticles: ArticleToFilter[] = [
    {
      title: "Claude 4 Released with AGI Capabilities",
      url: "https://anthropic.com/claude-4",
      source: "Anthropic Blog",
      category: "ai",
      content: "Anthropic announces Claude 4 with breakthrough reasoning capabilities that exceed human performance on complex tasks.",
    },
    {
      title: "New JavaScript Framework XYZ",
      url: "https://xyz.dev/launch",
      source: "XYZ Blog",
      category: "frontend",
      content: "Another JavaScript framework enters the arena with innovative component architecture and blazing fast performance.",
    },
    {
      title: "Local Sports Team Wins Game",
      url: "https://sports.com/game",
      source: "Sports News",
      category: "tech",
      content: "The local team won yesterday's game with an impressive performance by the star player who scored three goals.",
    },
  ];

  test("filter → summarize pipeline processes articles correctly", async () => {
    // Mock filter API
    let filterCalled = false;
    let summarizeCalled = false;

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = url.toString();

      if (!filterCalled) {
        filterCalled = true;
        // Filter response - only AI article passes
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify([
                { index: 0, score: 0.95, reason: "AI breakthrough" },
                { index: 1, score: 0.6, reason: "JS framework" },
                // index 2 excluded - not relevant
              ])
            }
          }]
        }), { status: 200 });
      } else {
        summarizeCalled = true;
        // Summarize response
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify([
                { index: 0, summary: "Claude 4がAGI能力を持ってリリース" },
                { index: 1, summary: "新しいJSフレームワークXYZが登場" },
              ])
            }
          }]
        }), { status: 200 });
      }
    }) as typeof fetch;

    // Run filter
    const filtered = await filterArticles(testArticles, "test-key");
    expect(filtered.length).toBe(2);
    expect(filtered[0].title).toContain("Claude");

    // Run summarize
    const summarized = await summarizeArticles(filtered, "test-key");
    expect(summarized.length).toBe(2);
    expect(summarized[0].summary).toContain("Claude 4");
    expect(summarized[1].summary).toContain("XYZ");
  });

  test("pipeline handles API failure gracefully", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Service Unavailable", { status: 503 });
    }) as typeof fetch;

    // Filter should return all with default score
    const filtered = await filterArticles(testArticles, "test-key");
    expect(filtered.length).toBe(3);
    expect(filtered.every(a => a.reason === "api error")).toBe(true);

    // Summarize should return all with original titles as fallback
    const summarized = await summarizeArticles(filtered, "test-key");
    expect(summarized.length).toBe(3);
    // On API error, fallback to original titles
    expect(summarized[0].summary).toBe("Claude 4 Released with AGI Capabilities");
    expect(summarized[1].summary).toBe("New JavaScript Framework XYZ");
    expect(summarized[2].summary).toBe("Local Sports Team Wins Game");
  });
});

describe("Full Pipeline: Source → Filter → Summarize → Embed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    await ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Also clean up WAL files
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
    globalThis.fetch = originalFetch;
  });

  test("end-to-end pipeline produces valid Discord embeds", async () => {
    // Mock all API calls
    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        // Filter
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify([
                { index: 0, score: 0.9, reason: "relevant" },
              ])
            }
          }]
        }), { status: 200 });
      } else {
        // Summarize
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify([
                { index: 0, summary: "テスト要約" },
              ])
            }
          }]
        }), { status: 200 });
      }
    }) as typeof fetch;

    // Simulate source data with substantial content (>50 chars)
    const sourceArticles: ArticleToFilter[] = [{
      title: "Test Article",
      url: "https://test.com/article",
      source: "Test Source",
      category: "ai",
      content: "This is a comprehensive test article about artificial intelligence and machine learning breakthroughs.",
    }];

    // Step 1: Filter
    const filtered = await filterArticles(sourceArticles, "test-key");
    expect(filtered.length).toBe(1);

    // Step 2: Summarize
    const summarized = await summarizeArticles(filtered, "test-key");
    expect(summarized[0].summary).toBe("テスト要約");

    // Step 3: Convert to NotifyArticle
    const toNotify: NotifyArticle[] = summarized.map(a => ({
      title: a.title,
      url: a.url,
      summary: a.summary,
      category: a.category,
      source: a.source,
      published: a.published,
    }));

    // Step 4: Create embeds
    const embeds = createCategoryEmbeds(toNotify);

    expect(embeds.length).toBeGreaterThan(0);
    expect(embeds[0].title).toBe("📰 Tech Digest");

    // Find AI category embed
    const aiEmbed = embeds.find(e => e.description?.includes("test.com"));
    expect(aiEmbed).toBeDefined();
  });

  test("pipeline skips already seen articles", async () => {
    // Pre-populate DB with seen article
    await saveArticle({
      url: "https://test.com/seen",
      title: "Already Seen",
      source: "Test",
      category: "tech",
      notified: 1,
    });

    // Source data includes seen and new
    const sourceArticles: ArticleToFilter[] = [
      {
        title: "Already Seen",
        url: "https://test.com/seen",
        source: "Test",
        category: "tech",
        content: "Old content",
      },
      {
        title: "New Article",
        url: "https://test.com/new",
        source: "Test",
        category: "tech",
        content: "New content",
      },
    ];

    // Filter out seen
    const newArticles: ArticleToFilter[] = [];
    for (const a of sourceArticles) {
      if (!(await isArticleSeen(a.url))) {
        newArticles.push(a);
      }
    }

    expect(newArticles.length).toBe(1);
    expect(newArticles[0].title).toBe("New Article");
  });

  test("pipeline respects category-based processing", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, summary: "English summary" },
              // index 1 is Japanese, should be skipped
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    // Articles with substantial content (>50 chars)
    const mixedArticles: ArticleToSummarize[] = [
      {
        title: "English Tech News",
        url: "https://tech.com/en",
        source: "Tech News",
        category: "tech",
        content: "This is comprehensive English content about the latest technology trends and innovations in the industry.",
      },
      {
        title: "日本語のニュース",
        url: "https://tech.com/jp",
        source: "Zenn",
        category: "tech-jp",
        content: "日本語の内容です。この記事では最新のテクノロジートレンドについて詳しく解説しています。",
      },
    ];

    const summarized = await summarizeArticles(mixedArticles, "test-key");

    // English article gets summary
    const enArticle = summarized.find(a => a.category === "tech");
    expect(enArticle?.summary).toBe("English summary");

    // Japanese article keeps empty summary (not sent to API)
    const jpArticle = summarized.find(a => a.category === "tech-jp");
    expect(jpArticle?.summary).toBe("");
  });
});
