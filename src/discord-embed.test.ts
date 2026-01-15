import { test, expect, describe } from "bun:test";
import {
  createCategoryEmbeds,
  createArticleEmbeds,
  createDigestEmbed,
  type DiscordEmbed,
} from "./discord-embed";
import type { NotifyArticle } from "./notify";

// Test data
const sampleArticles: NotifyArticle[] = [
  {
    title: "New AI Model Released",
    url: "https://example.com/ai-model",
    summary: "革新的なAIモデルがリリースされました",
    category: "ai",
    source: "Tech News",
    published: new Date(),
  },
  {
    title: "React 20 Announced",
    url: "https://example.com/react-20",
    summary: "React 20の新機能",
    category: "frontend",
    source: "Dev Blog",
    published: new Date(Date.now() - 86400000), // 1 day ago
  },
  {
    title: "日本のテック企業が急成長",
    url: "https://example.com/jp-tech",
    summary: "", // Japanese articles don't have summary
    category: "tech-jp",
    source: "Tech JP",
  },
];

describe("createCategoryEmbeds", () => {
  test("groups articles by category", () => {
    const embeds = createCategoryEmbeds(sampleArticles);
    
    // Should have header + one embed per category
    expect(embeds.length).toBe(4); // header + ai + frontend + tech-jp
  });

  test("header embed has correct structure", () => {
    const embeds = createCategoryEmbeds(sampleArticles);
    const header = embeds[0];
    
    expect(header.title).toBe("📰 Tech Digest");
    expect(header.description).toContain("3件");
    expect(header.color).toBe(0x5865f2);
  });

  test("category embeds have correct colors", () => {
    const embeds = createCategoryEmbeds(sampleArticles);
    
    // Find AI category embed
    const aiEmbed = embeds.find(e => e.title?.includes("AI") || e.description?.includes("ai-model"));
    expect(aiEmbed).toBeDefined();
    expect(aiEmbed?.color).toBe(0x8b5cf6); // Purple for AI
  });

  test("handles empty array", () => {
    const embeds = createCategoryEmbeds([]);
    
    // Should still have header
    expect(embeds.length).toBe(1);
    expect(embeds[0].description).toContain("0件");
  });

  test("includes article URLs in description", () => {
    const embeds = createCategoryEmbeds(sampleArticles);
    
    // Find an embed with article content
    const hasUrls = embeds.some(e => 
      e.description?.includes("https://example.com")
    );
    expect(hasUrls).toBe(true);
  });
});

describe("createArticleEmbeds", () => {
  test("creates one embed per article", () => {
    const embeds = createArticleEmbeds(sampleArticles);
    
    expect(embeds.length).toBe(sampleArticles.length);
  });

  test("embed has correct structure", () => {
    const embeds = createArticleEmbeds(sampleArticles);
    const firstEmbed = embeds[0];
    
    expect(firstEmbed.title).toBe("New AI Model Released");
    expect(firstEmbed.url).toBe("https://example.com/ai-model");
    expect(firstEmbed.description).toBe("革新的なAIモデルがリリースされました");
    expect(firstEmbed.footer?.text).toContain("Tech News");
  });

  test("truncates long titles to 256 chars", () => {
    const longTitle = "A".repeat(300);
    const articles: NotifyArticle[] = [{
      title: longTitle,
      url: "https://example.com",
      summary: "",
      category: "tech",
      source: "Test",
    }];
    
    const embeds = createArticleEmbeds(articles);
    expect(embeds[0].title?.length).toBe(256);
  });

  test("handles undefined summary", () => {
    const articles: NotifyArticle[] = [{
      title: "No Summary",
      url: "https://example.com",
      summary: "",
      category: "tech",
      source: "Test",
    }];
    
    const embeds = createArticleEmbeds(articles);
    expect(embeds[0].description).toBeUndefined();
  });
});

describe("createDigestEmbed", () => {
  test("creates single digest embed", () => {
    const embeds = createDigestEmbed(sampleArticles);
    
    expect(embeds.length).toBe(1);
  });

  test("digest has fields for each category", () => {
    const embeds = createDigestEmbed(sampleArticles);
    const digest = embeds[0];
    
    expect(digest.fields).toBeDefined();
    expect(digest.fields?.length).toBe(3); // ai, frontend, tech-jp
  });

  test("includes article count", () => {
    const embeds = createDigestEmbed(sampleArticles);
    const digest = embeds[0];
    
    expect(digest.description).toContain("3 articles");
  });

  test("has timestamp", () => {
    const embeds = createDigestEmbed(sampleArticles);
    const digest = embeds[0];
    
    expect(digest.timestamp).toBeDefined();
  });

  test("truncates long summaries in fields", () => {
    const longSummary = "A".repeat(100);
    const articles: NotifyArticle[] = [{
      title: "Test",
      url: "https://example.com",
      summary: longSummary,
      category: "tech",
      source: "Test",
    }];
    
    const embeds = createDigestEmbed(articles);
    const field = embeds[0].fields?.[0];
    
    // Should be truncated to ~60 chars + "..."
    expect(field?.value.length).toBeLessThan(100);
  });
});
