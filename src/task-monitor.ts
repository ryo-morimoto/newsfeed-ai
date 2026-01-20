/**
 * Task Monitor - Stateless polling of vibe-kanban API to detect task completion
 *
 * Uses DB to track which tasks need notifications, so bot restarts don't lose state.
 */

import {
  getPendingTaskNotifications,
  markTaskNotified,
  registerTaskNotification,
  cleanupOldTaskNotifications,
} from "./db";

const VK_PORT_FILE = "/tmp/vibe-kanban/vibe-kanban.port";
const GROQ_API_KEY = process.env.GROQ_API_KEY;

interface TaskStatus {
  id: string;
  status: string;
  title: string;
  has_in_progress_attempt: boolean;
  last_attempt_failed: boolean;
}

interface TaskAttempt {
  id: string;
  task_id: string;
  branch: string;
  container_ref: string;
  agent_working_dir: string;
}

export interface TaskCompletionInfo {
  taskId: string;
  channelId: string;
  messageId: string;
  status: "completed" | "failed";
  title?: string;
  prUrl?: string;
  branch?: string;
  error?: string;
}

/**
 * Read the vibe-kanban port from the port file.
 */
async function getVibeKanbanPort(): Promise<string> {
  try {
    const portStr = (await Bun.file(VK_PORT_FILE).text()).trim();
    return portStr || "8000";
  } catch {
    return "8000";
  }
}

/**
 * Fetch task status from vibe-kanban API
 */
async function fetchTaskStatus(taskId: string): Promise<TaskStatus | null> {
  const port = await getVibeKanbanPort();
  try {
    const response = await fetch(`http://localhost:${port}/api/tasks/${taskId}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: TaskStatus };
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

/**
 * Fetch task attempts from vibe-kanban API
 */
async function fetchTaskAttempts(taskId: string): Promise<TaskAttempt[]> {
  const port = await getVibeKanbanPort();
  try {
    const response = await fetch(`http://localhost:${port}/api/task-attempts?task_id=${taskId}`);
    if (!response.ok) return [];
    const data = (await response.json()) as { success: boolean; data: TaskAttempt[] };
    return data.success ? data.data : [];
  } catch {
    return [];
  }
}

/**
 * Get PR URL for a branch using gh CLI
 */
async function getPrUrlForBranch(workdir: string, branch: string): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(["gh", "pr", "view", branch, "--json", "url", "-q", ".url"], {
      cwd: workdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const url = output.trim();
    return url.startsWith("https://") ? url : undefined;
  } catch {
    return undefined;
  }
}

interface PrContent {
  title: string;
  description: string;
}

/**
 * Get git diff for a branch compared to main
 */
async function getGitDiff(workdir: string, branch: string): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "diff", "main...HEAD", "--stat"], {
      cwd: workdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const statOutput = await new Response(proc.stdout).text();

    // Also get a limited diff content
    const diffProc = Bun.spawn(["git", "diff", "main...HEAD", "--no-color"], {
      cwd: workdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const diffOutput = await new Response(diffProc.stdout).text();

    // Truncate diff to avoid token limits
    const truncatedDiff = diffOutput.length > 8000 ? diffOutput.slice(0, 8000) + "\n... (truncated)" : diffOutput;

    return `Files changed:\n${statOutput}\n\nDiff:\n${truncatedDiff}`;
  } catch {
    return "";
  }
}

/**
 * Get commit messages for a branch since main
 */
async function getCommitMessages(workdir: string): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "log", "main..HEAD", "--oneline"], {
      cwd: workdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    return output.trim();
  } catch {
    return "";
  }
}

/**
 * Generate PR title and description using LLM
 */
async function generatePrContent(
  originalRequest: string,
  diff: string,
  commits: string
): Promise<PrContent> {
  // Fallback if no API key
  if (!GROQ_API_KEY) {
    console.log("[task-monitor] No GROQ_API_KEY, using default PR content");
    return {
      title: originalRequest.slice(0, 72),
      description: originalRequest,
    };
  }

  const prompt = `あなたはPRレビュアーです。以下の情報からPRのtitleとdescriptionを生成してください。

## 元のリクエスト
${originalRequest}

## コミット一覧
${commits || "(なし)"}

## 変更差分
${diff || "(差分なし)"}

## 出力ルール
- titleは英語で50文字以内、何を変更したか簡潔に
- descriptionはMarkdownで以下の構成:
  - ## Summary: 変更内容を箇条書き3-5点
  - ## Changes: 主要な変更ファイルとその内容
  - ## Testing: どうテストするか（該当する場合）

JSON形式で出力:
{"title": "...", "description": "..."}`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!res.ok) {
      console.log(`[task-monitor] Groq API error: ${res.status}`);
      return { title: originalRequest.slice(0, 72), description: originalRequest };
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = data.choices[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content) as PrContent;
      console.log(`[task-monitor] Generated PR title: ${parsed.title}`);
      return parsed;
    } catch (parseError) {
      console.log(`[task-monitor] JSON parse error, using fallback`);
    }

    return { title: originalRequest.slice(0, 72), description: originalRequest };
  } catch (error) {
    console.error("[task-monitor] LLM generation failed:", error);
    return { title: originalRequest.slice(0, 72), description: originalRequest };
  }
}

