import type { Article } from "../db/types";

/**
 * Abstract file system interface for platform-agnostic file operations
 * Implement this for Bun (Bun.file) or Node.js (fs)
 */
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<ArrayBuffer>;
  write(path: string, data: ArrayBuffer | string): Promise<void>;
  delete?(path: string): Promise<void>;
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

export interface SearchConfig {
  /** Path to persisted Orama index file */
  indexPath: string;
  /** File system implementation (Bun.file or node:fs wrapper) */
  fs: FileSystem;
  /** Optional embeddings plugin instance */
  embeddingsPlugin?: unknown;
}

export interface SearchOptions {
  query: string;
  limit?: number;
}

/**
 * Orama document schema
 */
export interface OramaDocument {
  url: string;
  title: string;
  summary: string;
  detailed_summary: string;
  category: string;
  source: string;
  created_at: string;
}

export type { Article };
