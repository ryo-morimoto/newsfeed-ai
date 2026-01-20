import {
  create,
  insert,
  search,
  type Orama,
  type Results,
} from "@orama/orama";
import { pluginEmbeddings } from "@orama/plugin-embeddings";
import {
  persist,
  restore,
} from "@orama/plugin-data-persistence";
import { paths } from "@newsfeed-ai/core";
import type { Article } from "./db";

// Schema definition for Orama
const ORAMA_SCHEMA = {
  url: "string" as const,
  title: "string" as const,
  summary: "string" as const,
  detailed_summary: "string" as const,
  category: "string" as const,
  source: "string" as const,
  created_at: "string" as const,
  embeddings: "vector[512]" as const,
} as const;

type OramaDb = Orama<typeof ORAMA_SCHEMA>;

let oramaDb: OramaDb | null = null;
let initPromise: Promise<void> | null = null;
let embeddingsPlugin: Awaited<ReturnType<typeof pluginEmbeddings>> | null = null;

async function createEmbeddingsPlugin() {
  if (embeddingsPlugin) return embeddingsPlugin;

  // Import TensorFlow.js dynamically
  try {
    await import("@tensorflow/tfjs-node");
  } catch {
    console.warn("[web-search] TensorFlow.js node bindings not available");
  }

  embeddingsPlugin = await pluginEmbeddings({
    embeddings: {
      defaultProperty: "embeddings",
      onInsert: {
        generate: true,
        properties: ["title", "summary", "detailed_summary"],
        verbose: false,
      },
    },
  });

  return embeddingsPlugin;
}

async function createOramaDb(): Promise<OramaDb> {
  const plugin = await createEmbeddingsPlugin();
  return create({
    schema: ORAMA_SCHEMA,
    plugins: [plugin],
  }) as unknown as OramaDb;
}

async function initSearchIndex(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check for BunFile or Node.js fs
      const fs = await import("node:fs");
      if (fs.existsSync(paths.searchIndex)) {
        console.log("[web-search] Restoring index from file...");
        const data = fs.readFileSync(paths.searchIndex);
        oramaDb = await restore("binary", Buffer.from(data)) as OramaDb;
        console.log("[web-search] Index restored successfully");
        return;
      }

      console.log("[web-search] No index file found, creating empty index...");
      oramaDb = await createOramaDb();
    } catch (error) {
      console.error("[web-search] Failed to initialize index:", error);
      oramaDb = await createOramaDb();
    }
  })();

  return initPromise;
}

async function getOramaDb(): Promise<OramaDb> {
  if (!oramaDb) {
    await initSearchIndex();
  }
  if (!oramaDb) {
    throw new Error("Search index not initialized");
  }
  return oramaDb;
}

export interface SearchResult {
  article: {
    url: string;
    title: string;
    summary: string;
    detailed_summary: string;
    category: string;
    source: string;
    created_at: string;
  };
  score: number;
}

/**
 * Search articles using Orama hybrid search (FTS + Vector) with fulltext fallback
 */
export async function searchArticles(
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const convertResults = (results: Results<any>): SearchResult[] => {
    return results.hits.map((hit) => ({
      article: {
        url: hit.document.url,
        title: hit.document.title,
        summary: hit.document.summary,
        detailed_summary: hit.document.detailed_summary,
        category: hit.document.category,
        source: hit.document.source,
        created_at: hit.document.created_at,
      },
      score: hit.score,
    }));
  };

  try {
    const db = await getOramaDb();

    // Try hybrid search first
    const results: Results<any> = await search(db, {
      term: query,
      mode: "hybrid",
      limit,
      properties: ["title", "summary", "detailed_summary"],
    });
    return convertResults(results);
  } catch (hybridError) {
    // Fall back to fulltext search
    console.warn("[web-search] Hybrid search failed, falling back to fulltext:", hybridError);

    try {
      const db = await getOramaDb();
      const results: Results<any> = await search(db, {
        term: query,
        mode: "fulltext",
        limit,
        properties: ["title", "summary", "detailed_summary"],
      });
      return convertResults(results);
    } catch (fulltextError) {
      console.error("[web-search] Fulltext search also failed:", fulltextError);
      return [];
    }
  }
}

/**
 * Fallback search using SQLite LIKE when Orama fails
 */
export async function fallbackSearch(
  query: string,
  limit: number,
  getAllArticles: () => Promise<Article[]>
): Promise<SearchResult[]> {
  console.log("[web-search] Using fallback SQLite search");

  try {
    const articles = await getAllArticles();
    const lowerQuery = query.toLowerCase();

    const matches = articles
      .filter((article) => {
        const searchText = [
          article.title,
          article.summary,
          article.detailed_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchText.includes(lowerQuery);
      })
      .slice(0, limit);

    return matches.map((article, index) => ({
      article: {
        url: article.url,
        title: article.title,
        summary: article.summary || "",
        detailed_summary: article.detailed_summary || "",
        category: article.category,
        source: article.source,
        created_at: article.created_at || "",
      },
      score: 1 - index * 0.01,
    }));
  } catch (error) {
    console.error("[web-search] Fallback search failed:", error);
    return [];
  }
}

/**
 * Add article to search index
 */
export async function addArticleToIndex(article: Article): Promise<void> {
  const db = await getOramaDb();

  const doc = {
    url: article.url,
    title: article.title,
    summary: article.summary || "",
    detailed_summary: article.detailed_summary || "",
    category: article.category,
    source: article.source,
    created_at: article.created_at || new Date().toISOString(),
  };

  try {
    await insert(db, doc as any);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) {
      console.error(`[web-search] Failed to add article: ${article.url}`, error);
    }
  }
}

/**
 * Rebuild index from articles
 */
export async function rebuildIndex(articles: Article[]): Promise<void> {
  console.log("[web-search] Rebuilding index...");
  oramaDb = await createOramaDb();

  for (const article of articles) {
    try {
      await addArticleToIndex(article);
    } catch (error) {
      console.error(`[web-search] Failed to index: ${article.url}`, error);
    }
  }

  console.log(`[web-search] Rebuilt index with ${articles.length} articles`);
}

/**
 * Persist index to file
 */
export async function persistIndex(): Promise<void> {
  if (!oramaDb) return;

  try {
    const data = await persist(oramaDb, "binary");
    const fs = await import("node:fs");
    // data is ArrayBuffer | string, convert to Buffer for fs.writeFileSync
    const buffer = typeof data === "string"
      ? Buffer.from(data)
      : Buffer.from(new Uint8Array(data as ArrayBuffer));
    fs.writeFileSync(paths.searchIndex, buffer);
    console.log(`[web-search] Index persisted to ${paths.searchIndex}`);
  } catch (error) {
    console.error("[web-search] Failed to persist index:", error);
  }
}
