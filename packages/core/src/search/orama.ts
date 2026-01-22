import { create, insert, search, type Orama, type Results } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import type { Article, SearchResult, SearchConfig, OramaDocument } from "./types";

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
let currentConfig: SearchConfig | null = null;

/**
 * Create a new Orama database instance
 */
async function createOramaDb(embeddingsPlugin?: unknown): Promise<OramaDb> {
  const plugins = embeddingsPlugin ? [embeddingsPlugin] : [];
  return create({
    schema: ORAMA_SCHEMA,
    plugins: plugins as any,
  }) as unknown as OramaDb;
}

/**
 * Initialize the search index
 * - If persisted index exists, restore it
 * - Otherwise, create empty index (caller should rebuild from SQLite)
 */
export async function initSearchIndex(config: SearchConfig): Promise<void> {
  if (initPromise && currentConfig === config) {
    return initPromise;
  }

  currentConfig = config;

  initPromise = (async () => {
    try {
      // Try to restore from persisted file
      if (await config.fs.exists(config.indexPath)) {
        console.log("[search] Restoring index from file...");
        const data = await config.fs.read(config.indexPath);
        oramaDb = (await restore("binary", Buffer.from(data))) as OramaDb;
        console.log("[search] Index restored successfully");
        return;
      }

      // Create new empty index
      console.log("[search] Creating new search index...");
      oramaDb = await createOramaDb(config.embeddingsPlugin);
      console.log("[search] Search index initialized");
    } catch (error) {
      console.error("[search] Failed to initialize index:", error);
      // Create fresh index on error
      oramaDb = await createOramaDb(config.embeddingsPlugin);
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
    throw new Error("Search index not initialized. Call initSearchIndex() first.");
  }
  return oramaDb;
}

/**
 * Add an article to the search index
 */
export async function addArticleToIndex(article: Article): Promise<void> {
  const db = await getOramaDb();

  const doc: OramaDocument = {
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
 * Rebuild the entire search index from articles
 */
export async function rebuildIndexFromSQLite(
  getAllArticles: () => Promise<Article[]>,
  embeddingsPlugin?: unknown
): Promise<void> {
  console.log("[search] Rebuilding index from SQLite...");

  // Create a fresh index
  oramaDb = await createOramaDb(embeddingsPlugin);

  const articles = await getAllArticles();

  const added = await articles.reduce<Promise<number>>(async (countPromise, article) => {
    const count = await countPromise;
    try {
      await addArticleToIndex(article);
      return count + 1;
    } catch (error) {
      console.error(`[search] Failed to index article: ${article.url}`, error);
      return count;
    }
  }, Promise.resolve(0));

  console.log(`[search] Rebuilt index with ${added} articles`);
}

/**
 * Persist the search index to disk
 */
export async function persistIndex(config: SearchConfig): Promise<void> {
  if (!oramaDb) {
    console.warn("[search] No index to persist");
    return;
  }

  try {
    const data = await persist(oramaDb, "binary");
    await config.fs.write(config.indexPath, data as ArrayBuffer);
    console.log(`[search] Index persisted to ${config.indexPath}`);
  } catch (error) {
    console.error("[search] Failed to persist index:", error);
  }
}

/**
 * Delete the persisted index file (for rebuilding)
 */
export async function deletePersistedIndex(config: SearchConfig): Promise<void> {
  try {
    if (config.fs.delete && (await config.fs.exists(config.indexPath))) {
      await config.fs.delete(config.indexPath);
      console.log("[search] Deleted persisted index");
    }
  } catch (error) {
    console.error("[search] Failed to delete index file:", error);
  }
}

/**
 * Search the index using hybrid search (FTS + Vector) with fulltext fallback
 */
export async function searchIndex(query: string, limit: number = 20): Promise<SearchResult[]> {
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
  currentConfig = null;
}

/** Database interface compatible with @libsql/client */
type DbClient = {
  execute: (stmt: {
    sql: string;
    args?: (string | number | Uint8Array | null)[];
  }) => Promise<{ rows: Record<string, unknown>[] }>;
};

/**
 * Persist the search index to database (Turso)
 */
export async function persistIndexToDb(db: DbClient, indexId: string = "default"): Promise<void> {
  if (!oramaDb) {
    console.warn("[search] No index to persist to db");
    return;
  }

  try {
    const data = await persist(oramaDb, "binary");
    await db.execute({
      sql: `INSERT OR REPLACE INTO search_index (id, data, updated_at)
            VALUES (?, ?, datetime('now'))`,
      args: [indexId, new Uint8Array(data as ArrayBuffer)],
    });
    console.log(`[search] Index persisted to database with id: ${indexId}`);
  } catch (error) {
    console.error("[search] Failed to persist index to db:", error);
  }
}

/**
 * Restore the search index from database (Turso)
 */
export async function restoreIndexFromDb(
  db: DbClient,
  indexId: string = "default"
): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: "SELECT data FROM search_index WHERE id = ?",
      args: [indexId],
    });

    const row = result.rows[0];
    if (!row) {
      console.log("[search] No index found in database");
      return false;
    }

    const data = row.data;
    // Convert to ArrayBuffer - handle both ArrayBuffer and Uint8Array from Turso
    const buffer =
      data instanceof ArrayBuffer
        ? data
        : (new Uint8Array(data as Uint8Array).buffer.slice(0) as ArrayBuffer);
    oramaDb = (await restore("binary", buffer)) as OramaDb;
    console.log("[search] Index restored from database");
    return true;
  } catch (error) {
    console.error("[search] Failed to restore index from db:", error);
    return false;
  }
}
