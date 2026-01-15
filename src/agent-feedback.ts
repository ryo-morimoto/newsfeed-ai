import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export interface FeedbackResult {
  success: boolean;
  prUrl?: string;
  branchName?: string;
  error?: string;
  logs: string[];
}

export function generateSlug(feedback: string): string {
  const words = feedback
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);

  const timestamp = Date.now().toString(36).slice(-4);
  return `feedback/${words.join("-")}-${timestamp}`;
}

export async function runFeedbackAgent(
  feedback: string,
  requestedBy: string
): Promise<FeedbackResult> {
  const logs: string[] = [];
  const branchName = generateSlug(feedback);

  const log = (msg: string) => {
    console.log(`[agent] ${msg}`);
    logs.push(msg);
  };

  log(`Starting agent for feedback: "${feedback}"`);
  log(`Requested by: ${requestedBy}`);
  log(`Branch: ${branchName}`);

  const prompt = `
You are implementing a feature request for the newsfeed-ai project.

## Feedback/Request
${feedback}

## Instructions
1. First, understand the request and explore the codebase if needed
2. Create a new git branch: ${branchName}
3. Implement the requested changes
4. Run tests to make sure nothing is broken: bun test
5. Commit your changes with a descriptive message
6. Create a PR using: gh pr create --title "<descriptive title>" --body "<summary of changes>"

## Important
- Follow the existing code patterns in this project
- Use Bun APIs (not Node.js equivalents)
- Write tests if adding new functionality
- Keep changes minimal and focused

After creating the PR, output the PR URL so it can be shared.
`.trim();

  try {
    let prUrl: string | undefined;
    let lastResult: string | undefined;

    for await (const message of query({
      prompt,
      options: {
        cwd: process.cwd(),
        allowedTools: [
          // File operations
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          // Execution
          "Bash",
          "Task",
          // Web (for docs/research)
          "WebSearch",
          "WebFetch",
          // Todo tracking
          "TodoRead",
          "TodoWrite",
        ],
        permissionMode: "acceptEdits",
        settingSources: ["project"],
      },
    })) {
      const msg = message as SDKMessage;

      if (msg.type === "assistant" && "content" in msg) {
        const content = msg.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text") {
              lastResult = block.text;
              // Look for PR URL in output
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

      if ("result" in msg && typeof msg.result === "string") {
        lastResult = msg.result;
        const prMatch = msg.result.match(
          /https:\/\/github\.com\/[^\s]+\/pull\/\d+/
        );
        if (prMatch) {
          prUrl = prMatch[0];
          log(`PR created: ${prUrl}`);
        }
      }
    }

    if (prUrl) {
      log("Agent completed successfully");
      return {
        success: true,
        prUrl,
        branchName,
        logs,
      };
    }

    log("Agent completed but no PR URL found");
    return {
      success: false,
      branchName,
      error: "No PR URL found in agent output",
      logs,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Agent failed: ${errorMsg}`);
    return {
      success: false,
      branchName,
      error: errorMsg,
      logs,
    };
  }
}

// CLI entry point for testing
if (import.meta.main) {
  const feedback = process.argv.slice(2).join(" ");
  if (!feedback) {
    console.error("Usage: bun run src/agent-feedback.ts <feedback message>");
    process.exit(1);
  }

  const result = await runFeedbackAgent(feedback, "CLI");
  console.log("\n--- Result ---");
  console.log(JSON.stringify(result, null, 2));
}
