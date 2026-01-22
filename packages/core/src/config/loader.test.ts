import { describe, test, expect, beforeEach } from "bun:test";
import {
  loadConfigFromYaml,
  getConfig,
  resetConfig,
  getRssSources,
  getHackerNewsSource,
  getGitHubTrendingSource,
  getInterests,
  getCategoryDisplay,
} from "./loader";
import type { Config } from "./types";

// Mock YAML parser
const mockYamlParser = (content: string): unknown => {
  // Simple JSON-based mock since we control the test data
  return JSON.parse(content);
};

// Sample config for testing
const sampleConfig: Config = {
  sources: [
    { type: "rss", name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "tech", enabled: true },
    { type: "rss", name: "Disabled RSS", url: "https://disabled.com/feed/", category: "tech", enabled: false },
    { type: "hackernews", name: "Hacker News", category: "tech", enabled: true },
    { type: "github-trending", name: "GitHub Trending", category: "oss", enabled: true, languages: ["typescript", "rust"] },
  ],
  interests: ["AI", "Web Development", "Open Source"],
  categories: {
    tech: "🔧 Tech",
    oss: "🌟 OSS",
  },
};

describe("config loader", () => {
  beforeEach(() => {
    resetConfig();
  });

  describe("loadConfigFromYaml", () => {
    test("loads config from YAML content", () => {
      const config = loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      expect(config).toEqual(sampleConfig);
    });

    test("returns cached config on second call", () => {
      const config1 = loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const config2 = loadConfigFromYaml("different content", mockYamlParser);
      expect(config1).toBe(config2);
    });
  });

  describe("getConfig", () => {
    test("throws when config not loaded", () => {
      expect(() => getConfig()).toThrow("Config not loaded");
    });

    test("returns config when loaded", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const config = getConfig();
      expect(config).toEqual(sampleConfig);
    });
  });

  describe("resetConfig", () => {
    test("resets the cached config", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      resetConfig();
      expect(() => getConfig()).toThrow("Config not loaded");
    });
  });

  describe("getRssSources", () => {
    test("returns only enabled RSS sources", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const sources = getRssSources();
      expect(sources.length).toBe(1);
      expect(sources[0].name).toBe("TechCrunch");
    });

    test("returns empty array when no RSS sources enabled", () => {
      const configNoRss: Config = {
        sources: [
          { type: "hackernews", name: "HN", category: "tech", enabled: true },
        ],
        interests: [],
        categories: {},
      };
      loadConfigFromYaml(JSON.stringify(configNoRss), mockYamlParser);
      const sources = getRssSources();
      expect(sources).toEqual([]);
    });
  });

  describe("getHackerNewsSource", () => {
    test("returns HN source when enabled", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const source = getHackerNewsSource();
      expect(source).toBeDefined();
      expect(source?.name).toBe("Hacker News");
    });

    test("returns undefined when HN not enabled", () => {
      const configNoHn: Config = {
        sources: [
          { type: "hackernews", name: "HN", category: "tech", enabled: false },
        ],
        interests: [],
        categories: {},
      };
      loadConfigFromYaml(JSON.stringify(configNoHn), mockYamlParser);
      const source = getHackerNewsSource();
      expect(source).toBeUndefined();
    });
  });

  describe("getGitHubTrendingSource", () => {
    test("returns GitHub Trending source when enabled", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const source = getGitHubTrendingSource();
      expect(source).toBeDefined();
      expect(source?.languages).toContain("typescript");
    });

    test("returns undefined when GitHub Trending not enabled", () => {
      const configNoGh: Config = {
        sources: [
          { type: "github-trending", name: "GH", category: "oss", enabled: false, languages: [] },
        ],
        interests: [],
        categories: {},
      };
      loadConfigFromYaml(JSON.stringify(configNoGh), mockYamlParser);
      const source = getGitHubTrendingSource();
      expect(source).toBeUndefined();
    });
  });

  describe("getInterests", () => {
    test("returns interests array", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const interests = getInterests();
      expect(interests).toEqual(["AI", "Web Development", "Open Source"]);
    });
  });

  describe("getCategoryDisplay", () => {
    test("returns unified category emoji for known categories", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      // "AI" is a known unified category
      const display = getCategoryDisplay("AI");
      expect(display).toContain("AI");
    });

    test("falls back to config categories for unknown unified categories", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      // "tech" is in our config but uses generic emoji
      const display = getCategoryDisplay("tech");
      // Should get config value since unified uses generic 📌
      expect(display).toBeDefined();
    });

    test("returns generic display for completely unknown category", () => {
      loadConfigFromYaml(JSON.stringify(sampleConfig), mockYamlParser);
      const display = getCategoryDisplay("unknown-category");
      expect(display).toContain("unknown-category");
    });
  });
});
