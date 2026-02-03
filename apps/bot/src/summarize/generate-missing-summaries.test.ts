import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { join, dirname } from "path";
import { unlinkSync, existsSync, mkdirSync } from "fs";
import { ensureDb, closeDb, saveArticle, markAsNotified, getArticleByUrl } from "../db";
import { generateMissingSummaries } from "./generate-missing-summaries";

const TEST_DB_PATH = join(import.meta.dir, "..", "..", "data", "test-generate-summaries.db");

// Skip search index sync in tests
process.env.SKIP_SEARCH_INDEX = "1";

describe("generateMissingSummaries", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Ensure data directory exists
    const dataDir = dirname(TEST_DB_PATH);
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    // Clean up any existing test DB
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Initialize with test DB path
    await ensureDb(TEST_DB_PATH);

    // Set API key for tests
    process.env.GROQ_API_KEY = "test-api-key";
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Clean up WAL files
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);

    // Restore
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  test("returns early when no API key", async () => {
    process.env.GROQ_API_KEY = "";

    const result = await generateMissingSummaries();

    expect(result.processed).toBe(0);
    expect(result.success).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.rateLimited).toBe(false);
  });

  test("returns early when no articles to process", async () => {
    const result = await generateMissingSummaries();

    expect(result.processed).toBe(0);
    expect(result.success).toBe(0);
  });

  test("skips articles that are not notified", async () => {
    // Save article but don't mark as notified (pipeline not complete)
    await saveArticle({
      url: "https://example.com/not-notified",
      title: "Not Notified Article",
      source: "Test",
      category: "tech",
      notified: false,
    });

    const result = await generateMissingSummaries();

    // Should not process because notified = false
    expect(result.processed).toBe(0);
  });

  test("processes notified articles without detailed summary", async () => {
    // Save article and mark as notified
    await saveArticle({
      url: "https://example.com/needs-summary",
      title: "Needs Summary",
      source: "Test",
      category: "tech",
      summary: "Short summary",
      notified: false,
    });
    await markAsNotified(["https://example.com/needs-summary"]);

    // Mock fetch to return successful detailed summary
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      // Article content fetch - needs at least 100 chars of content
      if (url.includes("example.com")) {
        const longContent = "This is a detailed article about technology. ".repeat(10);
        return new Response(`<html><article>${longContent}</article></html>`, { status: 200 });
      }
      // Groq API call
      if (url.includes("groq.com")) {
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                detailedSummary: "This is a detailed summary of the article.",
                keyPoints: ["Point 1", "Point 2"],
                targetAudience: "Developers",
              })
            }
          }]
        }), { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const result = await generateMissingSummaries();

    expect(result.processed).toBe(1);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);

    // Verify DB was updated
    const article = await getArticleByUrl("https://example.com/needs-summary");
    expect(article?.detailed_summary).toBe("This is a detailed summary of the article.");
  });

  // Note: Rate limit early-exit test is skipped because retry delays make it too slow.
  // The retry utility is well-tested separately in retry.test.ts

  test("handles API errors gracefully", async () => {
    await saveArticle({
      url: "https://example.com/error-article",
      title: "Error Article",
      source: "Test",
      category: "tech",
      notified: false,
    });
    await markAsNotified(["https://example.com/error-article"]);

    // Mock fetch to return 500 error for API, but success for content
    globalThis.fetch = mock(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

      if (url.includes("groq.com")) {
        return new Response("Internal Server Error", { status: 500 });
      }
      // Article content fetch - needs at least 100 chars
      const longContent = "This is article content for testing purposes. ".repeat(5);
      return new Response(`<html><article>${longContent}</article></html>`, { status: 200 });
    }) as unknown as typeof fetch;

    const result = await generateMissingSummaries();

    expect(result.processed).toBe(1);
    expect(result.failed).toBe(0); // Fallback is used, not counted as failure
    expect(result.rateLimited).toBe(false);
  });
});
