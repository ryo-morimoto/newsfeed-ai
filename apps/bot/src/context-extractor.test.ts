import { test, expect, beforeEach, afterAll, spyOn } from "bun:test";
import {
  logError,
  logWarn,
  getRecentErrors,
  clearErrorLog,
  extractFeedbackContext,
  formatContextForFeedback,
} from "./context-extractor";
import * as db from "./db";

// Spy on getRecentArticles to return mock data without affecting other tests
const mockArticles = [
  {
    id: 1,
    url: "https://example.com/article1",
    title: "Test Article 1",
    source: "HackerNews",
    category: "AI",
    summary: "This is a test article about AI and machine learning",
    score: 8.5,
    created_at: new Date().toISOString(),
    notified: true,
  },
  {
    id: 2,
    url: "https://example.com/article2",
    title: "Test Article 2",
    source: "TechCrunch",
    category: "Tech",
    summary: "This is another test article about technology",
    score: 7.2,
    created_at: new Date().toISOString(),
    notified: true,
  },
];

const getRecentArticlesSpy = spyOn(db, "getRecentArticles").mockResolvedValue(mockArticles);

beforeEach(() => {
  clearErrorLog();
});

afterAll(() => {
  getRecentArticlesSpy.mockRestore();
});

test("logError adds entries to buffer", () => {
  logError("Test error message", { source: "test" });

  const errors = getRecentErrors(60);
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Test error message");
  expect(errors[0].level).toBe("error");
  expect(errors[0].source).toBe("test");
});

test("logWarn adds warning entries to buffer", () => {
  logWarn("Test warning message", { source: "test" });

  const errors = getRecentErrors(60);
  expect(errors.length).toBe(1);
  expect(errors[0].message).toBe("Test warning message");
  expect(errors[0].level).toBe("warn");
});

test("getRecentErrors filters by time", async () => {
  logError("Recent error", { source: "test" });

  // All errors within last 60 minutes
  const recentErrors = getRecentErrors(60);
  expect(recentErrors.length).toBe(1);

  // Errors are included if minutes > 0 since they were just added
  const veryRecentErrors = getRecentErrors(1);
  expect(veryRecentErrors.length).toBe(1);
});

test("clearErrorLog clears all entries", () => {
  logError("Error 1");
  logError("Error 2");
  logError("Error 3");

  expect(getRecentErrors(60).length).toBe(3);

  clearErrorLog();

  expect(getRecentErrors(60).length).toBe(0);
});

test("extractFeedbackContext returns structured data", async () => {
  logError("Test error for context", { source: "pipeline" });

  const context = await extractFeedbackContext({
    feedHours: 24,
    feedLimit: 5,
    errorMinutes: 60,
  });

  // Check articles
  expect(context.recentArticles.length).toBeGreaterThan(0);
  expect(context.recentArticles[0]).toHaveProperty("title");
  expect(context.recentArticles[0]).toHaveProperty("url");
  expect(context.recentArticles[0]).toHaveProperty("source");

  // Check errors
  expect(context.recentErrors.length).toBe(1);
  expect(context.recentErrors[0].message).toBe("Test error for context");

  // Check system info
  expect(context.systemInfo).toHaveProperty("uptime");
  expect(context.systemInfo).toHaveProperty("memoryUsage");
  expect(context.systemInfo).toHaveProperty("nodeVersion");
});

test("formatContextForFeedback produces readable markdown", async () => {
  logError("Format test error", { source: "test" });
  logWarn("Format test warning", { source: "test" });

  const context = await extractFeedbackContext();
  const formatted = formatContextForFeedback(context);

  // Check sections exist
  expect(formatted).toContain("## Recent Articles");
  expect(formatted).toContain("## Recent Errors");
  expect(formatted).toContain("## System Info");

  // Check article content
  expect(formatted).toContain("Test Article 1");
  expect(formatted).toContain("HackerNews");

  // Check error content
  expect(formatted).toContain("Format test error");
  expect(formatted).toContain("Format test warning");

  // Check system info
  expect(formatted).toContain("Uptime:");
  expect(formatted).toContain("Memory:");
});

test("buffer respects size limit", () => {
  // Fill buffer beyond limit (50)
  for (let i = 0; i < 60; i++) {
    logError(`Error ${i}`);
  }

  const errors = getRecentErrors(60);
  // Should be capped at 50
  expect(errors.length).toBe(50);
  // Oldest errors should be dropped, newest kept
  expect(errors[0].message).toBe("Error 10");
  expect(errors[49].message).toBe("Error 59");
});
