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

/**
 * Create a PR via vibe-kanban API
 */
async function createPrViaApi(attemptId: string, title: string): Promise<string | undefined> {
  const port = await getVibeKanbanPort();
  try {
    // First, get repo_id from task-attempts endpoint
    const attemptsResponse = await fetch(`http://localhost:${port}/api/task-attempts?id=${attemptId}`);
    if (!attemptsResponse.ok) {
      console.log(`[task-monitor] Failed to fetch attempt ${attemptId}`);
      return undefined;
    }
    const attemptsData = (await attemptsResponse.json()) as { success: boolean; data: Array<{ repo_id: string }> };
    if (!attemptsData.success || !attemptsData.data[0]?.repo_id) {
      console.log(`[task-monitor] No repo_id found for attempt ${attemptId}`);
      return undefined;
    }
    const repoId = attemptsData.data[0].repo_id;

    // Create PR via API
    const response = await fetch(`http://localhost:${port}/api/task-attempts/${attemptId}/pr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, repo_id: repoId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[task-monitor] PR creation failed: ${errorText}`);
      return undefined;
    }

    const data = (await response.json()) as { success: boolean; data: string };
    if (data.success && data.data) {
      console.log(`[task-monitor] PR created: ${data.data}`);
      return data.data;
    }
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
export function watchTask(taskId: string, channelId: string, messageId: string): void {
  registerTaskNotification(taskId, channelId, messageId);
  console.log(`[task-monitor] Registered task ${taskId} for notification`);
}

/**
 * Check all pending tasks and return those that have completed.
 * This is the main function called periodically by the bot.
 */
export async function checkPendingTasks(): Promise<TaskCompletionInfo[]> {
  const pending = getPendingTaskNotifications();
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
        // First, try to create PR via vibe-kanban API
        prUrl = await createPrViaApi(latestAttempt.id, task.title);

        // If API fails, check if PR already exists via gh CLI
        if (!prUrl) {
          const workdir = `${latestAttempt.container_ref}/${latestAttempt.agent_working_dir}`;
          prUrl = await getPrUrlForBranch(workdir, latestAttempt.branch);
        }
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
      markTaskNotified(notification.task_id);
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

      markTaskNotified(notification.task_id);
      console.log(`[task-monitor] Task ${notification.task_id} failed`);
    }
    // Still in progress - do nothing, will check again next cycle
  }

  return completed;
}

/**
 * Cleanup old notified tasks from DB
 */
export function cleanup(daysOld: number = 7): void {
  cleanupOldTaskNotifications(daysOld);
}
