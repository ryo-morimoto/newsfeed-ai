import { test, expect, describe, beforeEach, afterEach, mock } from "bun:test";
import { watchTask, checkPendingTasks, cleanup } from "./task-monitor";
import {
  ensureDb,
  closeDb,
  getPendingTaskNotifications,
  getTaskNotification,
  registerTaskNotification,
  markTaskNotified,
} from "./db";
import { join } from "path";
import { tmpdir } from "os";
import { unlinkSync, existsSync } from "fs";

const TEST_DB_PATH = join(tmpdir(), "test-task-monitor.db");

// Save original fetch
const originalFetch = globalThis.fetch;

// Helper to create typed fetch mock (Bun's fetch has preconnect property)
function mockFetch(fn: (url: string) => Promise<Response>): typeof fetch {
  return mock(fn) as unknown as typeof fetch;
}

describe("task-monitor (stateless)", () => {
  beforeEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    await ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Also clean up WAL files
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  });

  test("watchTask registers task in database", async () => {
    await watchTask("task-1", "channel-123", "message-456");

    const notification = await getTaskNotification("task-1");
    expect(notification).not.toBeNull();
    expect(notification?.task_id).toBe("task-1");
    expect(notification?.channel_id).toBe("channel-123");
    expect(notification?.message_id).toBe("message-456");
    expect(notification?.notified_at).toBeNull();
  });

  test("getPendingTaskNotifications returns only unnotified tasks", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");
    await registerTaskNotification("task-2", "ch-2", "msg-2");
    await registerTaskNotification("task-3", "ch-3", "msg-3");

    // Mark one as notified
    await markTaskNotified("task-2");

    const pending = await getPendingTaskNotifications();
    expect(pending.length).toBe(2);
    expect(pending.map((p) => p.task_id)).toContain("task-1");
    expect(pending.map((p) => p.task_id)).toContain("task-3");
    expect(pending.map((p) => p.task_id)).not.toContain("task-2");
  });

  test("watchTask updates existing task notification", async () => {
    await watchTask("task-1", "channel-old", "message-old");
    await watchTask("task-1", "channel-new", "message-new");

    const pending = await getPendingTaskNotifications();
    expect(pending.length).toBe(1);

    const notification = await getTaskNotification("task-1");
    expect(notification?.channel_id).toBe("channel-new");
    expect(notification?.message_id).toBe("message-new");
  });

  test("markTaskNotified sets notified_at timestamp", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    const before = await getTaskNotification("task-1");
    expect(before?.notified_at).toBeNull();

    await markTaskNotified("task-1");

    const after = await getTaskNotification("task-1");
    expect(after?.notified_at).not.toBeNull();
  });

  test("checkPendingTasks returns empty array when no pending tasks", async () => {
    const result = await checkPendingTasks();
    expect(result).toEqual([]);
  });

  test("cleanup function works without error", async () => {
    // Register some tasks
    await registerTaskNotification("old-task", "ch-1", "msg-1");
    await markTaskNotified("old-task");

    // Should not throw
    await cleanup(7);
  });
});

