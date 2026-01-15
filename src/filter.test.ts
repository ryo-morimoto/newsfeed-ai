import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";
import { filterArticles, type ArticleToFilter } from "./filter";

const sampleArticles: ArticleToFilter[] = [
  {
    title: "New Claude Model Released",
    url: "https://example.com/claude",
    source: "AI News",
    category: "ai",
    content: "Anthropic releases Claude 4 with improved reasoning.",
  },
  {
    title: "React 20 Features",
    url: "https://example.com/react",
    source: "Dev Blog",
    category: "frontend",
    content: "New React version with RSC improvements.",
  },
  {
    title: "Random Unrelated News",
    url: "https://example.com/random",
    source: "News",
    category: "tech",
    content: "Something not related to user interests.",
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
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, score: 0.9, reason: "AI model release" },
              { index: 1, score: 0.7, reason: "React update" },
              // index 2 excluded (score < 0.5)
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    expect(result.length).toBe(2);
    expect(result[0].score).toBe(0.9);
    expect(result[0].title).toBe("New Claude Model Released");
    expect(result[1].score).toBe(0.7);
  });

  test("sorts results by score descending", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, score: 0.6, reason: "Medium" },
              { index: 1, score: 0.9, reason: "High" },
              { index: 2, score: 0.5, reason: "Low" },
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    // Should be sorted by score descending
    expect(result[0].score).toBe(0.9);
    expect(result[1].score).toBe(0.6);
    expect(result[2].score).toBe(0.5);
  });

  test("handles API error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Internal Server Error", { status: 500 });
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    // Should return all articles with default score on error
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.score).toBe(0.5);
      expect(article.reason).toBe("api error");
    }
  });

  test("handles malformed JSON in API response", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "This is not valid JSON array"
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    // No valid JSON array found, so no articles pass
    expect(result.length).toBe(0);
  });

  test("handles network error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("Network error");
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    // Should return all articles with error reason
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.reason).toBe("error");
    }
  });

  test("extracts JSON from markdown code blocks", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "Here's the result:\n```json\n[{\"index\": 0, \"score\": 0.8, \"reason\": \"relevant\"}]\n```"
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await filterArticles(sampleArticles, "test-api-key");
    
    expect(result.length).toBe(1);
    expect(result[0].score).toBe(0.8);
  });
});
