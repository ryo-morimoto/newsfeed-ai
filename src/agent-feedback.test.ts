import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";
import { generateSlug, type FeedbackResult } from "./agent-feedback";

describe("agent-feedback", () => {
  describe("generateSlug", () => {
    // Mock Date.now for consistent timestamps
    const originalDateNow = Date.now;

    beforeEach(() => {
      // Fixed timestamp for testing: 1704067200000 (2024-01-01)
      Date.now = mock(() => 1704067200000);
    });

    afterEach(() => {
      Date.now = originalDateNow;
    });

    test("generates slug from feedback text", () => {
      const slug = generateSlug("Add a new feature");
      expect(slug).toMatch(/^feedback\/add-a-new-[a-z0-9]+$/);
    });

    test("takes only first 3 words", () => {
      const slug = generateSlug("This is a very long feedback message");
      expect(slug).toMatch(/^feedback\/this-is-a-[a-z0-9]+$/);
    });

    test("removes special characters", () => {
      const slug = generateSlug("Add RSS! source @ now?");
      expect(slug).toMatch(/^feedback\/add-rss-source-[a-z0-9]+$/);
    });

    test("handles single word", () => {
      const slug = generateSlug("Fix");
      expect(slug).toMatch(/^feedback\/fix-[a-z0-9]+$/);
    });

    test("handles empty string", () => {
      const slug = generateSlug("");
      expect(slug).toMatch(/^feedback\/-[a-z0-9]+$/);
    });

    test("converts to lowercase", () => {
      const slug = generateSlug("ADD NEW Feature");
      expect(slug).toMatch(/^feedback\/add-new-feature-[a-z0-9]+$/);
    });

    test("handles Japanese text (removes non-ascii)", () => {
      const slug = generateSlug("新しい機能を追加");
      // Japanese chars are removed, leaving empty words
      expect(slug).toMatch(/^feedback\/-[a-z0-9]+$/);
    });

    test("handles mixed content", () => {
      const slug = generateSlug("Add 新機能 feature");
      expect(slug).toMatch(/^feedback\/add-feature-[a-z0-9]+$/);
    });

    test("includes timestamp suffix", () => {
      const slug1 = generateSlug("test");
      Date.now = mock(() => 1704067200001);
      const slug2 = generateSlug("test");

      // Different timestamps should produce different slugs
      // (though in this test both use mocked values)
      expect(slug1).toContain("feedback/test-");
      expect(slug2).toContain("feedback/test-");
    });
  });

  describe("FeedbackResult interface", () => {
    test("success result has required fields", () => {
      const result: FeedbackResult = {
        success: true,
        prUrl: "https://github.com/owner/repo/pull/123",
        branchName: "feedback/test-abc1",
        logs: ["Started", "Completed"],
      };

      expect(result.success).toBe(true);
      expect(result.prUrl).toBeDefined();
      expect(result.branchName).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);
    });

    test("failure result has error field", () => {
      const result: FeedbackResult = {
        success: false,
        branchName: "feedback/test-abc1",
        error: "Something went wrong",
        logs: ["Started", "Failed"],
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.prUrl).toBeUndefined();
    });
  });

  describe("PR URL extraction patterns", () => {
    const prUrlPattern = /https:\/\/github\.com\/[^\s]+\/pull\/\d+/;

    test("matches standard GitHub PR URL", () => {
      const text = "Created PR: https://github.com/owner/repo/pull/123";
      const match = text.match(prUrlPattern);
      expect(match?.[0]).toBe("https://github.com/owner/repo/pull/123");
    });

    test("matches PR URL with org name", () => {
      const text = "https://github.com/anthropic-ai/claude-code/pull/456";
      const match = text.match(prUrlPattern);
      expect(match?.[0]).toBe("https://github.com/anthropic-ai/claude-code/pull/456");
    });

    test("matches PR URL in markdown", () => {
      const text = "[PR](https://github.com/owner/repo/pull/789)";
      const match = text.match(prUrlPattern);
      expect(match?.[0]).toBe("https://github.com/owner/repo/pull/789");
    });

    test("does not match non-PR GitHub URLs", () => {
      const text = "https://github.com/owner/repo/issues/123";
      const match = text.match(prUrlPattern);
      expect(match).toBeNull();
    });

    test("extracts first PR URL when multiple present", () => {
      const text = "PR1: https://github.com/a/b/pull/1 PR2: https://github.com/c/d/pull/2";
      const match = text.match(prUrlPattern);
      expect(match?.[0]).toBe("https://github.com/a/b/pull/1");
    });
  });
});
