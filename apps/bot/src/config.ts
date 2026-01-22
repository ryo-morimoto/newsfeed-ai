import { paths } from "@newsfeed-ai/core";

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

export async function loadConfig(): Promise<Config> {
  if (config) return config;

  const content = await Bun.file(paths.sourcesConfig).text();
  config = Bun.YAML.parse(content) as Config;
  return config;
}

export async function getRssSources(): Promise<RssSource[]> {
  const cfg = await loadConfig();
  return cfg.sources.filter(
    (s): s is RssSource => s.type === "rss" && s.enabled
  );
}

export async function getHackerNewsSource(): Promise<HackerNewsSource | undefined> {
  const cfg = await loadConfig();
  return cfg.sources.find(
    (s): s is HackerNewsSource => s.type === "hackernews" && s.enabled
  );
}

export async function getGitHubTrendingSource(): Promise<GitHubTrendingSource | undefined> {
  const cfg = await loadConfig();
  return cfg.sources.find(
    (s): s is GitHubTrendingSource => s.type === "github-trending" && s.enabled
  );
}

export async function getInterests(): Promise<string[]> {
  const cfg = await loadConfig();
  return cfg.interests;
}

export async function getCategoryEmoji(category: string): Promise<string> {
  const cfg = await loadConfig();
  return cfg.categories[category] || `📌 ${category}`;
}
