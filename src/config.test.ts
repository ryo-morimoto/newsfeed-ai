import { test, expect, describe } from "bun:test";
import {
  loadConfig,
  getRssSources,
  getHackerNewsSource,
  getGitHubTrendingSource,
  getInterests,
  getCategoryEmoji,
} from "./config";

describe("Config Loading", () => {
  test("loadConfig returns valid config object", () => {
    const config = loadConfig();
    
    expect(config).toBeDefined();
    expect(config.sources).toBeArray();
    expect(config.interests).toBeArray();
    expect(config.categories).toBeDefined();
  });

  test("config has expected source types", () => {
    const config = loadConfig();
    const types = config.sources.map(s => s.type);
    
    expect(types).toContain("rss");
    expect(types).toContain("hackernews");
    expect(types).toContain("github-trending");
  });
});

describe("getRssSources", () => {
  test("returns only RSS sources", () => {
    const sources = getRssSources();
    
    for (const source of sources) {
      expect(source.type).toBe("rss");
    }
  });

  test("returns only enabled sources", () => {
    const sources = getRssSources();
    
    for (const source of sources) {
      expect(source.enabled).toBe(true);
    }
  });

  test("RSS sources have url property", () => {
    const sources = getRssSources();
    
    for (const source of sources) {
      expect(source.url).toBeDefined();
      expect(source.url).toStartWith("http");
    }
  });
});

describe("getHackerNewsSource", () => {
  test("returns HackerNews source if enabled", () => {
    const source = getHackerNewsSource();
    
    // May be undefined if disabled in config
    if (source) {
      expect(source.type).toBe("hackernews");
      expect(source.name).toBe("Hacker News");
    }
  });
});

describe("getGitHubTrendingSource", () => {
  test("returns GitHub Trending source if enabled", () => {
    const source = getGitHubTrendingSource();
    
    if (source) {
      expect(source.type).toBe("github-trending");
      expect(source.languages).toBeArray();
      expect(source.languages.length).toBeGreaterThan(0);
    }
  });

  test("GitHub source has expected languages", () => {
    const source = getGitHubTrendingSource();
    
    if (source) {
      expect(source.languages).toContain("typescript");
      expect(source.languages).toContain("rust");
      expect(source.languages).toContain("go");
    }
  });
});

describe("getInterests", () => {
  test("returns array of interests", () => {
    const interests = getInterests();
    
    expect(interests).toBeArray();
    expect(interests.length).toBeGreaterThan(0);
  });

  test("interests are strings", () => {
    const interests = getInterests();
    
    for (const interest of interests) {
      expect(typeof interest).toBe("string");
    }
  });
});

describe("getCategoryEmoji", () => {
  test("returns emoji for known category", () => {
    expect(getCategoryEmoji("ai")).toBe("🤖 AI/LLM");
    expect(getCategoryEmoji("tech")).toBe("💻 Tech");
    expect(getCategoryEmoji("frontend")).toBe("⚛️ Frontend");
    expect(getCategoryEmoji("backend")).toBe("🔧 Backend");
    expect(getCategoryEmoji("repos")).toBe("📦 Trending Repos");
    expect(getCategoryEmoji("crypto")).toBe("📊 Crypto");
    expect(getCategoryEmoji("tech-jp")).toBe("🇯🇵 日本語Tech");
  });

  test("returns fallback for unknown category", () => {
    const result = getCategoryEmoji("unknown-category");
    
    expect(result).toContain("📌");
    expect(result).toContain("unknown-category");
  });
});
