import { join } from "path";

export interface RssSource {
  name: string;
  type: "rss";
  url: string;
  category: string;
  enabled: boolean;
}

export interface HackerNewsSource {
  name: string;
  type: "hackernews";
  category: string;
  enabled: boolean;
}

export interface GitHubTrendingSource {
  name: string;
  type: "github-trending";
  languages: string[];
  category: string;
  enabled: boolean;
}

export type Source = RssSource | HackerNewsSource | GitHubTrendingSource;

export interface Config {
  sources: Source[];
  interests: string[];
  categories: Record<string, string>;
}

let config: Config | null = null;

import { readFileSync } from "fs";

export function loadConfig(): Config {
  if (config) return config;

  // Go up 3 directories from apps/bot/src to project root
  const configPath = join(import.meta.dir, "..", "..", "..", "config", "sources.yaml");
  const content = readFileSync(configPath, "utf-8");
  config = Bun.YAML.parse(content) as Config;
  return config;
}

export function getRssSources(): RssSource[] {
  return loadConfig().sources.filter(
    (s): s is RssSource => s.type === "rss" && s.enabled
  );
}

export function getHackerNewsSource(): HackerNewsSource | undefined {
  return loadConfig().sources.find(
    (s): s is HackerNewsSource => s.type === "hackernews" && s.enabled
  );
}

export function getGitHubTrendingSource(): GitHubTrendingSource | undefined {
  return loadConfig().sources.find(
    (s): s is GitHubTrendingSource => s.type === "github-trending" && s.enabled
  );
}

export function getInterests(): string[] {
  return loadConfig().interests;
}

export function getCategoryEmoji(category: string): string {
  const categories = loadConfig().categories;
  return categories[category] || `📌 ${category}`;
}
