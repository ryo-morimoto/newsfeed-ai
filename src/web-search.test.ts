import { test, expect, describe, mock } from "bun:test";
import {
  webSearch,
  webSearchWithGroq,
  smartSearch,
  type WebSearchResponse,
} from "./web-search";

describe("web-search", () => {
  describe("webSearch", () => {
    test("should throw error when no API key is provided", async () => {
      // Save and clear the env variable
      const originalKey = process.env.PERPLEXITY_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;

      try {
        await expect(webSearch("test query")).rejects.toThrow(
          "PERPLEXITY_API_KEY not set"
        );
      } finally {
        // Restore the env variable
        if (originalKey) {
          process.env.PERPLEXITY_API_KEY = originalKey;
        }
      }
    });

    test("should throw error when query is too long", async () => {
      const longQuery = "a".repeat(2001);
      await expect(webSearch(longQuery, "fake-key")).rejects.toThrow(
        "Query too long (max 2000 characters)"
      );
    });
  });

  describe("webSearchWithGroq", () => {
    test("should throw error when no API key is provided", async () => {
      // Save and clear the env variable
      const originalKey = process.env.GROQ_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        await expect(webSearchWithGroq("test query")).rejects.toThrow(
          "GROQ_API_KEY not set"
        );
      } finally {
        // Restore the env variable
        if (originalKey) {
          process.env.GROQ_API_KEY = originalKey;
        }
      }
    });
  });

  describe("smartSearch", () => {
    test("should throw error when no API keys are available", async () => {
      // Save and clear env variables
      const originalPerplexity = process.env.PERPLEXITY_API_KEY;
      const originalGroq = process.env.GROQ_API_KEY;
      delete process.env.PERPLEXITY_API_KEY;
      delete process.env.GROQ_API_KEY;

      try {
        await expect(smartSearch("test query")).rejects.toThrow(
          "No API key available"
        );
      } finally {
        // Restore env variables
        if (originalPerplexity) {
          process.env.PERPLEXITY_API_KEY = originalPerplexity;
        }
        if (originalGroq) {
          process.env.GROQ_API_KEY = originalGroq;
        }
      }
    });
  });
});
