import { test, expect, describe, beforeEach, afterEach } from "bun:test";
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
});
