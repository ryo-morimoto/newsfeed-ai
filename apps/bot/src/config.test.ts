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
  test("loadConfig returns valid config object", async () => {
    const config = await loadConfig();

    expect(config).toBeDefined();
    expect(config.sources).toBeArray();
    expect(config.interests).toBeArray();
    expect(config.categories).toBeDefined();
  });

  test("config has expected source types", async () => {
    const config = await loadConfig();
    const types = config.sources.map((s) => s.type);

    expect(types).toContain("rss");
    expect(types).toContain("hackernews");
    expect(types).toContain("github-trending");
  });
});

describe("getRssSources", () => {
  test("returns only RSS sources", async () => {
    const sources = await getRssSources();

    for (const source of sources) {
      expect(source.type).toBe("rss");
    }
  });

  test("returns only enabled sources", async () => {
    const sources = await getRssSources();

    for (const source of sources) {
      expect(source.enabled).toBe(true);
    }
  });

  test("RSS sources have url property", async () => {
    const sources = await getRssSources();

    for (const source of sources) {
      expect(source.url).toBeDefined();
      expect(source.url).toStartWith("http");
    }
  });
});

describe("getHackerNewsSource", () => {
  test("returns HackerNews source if enabled", async () => {
    const source = await getHackerNewsSource();

    // May be undefined if disabled in config
    if (source) {
      expect(source.type).toBe("hackernews");
      expect(source.name).toBe("Hacker News");
    }
  });
});

describe("getGitHubTrendingSource", () => {
  test("returns GitHub Trending source if enabled", async () => {
    const source = await getGitHubTrendingSource();

    if (source) {
      expect(source.type).toBe("github-trending");
      expect(source.languages).toBeArray();
      expect(source.languages.length).toBeGreaterThan(0);
    }
  });

  test("GitHub source has expected languages", async () => {
    const source = await getGitHubTrendingSource();

    if (source) {
      expect(source.languages).toContain("typescript");
      expect(source.languages).toContain("rust");
      expect(source.languages).toContain("go");
    }
  });
});

describe("getInterests", () => {
  test("returns array of interests", async () => {
    const interests = await getInterests();

    expect(interests).toBeArray();
    expect(interests.length).toBeGreaterThan(0);
  });

  test("interests are strings", async () => {
    const interests = await getInterests();

    for (const interest of interests) {
      expect(typeof interest).toBe("string");
    }
  });
});

describe("getCategoryEmoji", () => {
  test("returns emoji for known category", async () => {
    expect(await getCategoryEmoji("ai")).toBe("🤖 AI/LLM");
    expect(await getCategoryEmoji("tech")).toBe("💻 Tech");
    expect(await getCategoryEmoji("frontend")).toBe("⚛️ Frontend");
    expect(await getCategoryEmoji("backend")).toBe("🔧 Backend");
    expect(await getCategoryEmoji("repos")).toBe("📦 Trending Repos");
    expect(await getCategoryEmoji("crypto")).toBe("📊 Crypto");
    expect(await getCategoryEmoji("tech-jp")).toBe("🇯🇵 日本語Tech");
  });

  test("returns fallback for unknown category", async () => {
    const result = await getCategoryEmoji("unknown-category");

    expect(result).toContain("📌");
    expect(result).toContain("unknown-category");
  });
});
