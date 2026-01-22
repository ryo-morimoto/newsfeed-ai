/**
 * Search index initialization for bot app
 * Provides Bun-specific initialization with TensorFlow.js embeddings
 */
import { search, paths, db } from "@newsfeed-ai/core";
import { bunFileSystem } from "../adapters/fs";

// Embeddings plugin (created lazily)
let embeddingsPlugin: unknown = null;

/**
 * Create the embeddings plugin with TensorFlow.js
 */
async function createEmbeddingsPlugin(): Promise<unknown> {
  if (embeddingsPlugin) return embeddingsPlugin;

  // Import TensorFlow.js dynamically to avoid issues on startup
  try {
    await import("@tensorflow/tfjs-node");
  } catch {
    console.warn("[search] TensorFlow.js node bindings not available, using default");
  }

  const { pluginEmbeddings } = await import("@orama/plugin-embeddings");
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

/**
 * Get search config for bot (Bun FileSystem + embeddings)
 */
export function getSearchConfig(): search.SearchConfig {
  return {
    indexPath: paths.searchIndex,
    fs: bunFileSystem,
  };
}

/**
 * Initialize the search index with bot-specific config
 */
export async function initSearchIndex(): Promise<void> {
  const plugin = await createEmbeddingsPlugin();
  await search.initSearchIndex({
    ...getSearchConfig(),
    embeddingsPlugin: plugin,
  });
}

/**
 * Rebuild index with embeddings plugin
 */
export async function rebuildIndexFromSQLite(
  getAllArticles: () => Promise<search.Article[]>
): Promise<void> {
  const plugin = await createEmbeddingsPlugin();
  await search.rebuildIndexFromSQLite(getAllArticles, plugin);
}

/**
 * Persist the search index to file and Turso database
 * File persistence is for local development, Turso is for Workers
 */
export async function persistSearchIndex(): Promise<void> {
  // Persist to file (existing behavior)
  await search.persistIndex(getSearchConfig());

  // Also persist to Turso for Workers
  try {
    const client = await db.getDb();
    await search.persistIndexToDb(client);
  } catch (error) {
    console.warn("[search] Could not persist to Turso (might be using local SQLite):", error);
  }
}

/**
 * Reset the search index (for testing)
 */
export function resetSearchIndex(): void {
  search.resetSearchIndex();
}
