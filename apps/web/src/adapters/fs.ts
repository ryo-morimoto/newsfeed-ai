/**
 * Node.js FileSystem adapter for web app
 * Implements @newsfeed-ai/core FileSystem interface using node:fs
 */
import * as fs from "node:fs";
import type { FileSystem } from "@newsfeed-ai/core";

export const nodeFileSystem: FileSystem = {
  async exists(path: string): Promise<boolean> {
    return fs.existsSync(path);
  },

  async read(path: string): Promise<ArrayBuffer> {
    const buffer = fs.readFileSync(path);
    return buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    );
  },

  async write(path: string, data: ArrayBuffer | string): Promise<void> {
    const buffer =
      typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    fs.writeFileSync(path, buffer);
  },

  async delete(path: string): Promise<void> {
    fs.unlinkSync(path);
  },
};