describe("task-monitor with mocked API", () => {
  beforeEach(async () => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    await ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    // Also clean up WAL files
    const walPath = TEST_DB_PATH + "-wal";
    const shmPath = TEST_DB_PATH + "-shm";
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  });

  test("checkPendingTasks handles task not found in API", async () => {
    // Register a task
    await registerTaskNotification("missing-task", "ch-1", "msg-1");

    // Mock fetch to return 404
    globalThis.fetch = mockFetch(async (url: string) => {
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    // Task should be skipped (not in result)
    expect(result).toEqual([]);
  });

  test("checkPendingTasks handles API returning not success", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    // Mock fetch to return success: false
    globalThis.fetch = mockFetch(async (url: string) => {
      return new Response(JSON.stringify({ success: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const result = await checkPendingTasks();
    expect(result).toEqual([]);
  });

  test("checkPendingTasks detects in-progress task", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    // Mock fetch to return in-progress task
    globalThis.fetch = mockFetch(async (url: string) => {
      if (url.includes("/api/tasks/")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-1",
              status: "doing",
              title: "Test Task",
              has_in_progress_attempt: true,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    // Task is still in progress, should not be in result
    expect(result).toEqual([]);

    // Task should still be pending
    const pending = await getPendingTaskNotifications();
    expect(pending.length).toBe(1);
  });

  test("checkPendingTasks detects failed task", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    // Mock fetch to return failed task
    globalThis.fetch = mockFetch(async (url: string) => {
      if (url.includes("/api/tasks/")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-1",
              status: "doing",
              title: "Failed Task",
              has_in_progress_attempt: false,
              last_attempt_failed: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    expect(result.length).toBe(1);
    expect(result[0].status).toBe("failed");
    expect(result[0].taskId).toBe("task-1");
    expect(result[0].error).toBe("Task attempt failed");

    // Task should be marked as notified
    const notification = await getTaskNotification("task-1");
    expect(notification?.notified_at).not.toBeNull();
  });

  test("checkPendingTasks detects completed task (inreview status)", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    // Mock fetch to return completed task
    globalThis.fetch = mockFetch(async (url: string) => {
      if (url.includes("/api/tasks/task-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-1",
              status: "inreview",
              title: "Completed Task",
              has_in_progress_attempt: false,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/task-attempts")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    expect(result.length).toBe(1);
    expect(result[0].status).toBe("completed");
    expect(result[0].title).toBe("Completed Task");
  });

  test("checkPendingTasks detects completed task (done status)", async () => {
    await registerTaskNotification("task-2", "ch-2", "msg-2");

    globalThis.fetch = mockFetch(async (url: string) => {
      if (url.includes("/api/tasks/task-2")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-2",
              status: "done",
              title: "Done Task",
              has_in_progress_attempt: false,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/task-attempts")) {
        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    expect(result.length).toBe(1);
    expect(result[0].status).toBe("completed");
  });

  test("checkPendingTasks handles fetch error gracefully", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    // Mock fetch to throw
    globalThis.fetch = mockFetch(async (_url: string) => {
      throw new Error("Network error");
    });

    const result = await checkPendingTasks();

    // Should handle error and skip task
    expect(result).toEqual([]);
  });

  test("checkPendingTasks handles task-attempts API error", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");

    globalThis.fetch = mockFetch(async (url: string) => {
      if (url.includes("/api/tasks/task-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-1",
              status: "done",
              title: "Done Task",
              has_in_progress_attempt: false,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/task-attempts")) {
        return new Response(null, { status: 500 });
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    // Should still mark as completed even if attempts fail
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("completed");
    expect(result[0].branch).toBeUndefined();
  });

  test("checkPendingTasks processes multiple tasks", async () => {
    await registerTaskNotification("task-1", "ch-1", "msg-1");
    await registerTaskNotification("task-2", "ch-2", "msg-2");
    await registerTaskNotification("task-3", "ch-3", "msg-3");

    globalThis.fetch = mockFetch(async (url: string) => {
      // task-1: in progress
      if (url.includes("/api/tasks/task-1")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-1",
              status: "doing",
              title: "In Progress Task",
              has_in_progress_attempt: true,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // task-2: done
      if (url.includes("/api/tasks/task-2")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-2",
              status: "done",
              title: "Done Task",
              has_in_progress_attempt: false,
              last_attempt_failed: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      // task-3: failed
      if (url.includes("/api/tasks/task-3")) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              id: "task-3",
              status: "doing",
              title: "Failed Task",
              has_in_progress_attempt: false,
              last_attempt_failed: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/api/task-attempts")) {
        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(null, { status: 404 });
    });

    const result = await checkPendingTasks();

    // Should have task-2 (done) and task-3 (failed)
    expect(result.length).toBe(2);
    expect(result.find((r) => r.taskId === "task-2")?.status).toBe("completed");
    expect(result.find((r) => r.taskId === "task-3")?.status).toBe("failed");

    // task-1 should still be pending
    const pending = await getPendingTaskNotifications();
    expect(pending.length).toBe(1);
    expect(pending[0].task_id).toBe("task-1");
  });
});
