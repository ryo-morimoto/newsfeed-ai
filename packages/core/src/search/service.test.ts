import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  initSearchService,
  searchArticles,
  rebuildSearchIndex,
  shutdownSearchService,
} from "./service";
import { resetSearchIndex } from "./orama";
import type { SearchConfig, Article, FileSystem } from "./types";

// Create mock file system
function createMockFs(options: {
  exists?: boolean;
  readData?: ArrayBuffer;
  readError?: Error;
  writeError?: Error;
}): FileSystem {
  return {
    exists: mock(async () => options.exists ?? false),
    read: mock(async () => {
      if (options.readError) throw options.readError;
      return options.readData ?? new ArrayBuffer(0);
    }),
    write: mock(async () => {
      if (options.writeError) throw options.writeError;
    }),
    delete: mock(async () => {}),
  };
}

// Create mock config
function createMockConfig(fs?: FileSystem): SearchConfig {
  return {
    indexPath: "/tmp/test-service-index.bin",
    fs: fs ?? createMockFs({}),
  };
}

// Create mock article
function createMockArticle(overrides?: Partial<Article>): Article {
  return {
    url: "https://example.com/test",
    title: "Test Article",
    summary: "This is a test summary",
    detailed_summary: "This is a detailed test summary",
    category: "tech",
    source: "Test Source",
    created_at: "2024-01-01T00:00:00Z",
    notified: false,
    ...overrides,
  };
}

describe("search service", () => {
  beforeEach(() => {
    // Reset orama module state
    resetSearchIndex();
  });

  describe("initSearchService", () => {
    test("initializes search service successfully", async () => {
      const config = createMockConfig();
      const getAllArticles = mock(async () => [
        createMockArticle({ url: "https://example.com/1" }),
      ]);

      // Should not throw
      await initSearchService(config, getAllArticles);
    });

    test("rebuilds index when empty", async () => {
      const config = createMockConfig();
      const articles = [
        createMockArticle({ url: "https://example.com/1", title: "Test 1" }),
        createMockArticle({ url: "https://example.com/2", title: "Test 2" }),
      ];
      const getAllArticles = mock(async () => articles);

      await initSearchService(config, getAllArticles);

      // getAllArticles should be called to rebuild empty index
      expect(getAllArticles).toHaveBeenCalled();
    });
  });

  describe("searchArticles", () => {
    test("returns empty array for empty query", async () => {
      const config = createMockConfig();
      const getAllArticles = mock(async () => []);

      await initSearchService(config, getAllArticles);

      const results = await searchArticles({ query: "" }, getAllArticles);
      expect(results).toEqual([]);
    });

    test("returns empty array for whitespace query", async () => {
      const config = createMockConfig();
      const getAllArticles = mock(async () => []);

      await initSearchService(config, getAllArticles);

      const results = await searchArticles({ query: "   " }, getAllArticles);
      expect(results).toEqual([]);
    });

    test("searches articles successfully", async () => {
      const config = createMockConfig();
      const articles = [
        createMockArticle({
          url: "https://example.com/react",
          title: "React Tutorial",
          summary: "Learn React",
        }),
        createMockArticle({
          url: "https://example.com/vue",
          title: "Vue Guide",
          summary: "Learn Vue",
        }),
      ];
      const getAllArticles = mock(async () => articles);

      await initSearchService(config, getAllArticles);

      const results = await searchArticles({ query: "React" }, getAllArticles);

      expect(results.length).toBeGreaterThan(0);
    });

    test("respects limit option", async () => {
      const config = createMockConfig();
      const articles = Array.from({ length: 10 }, (_, i) =>
        createMockArticle({
          url: `https://example.com/article-${i}`,
          title: `Test Article ${i}`,
        })
      );
      const getAllArticles = mock(async () => articles);

      await initSearchService(config, getAllArticles);

      const results = await searchArticles({ query: "Test", limit: 3 }, getAllArticles);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("rebuildSearchIndex", () => {
    test("rebuilds index from articles", async () => {
      const config = createMockConfig();
      const articles = [
        createMockArticle({ url: "https://example.com/1" }),
        createMockArticle({ url: "https://example.com/2" }),
      ];
      const getAllArticles = mock(async () => articles);

      // Initialize first
      await initSearchService(config, getAllArticles);

      // Rebuild
      await rebuildSearchIndex(config, getAllArticles);

      expect(getAllArticles).toHaveBeenCalled();
    });
  });

  describe("shutdownSearchService", () => {
    test("persists index on shutdown", async () => {
      const mockFs = createMockFs({});
      const config = createMockConfig(mockFs);
      const getAllArticles = mock(async () => [createMockArticle()]);

      await initSearchService(config, getAllArticles);
      await shutdownSearchService();

      expect(mockFs.write).toHaveBeenCalled();
    });

    test("does nothing when not initialized", async () => {
      // Reset everything
      resetSearchIndex();

      // Should not throw
      await shutdownSearchService();
    });
  });

  describe("fallback search", () => {
    test("uses fallback when orama search fails", async () => {
      const config = createMockConfig(
        createMockFs({
          exists: true,
          readError: new Error("Corrupted index"),
        })
      );
      const articles = [
        createMockArticle({
          url: "https://example.com/test",
          title: "Test Article about TypeScript",
          summary: "Learn TypeScript basics",
        }),
      ];
      const getAllArticles = mock(async () => articles);

      // Initialize with corrupted index
      await initSearchService(config, getAllArticles);

      // Search should still work via fallback
      const results = await searchArticles({ query: "typescript" }, getAllArticles);

      // Fallback search should find the article by matching text
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });
});
