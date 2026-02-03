import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  initSearchIndex,
  getOramaDb,
  addArticleToIndex,
  rebuildIndexFromSQLite,
  persistIndex,
  deletePersistedIndex,
  searchIndex,
  resetSearchIndex,
} from "./orama";
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
    indexPath: "/tmp/test-index.bin",
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

describe("orama search module", () => {
  beforeEach(() => {
    // Reset the module state before each test
    resetSearchIndex();
  });

  describe("initSearchIndex", () => {
    test("creates new index when no persisted file exists", async () => {
      const mockFs = createMockFs({ exists: false });
      const config = createMockConfig(mockFs);

      await initSearchIndex(config);

      expect(mockFs.exists).toHaveBeenCalledWith(config.indexPath);
      // Should be able to get the db after initialization
      const db = await getOramaDb();
      expect(db).toBeDefined();
    });

    test("reuses existing initialization promise for same config", async () => {
      const mockFs = createMockFs({ exists: false });
      const config = createMockConfig(mockFs);

      // Call twice with same config
      await initSearchIndex(config);
      await initSearchIndex(config);

      // fs.exists should only be called once
      expect(mockFs.exists).toHaveBeenCalledTimes(1);
    });

    test("creates fresh index on restore error", async () => {
      const mockFs = createMockFs({
        exists: true,
        readError: new Error("Read error"),
      });
      const config = createMockConfig(mockFs);

      // Should not throw, but create fresh index
      await initSearchIndex(config);

      const db = await getOramaDb();
      expect(db).toBeDefined();
    });
  });

  describe("getOramaDb", () => {
    test("throws when not initialized", async () => {
      expect(getOramaDb()).rejects.toThrow("Search index not initialized");
    });

    test("returns db when initialized", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const db = await getOramaDb();
      expect(db).toBeDefined();
    });
  });

  describe("addArticleToIndex", () => {
    test("adds article to index successfully", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const article = createMockArticle();
      // Should not throw
      await addArticleToIndex(article);
    });

    test("handles article without optional fields", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const article = createMockArticle({
        summary: undefined,
        detailed_summary: undefined,
        created_at: undefined,
      });
      await addArticleToIndex(article);
    });
  });

  describe("rebuildIndexFromSQLite", () => {
    test("rebuilds index from article list", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const articles = [
        createMockArticle({ url: "https://example.com/1", title: "Article 1" }),
        createMockArticle({ url: "https://example.com/2", title: "Article 2" }),
      ];

      const getAllArticles = mock(async () => articles);

      await rebuildIndexFromSQLite(getAllArticles);

      expect(getAllArticles).toHaveBeenCalled();
    });

    test("handles empty article list", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const getAllArticles = mock(async () => []);
      await rebuildIndexFromSQLite(getAllArticles);

      expect(getAllArticles).toHaveBeenCalled();
    });
  });

  describe("persistIndex", () => {
    test("persists index to file", async () => {
      const mockFs = createMockFs({ exists: false });
      const config = createMockConfig(mockFs);

      await initSearchIndex(config);
      await persistIndex(config);

      expect(mockFs.write).toHaveBeenCalled();
    });

    test("does nothing when no index exists", async () => {
      const mockFs = createMockFs({});
      const config = createMockConfig(mockFs);

      // Don't initialize - no index
      await persistIndex(config);

      expect(mockFs.write).not.toHaveBeenCalled();
    });

    test("handles write errors gracefully", async () => {
      const mockFs = createMockFs({
        exists: false,
        writeError: new Error("Write failed"),
      });
      const config = createMockConfig(mockFs);

      await initSearchIndex(config);
      // Should not throw
      await persistIndex(config);
    });
  });

  describe("deletePersistedIndex", () => {
    test("deletes index file when exists", async () => {
      const mockFs = createMockFs({ exists: true });
      const config = createMockConfig(mockFs);

      await deletePersistedIndex(config);

      expect(mockFs.exists).toHaveBeenCalledWith(config.indexPath);
      expect(mockFs.delete).toHaveBeenCalledWith(config.indexPath);
    });

    test("does nothing when file does not exist", async () => {
      const mockFs = createMockFs({ exists: false });
      const config = createMockConfig(mockFs);

      await deletePersistedIndex(config);

      expect(mockFs.exists).toHaveBeenCalledWith(config.indexPath);
      expect(mockFs.delete).not.toHaveBeenCalled();
    });

    test("handles missing delete function", async () => {
      const mockFs = createMockFs({ exists: true });
      delete mockFs.delete;
      const config = createMockConfig(mockFs);

      // Should not throw
      await deletePersistedIndex(config);
    });
  });

  describe("searchIndex", () => {
    test("returns empty array for empty index", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      const results = await searchIndex("test query");

      expect(Array.isArray(results)).toBe(true);
    });

    test("finds articles by title", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      // Add some articles
      await addArticleToIndex(
        createMockArticle({
          url: "https://example.com/react",
          title: "React Tutorial",
          summary: "Learn React from scratch",
        })
      );
      await addArticleToIndex(
        createMockArticle({
          url: "https://example.com/vue",
          title: "Vue Guide",
          summary: "Complete Vue.js guide",
        })
      );

      const results = await searchIndex("React", 10);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].article.title).toContain("React");
    });

    test("respects limit parameter", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      // Add multiple articles
      for (let i = 0; i < 10; i++) {
        await addArticleToIndex(
          createMockArticle({
            url: `https://example.com/article-${i}`,
            title: `Test Article ${i}`,
          })
        );
      }

      const results = await searchIndex("Test", 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe("resetSearchIndex", () => {
    test("resets all state", async () => {
      const config = createMockConfig();
      await initSearchIndex(config);

      // Verify it's initialized
      const db = await getOramaDb();
      expect(db).toBeDefined();

      // Reset
      resetSearchIndex();

      // Should throw now
      expect(getOramaDb()).rejects.toThrow("Search index not initialized");
    });
  });
});
