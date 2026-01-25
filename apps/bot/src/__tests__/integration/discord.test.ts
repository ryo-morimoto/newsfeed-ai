import { test, expect, describe, afterEach, mock } from "bun:test";
import { sendToDiscord, type NotifyArticle } from "../../discord/notify";
import {
  sendEmbedsToDiscord,
  createCategoryEmbeds,
  createDigestEmbed,
} from "../../discord/discord-embed";

describe("Discord Integration", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const sampleArticles: NotifyArticle[] = [
    {
      title: "AI News Article",
      url: "https://ai.com/news",
      summary: "AIの最新ニュース",
      category: "ai",
      source: "AI Weekly",
    },
    {
      title: "Frontend Framework Update",
      url: "https://frontend.dev/update",
      summary: "フロントエンドの更新",
      category: "frontend",
      source: "Dev Blog",
    },
  ];

  describe("sendToDiscord (text format)", () => {
    test("sends articles to webhook successfully", async () => {
      const receivedPayloads: string[] = [];

      globalThis.fetch = mock(async (_url: unknown, options: unknown) => {
        const body = JSON.parse((options as RequestInit)?.body as string);
        receivedPayloads.push(body.content);
        return new Response("", { status: 204 });
      }) as unknown as typeof fetch;

      const result = await sendToDiscord("https://discord.webhook/test", sampleArticles);

      expect(result).toBe(true);
      expect(receivedPayloads.length).toBe(1);
      expect(receivedPayloads[0]).toContain("Tech Digest");
      expect(receivedPayloads[0]).toContain("AIの最新");
    });

    test("returns false when webhook URL is empty", async () => {
      const result = await sendToDiscord("", sampleArticles);
      expect(result).toBe(false);
    });

    test("returns true for empty articles array", async () => {
      const result = await sendToDiscord("https://discord.webhook/test", []);
      expect(result).toBe(true);
    });

    test("splits long messages into chunks", async () => {
      const receivedPayloads: string[] = [];

      globalThis.fetch = mock(async (_url: unknown, options: unknown) => {
        const body = JSON.parse((options as RequestInit)?.body as string);
        receivedPayloads.push(body.content);
        return new Response("", { status: 204 });
      }) as unknown as typeof fetch;

      // Create many articles across many categories to exceed 2000 char limit
      const manyArticles: NotifyArticle[] = Array.from({ length: 50 }, (_, i) => ({
        title: `Article ${i} with a very long title that takes up a lot of space in the message`,
        url: `https://example.com/article-with-a-long-path-${i}`,
        summary: `This is a detailed summary for article number ${i} with lots of extra text to increase the overall message size significantly`,
        category: `category-${i % 10}`, // 10 different categories
        source: "Test Source with Long Name",
      }));

      const result = await sendToDiscord("https://discord.webhook/test", manyArticles);

      expect(result).toBe(true);
      // May be 1 or more chunks depending on content length
      expect(receivedPayloads.length).toBeGreaterThanOrEqual(1);

      // Each chunk should be under 2000 chars
      for (const payload of receivedPayloads) {
        expect(payload.length).toBeLessThan(2000);
      }
    });

    test("handles webhook failure", async () => {
      globalThis.fetch = mock(async () => {
        return new Response("Rate Limited", { status: 429 });
      }) as unknown as typeof fetch;

      const result = await sendToDiscord("https://discord.webhook/test", sampleArticles);
      expect(result).toBe(false);
    });

    test("handles network error", async () => {
      globalThis.fetch = mock(async () => {
        throw new Error("Network error");
      }) as unknown as typeof fetch;

      const result = await sendToDiscord("https://discord.webhook/test", sampleArticles);
      expect(result).toBe(false);
    });
  });

  describe("sendEmbedsToDiscord (embed format)", () => {
    test("sends embeds to webhook successfully", async () => {
      const receivedPayloads: unknown[] = [];

      globalThis.fetch = mock(async (_url: unknown, options: unknown) => {
        const body = JSON.parse((options as RequestInit)?.body as string);
        receivedPayloads.push(body);
        return new Response("", { status: 204 });
      }) as unknown as typeof fetch;

      const embeds = await createCategoryEmbeds(sampleArticles);
      const result = await sendEmbedsToDiscord("https://discord.webhook/test", embeds);

      expect(result).toBe(true);
      expect(receivedPayloads.length).toBe(1);
      expect((receivedPayloads[0] as { embeds: unknown[] }).embeds).toBeDefined();
      expect((receivedPayloads[0] as { embeds: unknown[] }).embeds.length).toBe(embeds.length);
    });

    test("splits embeds into chunks of 10", async () => {
      const receivedPayloads: unknown[] = [];

      globalThis.fetch = mock(async (_url: unknown, options: unknown) => {
        const body = JSON.parse((options as RequestInit)?.body as string);
        receivedPayloads.push(body);
        return new Response("", { status: 204 });
      }) as unknown as typeof fetch;

      // Create 15 embeds directly (header + 14 more)
      const embeds = [
        { title: "Header", description: "Test" },
        ...Array.from({ length: 14 }, (_, i) => ({
          title: `Embed ${i}`,
          description: `Content ${i}`,
        })),
      ];

      expect(embeds.length).toBe(15);

      const result = await sendEmbedsToDiscord("https://discord.webhook/test", embeds);

      expect(result).toBe(true);
      expect(receivedPayloads.length).toBe(2);
      expect((receivedPayloads[0] as { embeds: unknown[] }).embeds.length).toBe(10);
      expect((receivedPayloads[1] as { embeds: unknown[] }).embeds.length).toBe(5);
    });

    test("returns false when webhook URL is empty", async () => {
      const embeds = await createCategoryEmbeds(sampleArticles);
      const result = await sendEmbedsToDiscord("", embeds);
      expect(result).toBe(false);
    });

    test("returns true for empty embeds array", async () => {
      const result = await sendEmbedsToDiscord("https://discord.webhook/test", []);
      expect(result).toBe(true);
    });
  });

  describe("Embed content validation", () => {
    test("category embeds group articles correctly", async () => {
      const embeds = await createCategoryEmbeds(sampleArticles);

      // Header + 2 categories (ai, frontend)
      expect(embeds.length).toBe(3);

      // Check header
      expect(embeds[0].title).toBe("📰 Tech Digest");
      expect(embeds[0].description).toContain("2件");
    });

    test("digest embed contains all categories as fields", async () => {
      const embeds = await createDigestEmbed(sampleArticles);

      expect(embeds.length).toBe(1);
      expect(embeds[0].fields?.length).toBe(2); // ai, frontend
    });

    test("Japanese articles use title instead of summary", async () => {
      const jpArticles: NotifyArticle[] = [
        {
          title: "日本語の記事タイトル",
          url: "https://zenn.dev/article",
          summary: "", // Empty summary for Japanese
          category: "tech-jp",
          source: "Zenn",
        },
      ];

      const embeds = await createCategoryEmbeds(jpArticles);

      // Should contain the Japanese title, not empty summary
      const content = embeds.find((e) => e.description?.includes("zenn.dev"));
      expect(content?.description).toContain("日本語の記事タイトル");
    });
  });
});
