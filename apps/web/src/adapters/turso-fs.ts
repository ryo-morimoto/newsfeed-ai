/**
 * Turso FileSystem adapter for Cloudflare Workers
 * Implements @newsfeed-ai/core FileSystem interface using Turso for storage
 * Used by Workers where node:fs is not available
 */
import type { FileSystem } from "@newsfeed-ai/core/search";
import { getClient } from "../lib/db";

export const tursoFileSystem: FileSystem = {
  async exists(path: string): Promise<boolean> {
    try {
      const db = await getClient();
      const result = await db.execute({
        sql: "SELECT 1 FROM search_index WHERE id = ?",
        args: [path],
      });
      return result.rows.length > 0;
    } catch {
      return false;
    }
  },

  async read(path: string): Promise<ArrayBuffer> {
    const db = await getClient();
    const result = await db.execute({
      sql: "SELECT data FROM search_index WHERE id = ?",
      args: [path],
    });
    if (result.rows.length === 0) {
      throw new Error(`Index not found: ${path}`);
    }
    const data = result.rows[0].data as ArrayBuffer | Uint8Array;
    if (data instanceof ArrayBuffer) {
      return data;
    }
    // Handle Uint8Array - copy to new ArrayBuffer to avoid SharedArrayBuffer issues
    return new Uint8Array(data).buffer.slice(0) as ArrayBuffer;
  },

  async write(path: string, data: ArrayBuffer): Promise<void> {
    const db = await getClient();
    await db.execute({
      sql: `INSERT OR REPLACE INTO search_index (id, data, updated_at)
            VALUES (?, ?, datetime('now'))`,
      args: [path, new Uint8Array(data)],
    });
  },

  async delete(path: string): Promise<void> {
    const db = await getClient();
    await db.execute({
      sql: "DELETE FROM search_index WHERE id = ?",
      args: [path],
    });
  },
};
