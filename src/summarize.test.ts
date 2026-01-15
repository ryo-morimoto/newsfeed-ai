import { test, expect, describe, mock, afterEach } from "bun:test";
import { summarizeArticles, type ArticleToSummarize } from "./summarize";

const sampleArticles: ArticleToSummarize[] = [
  {
    title: "AI Research Paper",
    url: "https://example.com/ai",
    source: "arXiv",
    category: "ai",
    content: "This paper presents a new approach to language models.",
  },
  {
    title: "React New Features",
    url: "https://example.com/react",
    source: "Dev Blog",
    category: "frontend",
    content: "React 20 introduces server components.",
  },
  {
    title: "日本のテックニュース",
    url: "https://example.com/jp",
    source: "Zenn",
    category: "tech-jp",
    content: "日本語の記事です。",
  },
];

describe("summarizeArticles", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("returns articles with empty summary when no API key", async () => {
    const result = await summarizeArticles(sampleArticles, "");
    
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.summary).toBe("");
    }
  });

  test("returns empty array for empty input", async () => {
    const result = await summarizeArticles([], "fake-key");
    expect(result).toEqual([]);
  });

  test("skips Japanese articles (tech-jp category)", async () => {
    const japaneseOnly: ArticleToSummarize[] = [{
      title: "日本語記事",
      url: "https://example.com/jp",
      source: "Zenn",
      category: "tech-jp",
      content: "内容",
    }];

    // Should not call API when only Japanese articles
    const fetchMock = mock(async () => {
      throw new Error("Should not be called");
    });
    globalThis.fetch = fetchMock as typeof fetch;

    const result = await summarizeArticles(japaneseOnly, "test-api-key");
    
    expect(result.length).toBe(1);
    expect(result[0].summary).toBe("");
  });

  test("summarizes non-Japanese articles", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, summary: "AIモデルの新しいアプローチ" },
              { index: 1, summary: "ReactのRSC機能" },
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await summarizeArticles(sampleArticles, "test-api-key");
    
    // Find non-Japanese articles
    const aiArticle = result.find(a => a.category === "ai");
    const frontendArticle = result.find(a => a.category === "frontend");
    const jpArticle = result.find(a => a.category === "tech-jp");
    
    expect(aiArticle?.summary).toBe("AIモデルの新しいアプローチ");
    expect(frontendArticle?.summary).toBe("ReactのRSC機能");
    expect(jpArticle?.summary).toBe(""); // Japanese article gets empty summary
  });

  test("handles API error gracefully", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Error", { status: 500 });
    }) as typeof fetch;

    const result = await summarizeArticles(sampleArticles, "test-api-key");
    
    // Should return all articles with empty summaries on error
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.summary).toBe("");
    }
  });

  test("handles malformed JSON response", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: "Not valid JSON"
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const result = await summarizeArticles(sampleArticles, "test-api-key");
    
    expect(result.length).toBe(sampleArticles.length);
    for (const article of result) {
      expect(article.summary).toBe("");
    }
  });

  test("preserves original article properties", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, summary: "要約" },
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const articles: ArticleToSummarize[] = [{
      title: "Test Title",
      url: "https://test.com",
      source: "Test Source",
      category: "ai",
      content: "Content",
      published: new Date("2024-01-15"),
    }];

    const result = await summarizeArticles(articles, "test-api-key");
    
    expect(result[0].title).toBe("Test Title");
    expect(result[0].url).toBe("https://test.com");
    expect(result[0].source).toBe("Test Source");
    expect(result[0].category).toBe("ai");
    expect(result[0].published).toEqual(new Date("2024-01-15"));
    expect(result[0].summary).toBe("要約");
  });
});
