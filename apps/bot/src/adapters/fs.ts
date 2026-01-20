import type { FileSystem } from "@newsfeed-ai/core";
import { unlink } from "node:fs/promises";

/**
 * Bun-specific file system implementation using Bun.file()
 */
export const bunFileSystem: FileSystem = {
  async exists(path: string): Promise<boolean> {
    return await Bun.file(path).exists();
  },

  async read(path: string): Promise<ArrayBuffer> {
    return await Bun.file(path).arrayBuffer();
  },

  async write(path: string, data: ArrayBuffer | string): Promise<void> {
    await Bun.write(path, data);
  },

  async delete(path: string): Promise<void> {
    await unlink(path);
  },
};
