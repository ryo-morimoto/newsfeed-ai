import { test, expect, describe, mock, afterEach } from "bun:test";
import { summarizeArticles, type ArticleToSummarize } from "./summarize";

// Sample articles with substantial content (>50 chars) for proper summarization
const sampleArticles: ArticleToSummarize[] = [
  {
    title: "AI Research Paper",
    url: "https://example.com/ai",
    source: "arXiv",
    category: "ai",
    content: "This paper presents a new approach to language models using a novel architecture that achieves state-of-the-art results.",
  },
  {
    title: "React New Features",
    url: "https://example.com/react",
    source: "Dev Blog",
    category: "frontend",
    content: "React 20 introduces server components with significant performance improvements and better developer experience for building web applications.",
  },
  {
    title: "日本のテックニュース",
    url: "https://example.com/jp",
    source: "Zenn",
    category: "tech-jp",
    content: "日本語の記事です。この記事では最新のテクノロジートレンドについて詳しく解説しています。",
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

  test("handles API error gracefully with title fallback", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("Error", { status: 500 });
    }) as typeof fetch;

    const result = await summarizeArticles(sampleArticles, "test-api-key");

    // On API error, non-Japanese articles should fallback to original titles
    expect(result.length).toBe(sampleArticles.length);
    const aiArticle = result.find(a => a.category === "ai");
    const frontendArticle = result.find(a => a.category === "frontend");
    const jpArticle = result.find(a => a.category === "tech-jp");

    expect(aiArticle?.summary).toBe("AI Research Paper"); // Fallback to title
    expect(frontendArticle?.summary).toBe("React New Features"); // Fallback to title
    expect(jpArticle?.summary).toBe(""); // Japanese articles get empty summary
  });

  test("handles malformed JSON response with title fallback", async () => {
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

    // On malformed response, non-Japanese articles should fallback to original titles
    expect(result.length).toBe(sampleArticles.length);
    const aiArticle = result.find(a => a.category === "ai");
    const frontendArticle = result.find(a => a.category === "frontend");
    const jpArticle = result.find(a => a.category === "tech-jp");

    expect(aiArticle?.summary).toBe("AI Research Paper"); // Fallback to title
    expect(frontendArticle?.summary).toBe("React New Features"); // Fallback to title
    expect(jpArticle?.summary).toBe(""); // Japanese articles get empty summary
  });

  test("preserves original article properties", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, summary: "要約テスト" },
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
      content: "This is substantial content for testing that exceeds the minimum character threshold for summarization.",
      published: new Date("2024-01-15"),
    }];

    const result = await summarizeArticles(articles, "test-api-key");

    expect(result[0].title).toBe("Test Title");
    expect(result[0].url).toBe("https://test.com");
    expect(result[0].source).toBe("Test Source");
    expect(result[0].category).toBe("ai");
    expect(result[0].published).toEqual(new Date("2024-01-15"));
    expect(result[0].summary).toBe("要約テスト");
  });

  test("generates Japanese title for articles with insufficient content", async () => {
    // API should be called to translate title to Japanese
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '[{"index": 0, "summary": "短いコンテンツの記事"}]'
          }
        }]
      })
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const titleOnlyArticles: ArticleToSummarize[] = [{
      title: "Short Content Article",
      url: "https://test.com/short",
      source: "Test Source",
      category: "ai",
      content: "Too short", // Less than 50 chars
    }];

    const result = await summarizeArticles(titleOnlyArticles, "test-api-key");

    expect(result[0].summary).toBe("短いコンテンツの記事"); // Japanese translation
    expect(fetchMock).toHaveBeenCalled();
  });

  test("generates Japanese title for HN articles", async () => {
    // API should be called to translate title to Japanese
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '[{"index": 0, "summary": "HN人気記事"}]'
          }
        }]
      })
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const hnArticle: ArticleToSummarize[] = [{
      title: "HN Popular Article",
      url: "https://example.com/hn",
      source: "Hacker News",
      category: "tech",
      content: "HN Score: 500点、150コメント", // High score
    }];

    const result = await summarizeArticles(hnArticle, "test-api-key");

    expect(result[0].summary).toBe("HN人気記事"); // Japanese translation
    expect(fetchMock).toHaveBeenCalled();
  });

  test("generates Japanese title for low-score HN articles", async () => {
    // API should be called to translate title to Japanese
    const fetchMock = mock(async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: '[{"index": 0, "summary": "HN低スコア記事"}]'
          }
        }]
      })
    }));
    globalThis.fetch = fetchMock as typeof fetch;

    const hnArticle: ArticleToSummarize[] = [{
      title: "HN Low Score Article",
      url: "https://example.com/hn-low",
      source: "Hacker News",
      category: "tech",
      content: "HN Score: 50点、10コメント", // Low score
    }];

    const result = await summarizeArticles(hnArticle, "test-api-key");

    expect(result[0].summary).toBe("HN低スコア記事"); // Japanese translation
    expect(fetchMock).toHaveBeenCalled();
  });

  test("replaces low-quality summary with original title", async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify([
              { index: 0, summary: "詳細は記事参照" }, // Low quality summary
            ])
          }
        }]
      }), { status: 200 });
    }) as typeof fetch;

    const articles: ArticleToSummarize[] = [{
      title: "Interesting Tech Article",
      url: "https://test.com",
      source: "Tech Blog",
      category: "tech",
      content: "This is substantial content for testing that exceeds the minimum character threshold for summarization.",
    }];

    const result = await summarizeArticles(articles, "test-api-key");

    expect(result[0].summary).toBe("Interesting Tech Article"); // Fallback to title
  });
});
