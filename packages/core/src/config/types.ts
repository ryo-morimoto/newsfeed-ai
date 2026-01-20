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

export interface CategoryConfig {
  key: string;
  emoji: string;
  displayName: string;
  colors: { bg: string; text: string };
}