/**
 * Push current branch to remote
 */
async function pushBranchToRemote(workdir: string, branch: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(["git", "push", "-u", "origin", branch], {
      cwd: workdir,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (proc.exitCode === 0) {
      console.log(`[task-monitor] Pushed branch ${branch} to remote`);
      return true;
    }

    // Already pushed is OK
    if (stderr.includes("Everything up-to-date")) {
      console.log(`[task-monitor] Branch ${branch} already up-to-date`);
      return true;
    }

    console.log(`[task-monitor] git push failed: ${stderr}`);
    return false;
  } catch (error) {
    console.error(`[task-monitor] Error pushing branch:`, error);
    return false;
  }
}

/**
 * Create a PR using gh CLI
 */
async function createPrWithGh(
  workdir: string,
  branch: string,
  title: string,
  description: string
): Promise<string | undefined> {
  try {
    // First push the branch to remote
    const pushed = await pushBranchToRemote(workdir, branch);
    if (!pushed) {
      console.log(`[task-monitor] Failed to push branch, cannot create PR`);
      return undefined;
    }

    const proc = Bun.spawn(
      ["gh", "pr", "create", "--title", title, "--body", description, "--base", "main"],
      {
        cwd: workdir,
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    const url = output.trim();
    if (url.startsWith("https://")) {
      console.log(`[task-monitor] PR created: ${url}`);
      return url;
    }

    // Check if PR already exists
    if (stderr.includes("already exists")) {
      console.log(`[task-monitor] PR already exists, fetching URL`);
      return await getPrUrlForBranch(workdir, "HEAD");
    }

    console.log(`[task-monitor] gh pr create failed: ${stderr}`);
    return undefined;
  } catch (error) {
    console.error(`[task-monitor] Error creating PR:`, error);
    return undefined;
  }
}

// === Public API ===

/**
 * Register a task for completion notification.
 * Call this when a task is started via feedback command.
 */
export async function watchTask(taskId: string, channelId: string, messageId: string): Promise<void> {
  await registerTaskNotification(taskId, channelId, messageId);
  console.log(`[task-monitor] Registered task ${taskId} for notification`);
}

/**
 * Check all pending tasks and return those that have completed.
 * This is the main function called periodically by the bot.
 */
export async function checkPendingTasks(): Promise<TaskCompletionInfo[]> {
  const pending = await getPendingTaskNotifications();
  if (pending.length === 0) return [];

  console.log(`[task-monitor] Checking ${pending.length} pending tasks...`);

  const completed: TaskCompletionInfo[] = [];

  for (const notification of pending) {
    const task = await fetchTaskStatus(notification.task_id);
    if (!task) {
      console.log(`[task-monitor] Task ${notification.task_id} not found, skipping`);
      continue;
    }

    // Check if task is completed (inreview or done)
    if (task.status === "inreview" || task.status === "done") {
      const attempts = await fetchTaskAttempts(notification.task_id);
      const latestAttempt = attempts[0];

      let prUrl: string | undefined;
      if (latestAttempt) {
        const workdir = `${latestAttempt.container_ref}/${latestAttempt.agent_working_dir}`;

        // Get diff and commits for LLM-generated PR content
        const diff = await getGitDiff(workdir, latestAttempt.branch);
        const commits = await getCommitMessages(workdir);
        const prContent = await generatePrContent(task.title, diff, commits);

        // Create PR with gh CLI
        prUrl = await createPrWithGh(workdir, latestAttempt.branch, prContent.title, prContent.description);
      }

      completed.push({
        taskId: notification.task_id,
        channelId: notification.channel_id,
        messageId: notification.message_id,
        status: "completed",
        title: task.title,
        prUrl,
        branch: latestAttempt?.branch,
      });

      // Mark as notified
      await markTaskNotified(notification.task_id);
      console.log(`[task-monitor] Task ${notification.task_id} completed, PR: ${prUrl || "none"}`);
    }
    // Check if task failed
    else if (task.last_attempt_failed && !task.has_in_progress_attempt) {
      completed.push({
        taskId: notification.task_id,
        channelId: notification.channel_id,
        messageId: notification.message_id,
        status: "failed",
        title: task.title,
        error: "Task attempt failed",
      });

      await markTaskNotified(notification.task_id);
      console.log(`[task-monitor] Task ${notification.task_id} failed`);
    }
    // Still in progress - do nothing, will check again next cycle
  }

  return completed;
}

/**
 * Cleanup old notified tasks from DB
 */
export async function cleanup(daysOld: number = 7): Promise<void> {
  await cleanupOldTaskNotifications(daysOld);
}
