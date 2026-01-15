import { test, expect, describe } from "bun:test";
import type { FeedbackResult } from "./agent-feedback";

describe("agent-feedback", () => {
  describe("FeedbackResult interface", () => {
    test("success result with task and attempt IDs", () => {
      const result: FeedbackResult = {
        success: true,
        taskId: "task-123-abc",
        attemptId: "attempt-456-def",
        logs: ["Task created", "Attempt started"],
      };

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();
      expect(result.attemptId).toBeDefined();
      expect(result.logs.length).toBeGreaterThan(0);
    });

    test("success result with PR URL", () => {
      const result: FeedbackResult = {
        success: true,
        taskId: "task-123",
        attemptId: "attempt-456",
        prUrl: "https://github.com/owner/repo/pull/123",
        logs: ["Task created", "PR created"],
      };

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    test("partial failure - task created but no attempt", () => {
      const result: FeedbackResult = {
        success: false,
        taskId: "task-123",
        error: "Failed to start attempt",
        logs: ["Task created", "Attempt failed"],
      };

      expect(result.success).toBe(false);
      expect(result.taskId).toBeDefined();
      expect(result.attemptId).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    test("complete failure - no task created", () => {
      const result: FeedbackResult = {
        success: false,
        error: "vibe-kanban MCP not available",
        logs: ["Connection failed"],
      };

      expect(result.success).toBe(false);
      expect(result.taskId).toBeUndefined();
      expect(result.attemptId).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe("ID extraction patterns", () => {
    // Pattern matches: task_id: "value", task_id: value, "task_id": "value"
    const taskIdPattern = /"?task_id"?[:\s]+["']?([a-zA-Z0-9-]+)["']?/i;
    const attemptIdPattern = /"?attempt_id"?[:\s]+["']?([a-zA-Z0-9-]+)["']?/i;

    test("extracts task_id from JSON-like format", () => {
      const text = '{"task_id": "abc123-def456"}';
      const match = text.match(taskIdPattern);
      expect(match?.[1]).toBe("abc123-def456");
    });

    test("extracts task_id from prose", () => {
      const text = "Created task with task_id: abc-123-def";
      const match = text.match(taskIdPattern);
      expect(match?.[1]).toBe("abc-123-def");
    });

    test("extracts attempt_id", () => {
      const text = 'attempt_id: "attempt-789"';
      const match = text.match(attemptIdPattern);
      expect(match?.[1]).toBe("attempt-789");
    });

    test("handles UUID format", () => {
      const text = "task_id: 550e8400-e29b-41d4-a716-446655440000";
      const match = text.match(taskIdPattern);
      expect(match?.[1]).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });

  describe("PR URL extraction", () => {
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
