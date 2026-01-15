import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export interface FeedbackResult {
  success: boolean;
  taskId?: string;
  attemptId?: string;
  prUrl?: string;
  error?: string;
  logs: string[];
}

const VK_PORT_FILE = "/tmp/vibe-kanban/vibe-kanban.port";

/**
 * Read the vibe-kanban port from the port file.
 * Returns the port number as a string, or undefined if the file doesn't exist.
 */
async function readVibeKanbanPort(): Promise<string | undefined> {
  try {
    const portStr = (await Bun.file(VK_PORT_FILE).text()).trim();
    return portStr || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get vibe-kanban MCP server configuration with the correct port.
 */
async function getVibeKanbanMcpConfig() {
  const port = await readVibeKanbanPort();

  return {
    "vibe-kanban": {
      command: "npx",
      args: ["vibe-kanban", "--mcp"],
      // Pass the port from the port file to the MCP server process
      env: port ? { VK_PORT: port } : undefined,
    },
  };
}

/**
 * Run feedback-driven development via vibe-kanban MCP.
 *
 * Flow:
 * 1. Use vibe-kanban MCP to create a task
 * 2. Start task attempt with claude-code executor
 * 3. vibe-kanban manages worktree, execution, and completion
 */
export async function runFeedbackAgent(
  feedback: string,
  requestedBy: string,
  projectId?: string
): Promise<FeedbackResult> {
  const logs: string[] = [];

  const log = (msg: string) => {
    console.log(`[agent] ${msg}`);
    logs.push(msg);
  };

  log(`Starting feedback agent for: "${feedback}"`);
  log(`Requested by: ${requestedBy}`);

  // Prompt for the agent to use vibe-kanban MCP tools
  const prompt = `
You have access to the vibe-kanban MCP server. Use it to create and execute a task for the following request.

## Request
${feedback}

## Instructions
1. First, call list_projects to find the newsfeed-ai project${projectId ? ` (project_id: ${projectId})` : ""}
2. Call create_task with:
   - project_id: the newsfeed-ai project ID
   - title: A concise title for this task
   - description: "${feedback}\\n\\nRequested by: ${requestedBy}"
3. Call start_task_attempt with:
   - task_id: the created task ID
   - executor: "claude-code"
   - base_branch: "main"

Report back the task_id and attempt_id once started.
The vibe-kanban system will handle the actual implementation in an isolated worktree.
`.trim();

  try {
    let taskId: string | undefined;
    let attemptId: string | undefined;
    let prUrl: string | undefined;

    for await (const message of query({
      prompt,
      options: {
        cwd: process.cwd(),
        allowedTools: ["mcp__vibe-kanban__list_projects", "mcp__vibe-kanban__create_task", "mcp__vibe-kanban__start_task_attempt", "mcp__vibe-kanban__list_tasks", "mcp__vibe-kanban__get_task"],
        mcpServers: await getVibeKanbanMcpConfig(),
        permissionMode: "acceptEdits",
        maxTurns: 10,
      },
    })) {
      const msg = message as SDKMessage;

      // Extract task_id and attempt_id from assistant messages
      if (msg.type === "assistant" && "content" in msg) {
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              // Look for task_id (UUID or alphanumeric with dashes)
              const taskMatch = block.text.match(/task_id[:\s]+["']?([a-zA-Z0-9-]+)["']?/i);
              if (taskMatch) {
                taskId = taskMatch[1];
                log(`Task created: ${taskId}`);
              }

              // Look for attempt_id (UUID or alphanumeric with dashes)
              const attemptMatch = block.text.match(/attempt_id[:\s]+["']?([a-zA-Z0-9-]+)["']?/i);
              if (attemptMatch) {
                attemptId = attemptMatch[1];
                log(`Attempt started: ${attemptId}`);
              }

              // Look for PR URL
              const prMatch = block.text.match(
                /https:\/\/github\.com\/[^\s]+\/pull\/\d+/
              );
              if (prMatch) {
                prUrl = prMatch[0];
                log(`PR created: ${prUrl}`);
              }
            }
          }
        }
      }

      // Also check result messages
      if ("result" in msg && typeof msg.result === "string") {
        const taskMatch = msg.result.match(/task_id[:\s]+["']?([a-zA-Z0-9-]+)["']?/i);
        if (taskMatch && !taskId) taskId = taskMatch[1];

        const attemptMatch = msg.result.match(/attempt_id[:\s]+["']?([a-zA-Z0-9-]+)["']?/i);
        if (attemptMatch && !attemptId) attemptId = attemptMatch[1];

        const prMatch = msg.result.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
        if (prMatch && !prUrl) prUrl = prMatch[0];
      }
    }

    if (taskId && attemptId) {
      log("Task attempt started successfully via vibe-kanban");
      return {
        success: true,
        taskId,
        attemptId,
        prUrl,
        logs,
      };
    }

    if (taskId) {
      log("Task created but attempt not started");
      return {
        success: false,
        taskId,
        error: "Task created but failed to start attempt",
        logs,
      };
    }

    log("Failed to create task");
    return {
      success: false,
      error: "Failed to create task via vibe-kanban MCP",
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Agent failed: ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      logs,
    };
  }
}

// CLI entry point for testing
if (import.meta.main) {
  const args = process.argv.slice(2);
  const projectIdIdx = args.indexOf("--project");
  let projectId: string | undefined;

  if (projectIdIdx !== -1 && args[projectIdIdx + 1]) {
    projectId = args[projectIdIdx + 1];
    args.splice(projectIdIdx, 2);
  }

  const feedback = args.join(" ");
  if (!feedback) {
    console.error("Usage: bun run src/agent-feedback.ts [--project <id>] <feedback message>");
    process.exit(1);
  }

  const result = await runFeedbackAgent(feedback, "CLI", projectId);
  console.log("\n--- Result ---");
  console.log(JSON.stringify(result, null, 2));
}
