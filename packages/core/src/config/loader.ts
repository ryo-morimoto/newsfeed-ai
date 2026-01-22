import type { Config, RssSource, HackerNewsSource, GitHubTrendingSource } from "./types";
import { getCategoryEmoji } from "./categories";

let config: Config | null = null;

/**
 * Load configuration from YAML content
 * @param yamlContent - Raw YAML string
 * @param yamlParser - YAML parser function (e.g., Bun.YAML.parse or js-yaml)
 */
export function loadConfigFromYaml(yamlContent: string, yamlParser: (content: string) => unknown): Config {
  if (config) return config;
  config = yamlParser(yamlContent) as Config;
  return config;
}

/**
 * Get cached config (must be loaded first)
 */
export function getConfig(): Config {
  if (!config) {
    throw new Error("Config not loaded. Call loadConfigFromYaml() first.");
  }
  return config;
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  config = null;
}

/**
 * Get enabled RSS sources
 */
export function getRssSources(): RssSource[] {
  return getConfig().sources.filter(
    (s): s is RssSource => s.type === "rss" && s.enabled
  );
}

/**
 * Get enabled Hacker News source
 */
export function getHackerNewsSource(): HackerNewsSource | undefined {
  return getConfig().sources.find(
    (s): s is HackerNewsSource => s.type === "hackernews" && s.enabled
  );
}

/**
 * Get enabled GitHub Trending source
 */
export function getGitHubTrendingSource(): GitHubTrendingSource | undefined {
  return getConfig().sources.find(
    (s): s is GitHubTrendingSource => s.type === "github-trending" && s.enabled
  );
}

/**
 * Get all interests
 */
export function getInterests(): string[] {
  return getConfig().interests;
}

/**
 * Get category display string with emoji (uses unified categories if available, falls back to config)
 */
export function getCategoryDisplay(category: string): string {
  // First try unified categories
  const unified = getCategoryEmoji(category);
  if (!unified.startsWith("📌")) {
    return unified;
  }

  // Fall back to config categories if defined
  const configCategories = getConfig().categories;
  return configCategories[category] || unified;
}
