import { describe, test, expect } from "bun:test";
import { CATEGORIES, getCategoryEmoji, getCategoryColor, getCategoryConfig } from "./categories";

describe("categories module", () => {
  describe("CATEGORIES", () => {
    test("has AI category defined", () => {
      expect(CATEGORIES["AI"]).toBeDefined();
      expect(CATEGORIES["AI"].emoji).toBe("🤖");
    });

    test("has common categories", () => {
      expect(CATEGORIES["Web"]).toBeDefined();
      expect(CATEGORIES["OSS"]).toBeDefined();
      expect(CATEGORIES["DevOps"]).toBeDefined();
    });
  });

  describe("getCategoryEmoji", () => {
    test("returns emoji and display name for known category", () => {
      const result = getCategoryEmoji("AI");
      expect(result).toContain("🤖");
      expect(result).toContain("AI/LLM");
    });

    test("returns default emoji for unknown category", () => {
      const result = getCategoryEmoji("unknown-category");
      expect(result).toContain("📌");
      expect(result).toContain("unknown-category");
    });
  });

  describe("getCategoryColor", () => {
    test("returns colors for known category", () => {
      const colors = getCategoryColor("AI");
      expect(colors.bg).toBe("#8b5cf6");
      expect(colors.text).toBe("#ffffff");
    });

    test("returns default colors for unknown category", () => {
      const colors = getCategoryColor("unknown-category");
      expect(colors.bg).toBe("#6b7280");
      expect(colors.text).toBe("#ffffff");
    });
  });

  describe("getCategoryConfig", () => {
    test("returns full config for known category", () => {
      const config = getCategoryConfig("Web");
      expect(config.key).toBe("Web");
      expect(config.emoji).toBe("🌐");
      expect(config.displayName).toBe("Web開発");
      expect(config.colors).toBeDefined();
    });

    test("returns default config with category name for unknown category", () => {
      const config = getCategoryConfig("custom");
      expect(config.key).toBe("custom");
      expect(config.displayName).toBe("custom");
      expect(config.emoji).toBe("📌");
    });
  });
});
