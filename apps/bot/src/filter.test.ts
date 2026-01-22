import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";
import { filterArticles, type ArticleToFilter } from "./filter";

// Use today's date so freshness factor is 1.0
const today = new Date();

const sampleArticles: ArticleToFilter[] = [
  {
    title: "New Claude Model Released",
    url: "https://example.com/claude",
    source: "AI News",
    category: "ai",
    content: "Anthropic releases Claude 4 with improved reasoning.",
    published: today,
  },
  {
    title: "React 20 Features",
    url: "https://example.com/react",
    source: "Dev Blog",
    category: "frontend",
    content: "New React version with RSC improvements.",
    published: today,
  },
  {
    title: "Random Unrelated News",
    url: "https://example.com/random",
    source: "News",
    category: "tech",
    content: "Something not related to user interests.",
    published: today,
  },
];

describe("filterArticles", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns all articles unfiltered when no API key", async () => {
    const result = await filterArticles(sampleArticles, "");

    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.score).toBe(0.5);
      expect(article.reason).toBe("unfiltered");
    }
  });

  test("returns empty array for empty input", async () => {
    const result = await filterArticles([], "fake-key");
    expect(result).toEqual([]);
  });

  test("filters and scores articles based on API response", async () => {
    // Mock the Groq API response
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 0, score: 0.9, reason: "AI model release" },
                  { index: 1, score: 0.7, reason: "React update" },
                  // index 2 excluded (score < 0.5)
                ]),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    expect(result.length).toBe(2);
    expect(result[0].score).toBeCloseTo(0.9, 2);
    expect(result[0].title).toBe("New Claude Model Released");
    expect(result[1].score).toBeCloseTo(0.7, 2);
  });

  test("sorts results by score descending", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 0, score: 0.6, reason: "Medium" },
                  { index: 1, score: 0.9, reason: "High" },
                  { index: 2, score: 0.5, reason: "Low" },
                ]),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    // Should be sorted by score descending (with freshness applied)
    expect(result[0].score).toBeCloseTo(0.9, 2);
    expect(result[1].score).toBeCloseTo(0.6, 2);
    expect(result[2].score).toBeCloseTo(0.5, 2);
  });

  test("handles API error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    // Should return all articles with default score on error (with freshness applied)
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.score).toBeCloseTo(0.5, 2);
      expect(article.reason).toBe("api error");
    }
  });

  test("handles malformed JSON in API response", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "This is not valid JSON array",
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    // No valid JSON array found, so no articles pass
    expect(result.length).toBe(0);
  });

  test("handles network error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error");
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    // Should return all articles with error reason
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.reason).toBe("error");
    }
  });

  test("extracts JSON from markdown code blocks", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content:
                  'Here\'s the result:\n```json\n[{"index": 0, "score": 0.8, "reason": "relevant"}]\n```',
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");

    expect(result.length).toBe(1);
    expect(result[0].score).toBeCloseTo(0.8, 2);
  });

  test("applies freshness penalty to old articles", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const oldArticles: ArticleToFilter[] = [
      {
        title: "Old Article",
        url: "https://example.com/old",
        source: "News",
        category: "tech",
        content: "Old content",
        published: threeDaysAgo,
      },
    ];

    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([{ index: 0, score: 1.0, reason: "Very relevant" }]),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(oldArticles, "test-api-key");

    expect(result.length).toBe(1);
    // Score should be reduced by ~30% (3 days * 10% per day)
    // 1.0 * 0.7 = 0.7
    expect(result[0].score).toBeCloseTo(0.7, 1);
  });

  test("excludes articles older than MAX_AGE_DAYS", async () => {
    const twoWeeksAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    const veryOldArticles: ArticleToFilter[] = [
      {
        title: "Very Old Article",
        url: "https://example.com/very-old",
        source: "News",
        category: "tech",
        content: "Very old content",
        published: twoWeeksAgo,
      },
    ];

    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([{ index: 0, score: 1.0, reason: "Very relevant" }]),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(veryOldArticles, "test-api-key");

    // Article should be excluded because it's older than 14 days
    expect(result.length).toBe(0);
  });

  test("fresh articles rank higher than older equally-scored articles", async () => {
    const now = new Date();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const mixedArticles: ArticleToFilter[] = [
      {
        title: "Old High Relevance",
        url: "https://example.com/old-high",
        source: "News",
        category: "tech",
        content: "Old but relevant",
        published: fiveDaysAgo,
      },
      {
        title: "New Medium Relevance",
        url: "https://example.com/new-medium",
        source: "News",
        category: "tech",
        content: "Fresh content",
        published: now,
      },
    ];

    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  { index: 0, score: 0.9, reason: "Very relevant but old" },
                  { index: 1, score: 0.7, reason: "Somewhat relevant and fresh" },
                ]),
              },
            },
          ],
        }),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const result = await filterArticles(mixedArticles, "test-api-key");

    expect(result.length).toBe(2);
    // New article (0.7 * 1.0 = 0.7) should rank higher than
    // old article (0.9 * 0.5 = 0.45)
    expect(result[0].title).toBe("New Medium Relevance");
    expect(result[1].title).toBe("Old High Relevance");
  });
});
