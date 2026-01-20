import { pluginEmbeddings } from "@orama/plugin-embeddings";

let embeddingsPlugin: Awaited<ReturnType<typeof pluginEmbeddings>> | null = null;

/**
 * Create the embeddings plugin with TensorFlow.js
 * Lazy initialization to avoid import issues
 */
export async function createEmbeddingsPlugin() {
  if (embeddingsPlugin) return embeddingsPlugin;

  // Import TensorFlow.js dynamically to avoid issues on startup
  try {
    await import("@tensorflow/tfjs-node");
  } catch {
    console.warn("[embeddings] TensorFlow.js node bindings not available, using default");
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
 * Reset embeddings plugin (for testing)
 */
export function resetEmbeddingsPlugin(): void {
  embeddingsPlugin = null;
}
