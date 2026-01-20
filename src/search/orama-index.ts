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
import { join } from "path";
import type { Article } from "../db";

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

interface OramaDocumentInput {
  url: string;
  title: string;
  summary: string;
  detailed_summary: string;
  category: string;
  source: string;
  created_at: string;
}

const INDEX_FILE_PATH = join(import.meta.dir, "..", "..", "data", "orama-index.msp");

let oramaDb: OramaDb | null = null;
let initPromise: Promise<void> | null = null;
let embeddingsPlugin: Awaited<ReturnType<typeof pluginEmbeddings>> | null = null;

/**
 * Create the embeddings plugin with TensorFlow.js
 */
async function createEmbeddingsPlugin() {
  if (embeddingsPlugin) return embeddingsPlugin;

  // Import TensorFlow.js dynamically to avoid issues on startup
  try {
    await import("@tensorflow/tfjs-node");
  } catch {
    console.warn("[search] TensorFlow.js node bindings not available, using default");
  }

  embeddingsPlugin = await pluginEmbeddings({
    embeddings: {
      // Concatenate searchable fields for embedding
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

/**
 * Create a new Orama database instance
 */
async function createOramaDb(): Promise<OramaDb> {
  const plugin = await createEmbeddingsPlugin();

  return create({
    schema: ORAMA_SCHEMA,
    plugins: [plugin],
  }) as unknown as OramaDb;
}

/**
 * Initialize the search index
 * - If persisted index exists, restore it
 * - Otherwise, create empty index (caller should rebuild from SQLite)
 */
export async function initSearchIndex(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      // Try to restore from persisted file
      const indexFile = Bun.file(INDEX_FILE_PATH);
      if (await indexFile.exists()) {
        console.log("[search] Restoring index from file...");
        const data = await indexFile.arrayBuffer();
        // Note: restored DB may not have full embeddings capability
        // but basic search should work
        oramaDb = await restore("binary", Buffer.from(data)) as OramaDb;
        console.log("[search] Index restored successfully");
        return;
      }

      // Create new empty index
      console.log("[search] Creating new search index...");
      oramaDb = await createOramaDb();
      console.log("[search] Search index initialized");
    } catch (error) {
      console.error("[search] Failed to initialize index:", error);
      // Create fresh index on error
      oramaDb = await createOramaDb();
      console.log("[search] Created fresh index after error");
    }
  })();

  return initPromise;
}

/**
 * Get the Orama database instance
 */
export async function getOramaDb(): Promise<OramaDb> {
  if (!oramaDb) {
    await initSearchIndex();
  }
  if (!oramaDb) {
    throw new Error("Search index not initialized");
  }
  return oramaDb;
}

/**
 * Add an article to the search index
 */
export async function addArticleToIndex(article: Article): Promise<void> {
  const db = await getOramaDb();

  const doc: OramaDocumentInput = {
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
    console.log(`[search] Added article to index: ${article.url}`);
  } catch (error) {
    // Ignore duplicate errors
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("already exists")) {
      console.error(`[search] Failed to add article: ${article.url}`, error);
    }
  }
}

/**
 * Rebuild the entire search index from SQLite articles
 */
export async function rebuildIndexFromSQLite(
  getAllArticles: () => Promise<Article[]>
): Promise<void> {
  console.log("[search] Rebuilding index from SQLite...");

  // Create a fresh index
  oramaDb = await createOramaDb();

  const articles = await getAllArticles();
  let added = 0;

  for (const article of articles) {
    try {
      await addArticleToIndex(article);
      added++;
    } catch (error) {
      console.error(`[search] Failed to index article: ${article.url}`, error);
    }
  }

  console.log(`[search] Rebuilt index with ${added} articles`);
}

/**
 * Persist the search index to disk
 */
export async function persistIndex(): Promise<void> {
  if (!oramaDb) {
    console.warn("[search] No index to persist");
    return;
  }

  try {
    const data = await persist(oramaDb, "binary");
    await Bun.write(INDEX_FILE_PATH, data);
    console.log(`[search] Index persisted to ${INDEX_FILE_PATH}`);
  } catch (error) {
    console.error("[search] Failed to persist index:", error);
  }
}

/**
 * Delete the persisted index file (for rebuilding)
 */
export async function deletePersistedIndex(): Promise<void> {
  try {
    const indexFile = Bun.file(INDEX_FILE_PATH);
    if (await indexFile.exists()) {
      const { unlink } = await import("node:fs/promises");
      await unlink(INDEX_FILE_PATH);
      console.log("[search] Deleted persisted index");
    }
  } catch (error) {
    console.error("[search] Failed to delete index file:", error);
  }
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
 * Search the index using hybrid search (FTS + Vector) with fulltext fallback
 */
export async function searchIndex(
  query: string,
  limit: number = 20
): Promise<SearchResult[]> {
  const db = await getOramaDb();

  // Helper function to convert results to SearchResult array
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
    // Try hybrid search first (FTS + Vector)
    const results: Results<any> = await search(db, {
      term: query,
      mode: "hybrid",
      limit,
      properties: ["title", "summary", "detailed_summary"],
    });
    return convertResults(results);
  } catch (hybridError) {
    // Fall back to fulltext search if hybrid fails
    // This can happen when embeddings aren't properly configured
    console.warn("[search] Hybrid search failed, falling back to fulltext:", hybridError);

    try {
      const results: Results<any> = await search(db, {
        term: query,
        mode: "fulltext",
        limit,
        properties: ["title", "summary", "detailed_summary"],
      });
      return convertResults(results);
    } catch (fulltextError) {
      console.error("[search] Fulltext search also failed:", fulltextError);
      return [];
    }
  }
}

/**
 * Reset the search index (for testing)
 */
export function resetSearchIndex(): void {
  oramaDb = null;
  initPromise = null;
  embeddingsPlugin = null;
}
