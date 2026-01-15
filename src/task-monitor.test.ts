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
import { unlinkSync, existsSync } from "fs";

const TEST_DB_PATH = join(import.meta.dir, "..", "data", "test-task-monitor.db");

describe("task-monitor (stateless)", () => {
  beforeEach(() => {
    // Clean up test database
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
    ensureDb(TEST_DB_PATH);
  });

  afterEach(() => {
    closeDb();
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  });

  test("watchTask registers task in database", () => {
    watchTask("task-1", "channel-123", "message-456");

    const notification = getTaskNotification("task-1");
    expect(notification).not.toBeNull();
    expect(notification?.task_id).toBe("task-1");
    expect(notification?.channel_id).toBe("channel-123");
    expect(notification?.message_id).toBe("message-456");
    expect(notification?.notified_at).toBeNull();
  });

  test("getPendingTaskNotifications returns only unnotified tasks", () => {
    registerTaskNotification("task-1", "ch-1", "msg-1");
    registerTaskNotification("task-2", "ch-2", "msg-2");
    registerTaskNotification("task-3", "ch-3", "msg-3");

    // Mark one as notified
    markTaskNotified("task-2");

    const pending = getPendingTaskNotifications();
    expect(pending.length).toBe(2);
    expect(pending.map((p) => p.task_id)).toContain("task-1");
    expect(pending.map((p) => p.task_id)).toContain("task-3");
    expect(pending.map((p) => p.task_id)).not.toContain("task-2");
  });

  test("watchTask updates existing task notification", () => {
    watchTask("task-1", "channel-old", "message-old");
    watchTask("task-1", "channel-new", "message-new");

    const pending = getPendingTaskNotifications();
    expect(pending.length).toBe(1);

    const notification = getTaskNotification("task-1");
    expect(notification?.channel_id).toBe("channel-new");
    expect(notification?.message_id).toBe("message-new");
  });

  test("markTaskNotified sets notified_at timestamp", () => {
    registerTaskNotification("task-1", "ch-1", "msg-1");

    const before = getTaskNotification("task-1");
    expect(before?.notified_at).toBeNull();

    markTaskNotified("task-1");

    const after = getTaskNotification("task-1");
    expect(after?.notified_at).not.toBeNull();
  });

  test("checkPendingTasks returns empty array when no pending tasks", async () => {
    const result = await checkPendingTasks();
    expect(result).toEqual([]);
  });
});
