import { test, expect, describe, mock, beforeEach, afterEach } from "bun:test";

/**
 * Integration tests for agent-feedback module.
 *
 * Note: These tests mock the Claude Agent SDK since actual agent execution
 * requires API keys and takes significant time. The tests verify:
 * 1. The module correctly processes SDK responses
 * 2. PR URLs are extracted from various message formats
 * 3. Error handling works correctly
 */

// We need to mock the SDK before importing the module
const mockQuery = mock(() => {
  // Return an async generator
  return (async function* () {
    yield {
      type: "system",
      subtype: "init",
      session_id: "test-session",
    };
  })();
});

// Mock the SDK module
mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: mockQuery,
}));

// Import after mocking
import { runFeedbackAgent, generateSlug } from "../../agent-feedback";

describe("Agent Feedback Integration", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe("runFeedbackAgent with mocked SDK", () => {
    test("returns success when PR URL is found in result message", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "system",
            subtype: "init",
            session_id: "test-session",
          };
          yield {
            type: "result",
            subtype: "success",
            result: "Created PR: https://github.com/owner/repo/pull/123",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Add test feature", "TestUser");

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe("https://github.com/owner/repo/pull/123");
      expect(result.branchName).toMatch(/^feedback\/add-test-feature-/);
      expect(result.logs).toContain('PR created: https://github.com/owner/repo/pull/123');
    });

    test("returns success when PR URL is found in assistant message", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "assistant",
            content: [
              {
                type: "text",
                text: "I created the PR at https://github.com/test/repo/pull/456",
              },
            ],
            session_id: "test-session",
          };
          yield {
            type: "result",
            subtype: "success",
            result: "Done!",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Fix bug", "TestUser");

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe("https://github.com/test/repo/pull/456");
    });

    test("returns failure when no PR URL found", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Changes made but no PR created",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Update docs", "TestUser");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No PR URL found in agent output");
      expect(result.prUrl).toBeUndefined();
    });

    test("handles SDK errors gracefully", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          throw new Error("API key not configured");
        })();
      });

      const result = await runFeedbackAgent("Add feature", "TestUser");

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key not configured");
      expect(result.logs).toContain("Agent failed: API key not configured");
    });

    test("logs contain expected information", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "https://github.com/a/b/pull/1",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Test logging", "User123");

      expect(result.logs).toContainEqual(
        expect.stringContaining('Starting agent for feedback: "Test logging"')
      );
      expect(result.logs).toContainEqual(
        expect.stringContaining("Requested by: User123")
      );
      expect(result.logs).toContainEqual(
        expect.stringContaining("Branch: feedback/test-logging-")
      );
    });

    test("extracts PR URL from complex message content", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "assistant",
            content: [
              { type: "text", text: "First I analyzed the code..." },
              { type: "text", text: "Then I made changes..." },
              {
                type: "text",
                text: "Finally, here's the PR: https://github.com/org/project/pull/999 - please review!",
              },
            ],
            session_id: "test-session",
          };
          yield {
            type: "result",
            subtype: "success",
            result: "All done",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Complex task", "TestUser");

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe("https://github.com/org/project/pull/999");
    });
  });

  describe("generateSlug integration", () => {
    test("generated branch names are valid git branch names", () => {
      const testCases = [
        "Add new feature",
        "Fix bug in login",
        "Update dependencies!!!",
        "日本語のフィードバック",
        "Mixed 日本語 and English",
        "Special chars @#$%^&*()",
        "",
        "   spaces   everywhere   ",
      ];

      for (const feedback of testCases) {
        const slug = generateSlug(feedback);

        // Valid git branch name rules:
        // - No spaces
        // - Can contain slashes (for namespacing)
        // - No consecutive dots
        // - Cannot start with dot or dash
        expect(slug).not.toContain(" ");
        expect(slug).toMatch(/^feedback\//);
        expect(slug).not.toMatch(/\.\./);
        expect(slug).not.toMatch(/^-/);
      }
    });
  });

  describe("prompt construction", () => {
    test("feedback is included in agent execution", async () => {
      let capturedPrompt = "";

      mockQuery.mockImplementation((params: { prompt: string }) => {
        capturedPrompt = params.prompt;
        return (async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Done",
            session_id: "test-session",
          };
        })();
      });

      await runFeedbackAgent("Add dark mode support", "TestUser");

      expect(capturedPrompt).toContain("Add dark mode support");
      expect(capturedPrompt).toContain("feedback/add-dark-mode-");
    });
  });
});
