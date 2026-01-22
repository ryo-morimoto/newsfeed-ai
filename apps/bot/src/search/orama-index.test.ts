import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import {
  create,
  insert,
  search,
  type Orama,
  type Results,
} from "@orama/orama";
import type { Article } from "../db";

// Simplified test schema without vector embeddings
const TEST_SCHEMA = {
  url: "string" as const,
  title: "string" as const,
  summary: "string" as const,
  detailed_summary: "string" as const,
  category: "string" as const,
  source: "string" as const,
  created_at: "string" as const,
} as const;

type TestOramaDb = Orama<typeof TEST_SCHEMA>;

const mockArticles: Omit<Article, "notified">[] = [
  {
    id: 1,
    url: "https://example.com/typescript-guide",
    title: "TypeScript Complete Guide",
    source: "Tech Blog",
    category: "Programming",
    summary: "A comprehensive guide to TypeScript programming language",
    detailed_summary: "TypeScript is a strongly typed programming language that builds on JavaScript",
    created_at: "2024-01-01T00:00:00Z",
  },
  {
    id: 2,
    url: "https://example.com/react-hooks",
    title: "React Hooks Deep Dive",
    source: "React Blog",
    category: "Frontend",
    summary: "Understanding React hooks and their best practices",
    detailed_summary: "React hooks revolutionized how we write components. useState, useEffect, and custom hooks explained.",
    created_at: "2024-01-02T00:00:00Z",
  },
  {
    id: 3,
    url: "https://example.com/ai-ml",
    title: "AI and Machine Learning Basics",
    source: "AI Weekly",
    category: "AI",
    summary: "Introduction to artificial intelligence and machine learning",
    detailed_summary: "Learn the fundamentals of AI, neural networks, and deep learning techniques.",
    created_at: "2024-01-03T00:00:00Z",
  },
];

describe("Orama Search Index (Fulltext)", () => {
  let db: TestOramaDb;

  beforeEach(async () => {
    // Create a fresh index for each test
    db = await create({
      schema: TEST_SCHEMA,
    }) as TestOramaDb;
  });

  test("create index succeeds", async () => {
    expect(db).toBeDefined();
  });

  test("insert article to index", async () => {
    await insert(db, {
      url: mockArticles[0].url,
      title: mockArticles[0].title,
      summary: mockArticles[0].summary || "",
      detailed_summary: mockArticles[0].detailed_summary || "",
      category: mockArticles[0].category,
      source: mockArticles[0].source,
      created_at: mockArticles[0].created_at || "",
    } as any);

    const results = await search(db, {
      term: "TypeScript",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBe(1);
    expect(results.hits[0].document.title).toBe("TypeScript Complete Guide");
  });

  test("search finds articles by keyword", async () => {
    // Insert all mock articles
    for (const article of mockArticles) {
      await insert(db, {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      } as any);
    }

    const results = await search(db, {
      term: "React",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBeGreaterThanOrEqual(1);
    expect(results.hits[0].document.title).toContain("React");
  });

  test("search finds articles by summary content", async () => {
    for (const article of mockArticles) {
      await insert(db, {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      } as any);
    }

    const results = await search(db, {
      term: "neural networks",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBeGreaterThanOrEqual(1);
    expect(results.hits[0].document.title).toContain("AI");
  });

  test("search returns empty for no match", async () => {
    for (const article of mockArticles) {
      await insert(db, {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      } as any);
    }

    const results = await search(db, {
      term: "xyz123nonexistent",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBe(0);
  });

  test("search respects limit", async () => {
    for (const article of mockArticles) {
      await insert(db, {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      } as any);
    }

    const results = await search(db, {
      term: "programming",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
      limit: 1,
    });

    expect(results.hits.length).toBeLessThanOrEqual(1);
  });

  test("search results include score", async () => {
    await insert(db, {
      url: mockArticles[0].url,
      title: mockArticles[0].title,
      summary: mockArticles[0].summary || "",
      detailed_summary: mockArticles[0].detailed_summary || "",
      category: mockArticles[0].category,
      source: mockArticles[0].source,
      created_at: mockArticles[0].created_at || "",
    } as any);

    const results = await search(db, {
      term: "TypeScript",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBe(1);
    expect(typeof results.hits[0].score).toBe("number");
    expect(results.hits[0].score).toBeGreaterThan(0);
  });

  test("search results include all document fields", async () => {
    await insert(db, {
      url: mockArticles[0].url,
      title: mockArticles[0].title,
      summary: mockArticles[0].summary || "",
      detailed_summary: mockArticles[0].detailed_summary || "",
      category: mockArticles[0].category,
      source: mockArticles[0].source,
      created_at: mockArticles[0].created_at || "",
    } as any);

    const results = await search(db, {
      term: "TypeScript",
      mode: "fulltext",
      properties: ["title", "summary", "detailed_summary"],
    });

    expect(results.hits.length).toBe(1);
    const doc = results.hits[0].document;
    expect(doc.url).toBe(mockArticles[0].url);
    expect(doc.title).toBe(mockArticles[0].title);
    expect(doc.summary).toBe(mockArticles[0].summary!);
    expect(doc.detailed_summary).toBe(mockArticles[0].detailed_summary!);
    expect(doc.category).toBe(mockArticles[0].category);
    expect(doc.source).toBe(mockArticles[0].source);
  });
});
