// Types
export type {
  FileSystem,
  SearchResult,
  SearchConfig,
  SearchOptions,
  OramaDocument,
} from "./types";

// Orama operations
export {
  initSearchIndex,
  getOramaDb,
  addArticleToIndex,
  rebuildIndexFromSQLite,
  persistIndex,
  deletePersistedIndex,
  searchIndex,
  resetSearchIndex,
} from "./orama";

// Search service (higher level)
export {
  initSearchService,
  searchArticles,
  rebuildSearchIndex,
  shutdownSearchService,
} from "./service";
