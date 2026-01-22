// Types
export type {
  Config,
  Source,
  RssSource,
  HackerNewsSource,
  GitHubTrendingSource,
  CategoryConfig,
} from "./types";

// Categories (unified emoji + colors)
export { CATEGORIES, getCategoryEmoji, getCategoryColor, getCategoryConfig } from "./categories";

// Config loader
export {
  loadConfigFromYaml,
  getConfig,
  resetConfig,
  getRssSources,
  getHackerNewsSource,
  getGitHubTrendingSource,
  getInterests,
  getCategoryDisplay,
} from "./loader";
