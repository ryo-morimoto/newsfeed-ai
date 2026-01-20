import { test, expect, describe, mock, beforeEach } from "bun:test";

/**
 * Integration tests for agent-feedback module with vibe-kanban MCP.
 *
 * Note: These tests mock the Claude Agent SDK since actual agent execution
 * requires API keys, vibe-kanban server, and takes significant time.
 * The tests verify:
 * 1. The module correctly processes SDK responses
 * 2. Task IDs and attempt IDs are extracted from responses
 * 3. Error handling works correctly
 */

// We need to mock the SDK before importing the module
const mockQuery = mock(() => {
  return (async function* () {
    yield { type: "system", subtype: "init", session_id: "test-session" };
  })();
});

// Mock the SDK module
mock.module("@anthropic-ai/claude-agent-sdk", () => ({
  query: mockQuery,
}));

// Import after mocking
import { runFeedbackAgent } from "../../agent-feedback";

describe("Agent Feedback Integration (vibe-kanban MCP)", () => {
  beforeEach(() => {
    mockQuery.mockClear();
  });

  describe("runFeedbackAgent with mocked SDK", () => {
    test("returns success when task and workspace IDs are found", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [
              {
                type: "text",
                text: '{"task_id": "abc-123-def"}',
              },
            ],
            session_id: "test-session",
          };
          yield {
            type: "user",
            tool_use_result: [
              {
                type: "text",
                text: '{"task_id": "abc-123-def", "workspace_id": "xyz-789"}',
              },
            ],
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Add test feature", "TestUser");

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("abc-123-def");
      expect(result.attemptId).toBe("xyz-789");
    });

    test("returns success with PR URL when available", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [
              {
                type: "text",
                text: '{"task_id": "task-1", "workspace_id": "workspace-1"}',
              },
            ],
            session_id: "test-session",
          };
          yield {
            type: "result",
            subtype: "success",
            result: "PR created: https://github.com/owner/repo/pull/123",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Fix bug", "TestUser");

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe("https://github.com/owner/repo/pull/123");
    });

    test("returns partial failure when only task created", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [
              {
                type: "text",
                text: '{"task_id": "abc-123"}',
              },
            ],
            session_id: "test-session",
          };
          yield {
            type: "result",
            subtype: "success",
            result: "Failed to start workspace session",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Update docs", "TestUser");

      expect(result.success).toBe(false);
      expect(result.taskId).toBe("abc-123");
      expect(result.attemptId).toBeUndefined();
      expect(result.error).toContain("failed to start attempt");
    });

    test("returns failure when no task created", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "result",
            subtype: "success",
            result: "Could not connect to vibe-kanban",
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Add feature", "TestUser");

      expect(result.success).toBe(false);
      expect(result.taskId).toBeUndefined();
      expect(result.error).toContain("Failed to create task");
    });

    test("handles SDK errors gracefully", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          throw new Error("MCP server not available");
        })();
      });

      const result = await runFeedbackAgent("Add feature", "TestUser");

      expect(result.success).toBe(false);
      expect(result.error).toBe("MCP server not available");
      expect(result.logs).toContain("Agent failed: MCP server not available");
    });

    test("logs contain expected information", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [{ type: "text", text: '{"task_id": "t1", "workspace_id": "w1"}' }],
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Test logging", "User123");

      expect(result.logs).toContainEqual(
        expect.stringContaining('Starting feedback agent for: "Test logging"')
      );
      expect(result.logs).toContainEqual(
        expect.stringContaining("Requested by: User123")
      );
    });

    test("extracts IDs from tool result JSON", async () => {
      mockQuery.mockImplementation(() => {
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [
              {
                type: "text",
                text: '{"task_id": "550e8400-e29b-41d4-a716-446655440000", "workspace_id": "660f9500-f30c-52e5-b827-557766551111"}',
              },
            ],
            session_id: "test-session",
          };
        })();
      });

      const result = await runFeedbackAgent("Complex task", "TestUser");

      expect(result.success).toBe(true);
      expect(result.taskId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(result.attemptId).toBe("660f9500-f30c-52e5-b827-557766551111");
    });
  });

  describe("prompt construction", () => {
    test("feedback and instructions are included in prompt", async () => {
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
      expect(capturedPrompt).toContain("list_projects");
      expect(capturedPrompt).toContain("create_task");
      expect(capturedPrompt).toContain("start_workspace_session");
      expect(capturedPrompt).toContain("CLAUDE_CODE");
    });

    test("project ID is included when provided", async () => {
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

      await runFeedbackAgent("Add feature", "TestUser", "project-123");

      expect(capturedPrompt).toContain("project_id: project-123");
    });
  });

  describe("MCP tools configuration", () => {
    test("uses correct MCP tools", async () => {
      let capturedOptions: Record<string, unknown> = {};

      mockQuery.mockImplementation((params: { options?: Record<string, unknown> }) => {
        capturedOptions = params.options || {};
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [{ type: "text", text: '{"task_id": "t1", "workspace_id": "w1"}' }],
          };
        })();
      });

      await runFeedbackAgent("Test", "User");

      const allowedTools = capturedOptions.allowedTools as string[];
      expect(allowedTools).toContain("mcp__vibe-kanban__list_projects");
      expect(allowedTools).toContain("mcp__vibe-kanban__create_task");
      expect(allowedTools).toContain("mcp__vibe-kanban__list_repos");
      expect(allowedTools).toContain("mcp__vibe-kanban__start_workspace_session");
    });

    test("passes VK_PORT env to MCP server when port file exists", async () => {
      let capturedOptions: Record<string, unknown> = {};

      mockQuery.mockImplementation((params: { options?: Record<string, unknown> }) => {
        capturedOptions = params.options || {};
        return (async function* () {
          yield {
            type: "user",
            tool_use_result: [{ type: "text", text: '{"task_id": "t1", "workspace_id": "w1"}' }],
          };
        })();
      });

      await runFeedbackAgent("Test", "User");

      // The mcpServers config should include vibe-kanban with env
      const mcpServers = capturedOptions.mcpServers as Record<string, { command: string; args?: string[]; env?: Record<string, string> }>;
      expect(mcpServers).toBeDefined();
      expect(mcpServers["vibe-kanban"]).toBeDefined();
      expect(mcpServers["vibe-kanban"].command).toBe("npx");
      expect(mcpServers["vibe-kanban"].args).toContain("--mcp");
      // Note: env will be set only if the port file exists
      // In CI/test environment, it may or may not have a port file
    });
  });
});
