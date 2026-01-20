// Namespace exports for clean imports
export * as db from "./db";
export * as search from "./search";
export * as config from "./config";

// Path utilities (project root auto-detection)
export { paths, getProjectRoot, getDataDir, getConfigDir, resetProjectRoot } from "./paths";

// Also re-export commonly used types at top level for convenience
export type { Article, PendingTaskNotification, DbConfig } from "./db";
export type { SearchResult, SearchConfig, SearchOptions, FileSystem } from "./search";
export type {
  Config,
  Source,
  RssSource,
  HackerNewsSource,
  GitHubTrendingSource,
  CategoryConfig,
} from "./config";
