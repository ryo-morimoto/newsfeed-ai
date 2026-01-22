import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { join } from "path";
import {
  getProjectRoot,
  getDataDir,
  getConfigDir,
  paths,
  resetProjectRoot,
} from "./paths";

describe("paths module", () => {
  // Save original env vars
  const originalProjectRoot = process.env.PROJECT_ROOT;
  const originalDataDir = process.env.DATA_DIR;
  const originalConfigDir = process.env.CONFIG_DIR;

  beforeEach(() => {
    resetProjectRoot();
    // Clear env vars for clean tests
    delete process.env.PROJECT_ROOT;
    delete process.env.DATA_DIR;
    delete process.env.CONFIG_DIR;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalProjectRoot) {
      process.env.PROJECT_ROOT = originalProjectRoot;
    } else {
      delete process.env.PROJECT_ROOT;
    }
    if (originalDataDir) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
    if (originalConfigDir) {
      process.env.CONFIG_DIR = originalConfigDir;
    } else {
      delete process.env.CONFIG_DIR;
    }
    resetProjectRoot();
  });

  describe("getProjectRoot", () => {
    test("returns PROJECT_ROOT env var when set", () => {
      process.env.PROJECT_ROOT = "/custom/path";
      const root = getProjectRoot();
      expect(root).toBe("/custom/path");
    });

    test("caches the result", () => {
      process.env.PROJECT_ROOT = "/first/path";
      const first = getProjectRoot();
      process.env.PROJECT_ROOT = "/second/path";
      const second = getProjectRoot();
      expect(first).toBe(second);
      expect(first).toBe("/first/path");
    });

    test("auto-detects monorepo root when env not set", () => {
      // Should find the monorepo root from cwd
      const root = getProjectRoot();
      // The root should contain a package.json with workspaces
      expect(root).toContain("newsfeed-ai");
    });
  });

  describe("getDataDir", () => {
    test("returns DATA_DIR env var when set", () => {
      process.env.DATA_DIR = "/custom/data";
      const dataDir = getDataDir();
      expect(dataDir).toBe("/custom/data");
    });

    test("defaults to <project-root>/data", () => {
      process.env.PROJECT_ROOT = "/test/root";
      const dataDir = getDataDir();
      expect(dataDir).toBe("/test/root/data");
    });
  });

  describe("getConfigDir", () => {
    test("returns CONFIG_DIR env var when set", () => {
      process.env.CONFIG_DIR = "/custom/config";
      const configDir = getConfigDir();
      expect(configDir).toBe("/custom/config");
    });

    test("defaults to <project-root>/config", () => {
      process.env.PROJECT_ROOT = "/test/root";
      const configDir = getConfigDir();
      expect(configDir).toBe("/test/root/config");
    });
  });

  describe("paths object", () => {
    test("root returns project root", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.root).toBe("/test/root");
    });

    test("data returns data directory", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.data).toBe("/test/root/data");
    });

    test("config returns config directory", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.config).toBe("/test/root/config");
    });

    test("database returns database path", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.database).toBe(join("/test/root/data", "history.db"));
    });

    test("searchIndex returns search index path", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.searchIndex).toBe(join("/test/root/data", "orama-index.msp"));
    });

    test("sourcesConfig returns sources config path", () => {
      process.env.PROJECT_ROOT = "/test/root";
      expect(paths.sourcesConfig).toBe(join("/test/root/config", "sources.yaml"));
    });
  });

  describe("resetProjectRoot", () => {
    test("clears the cached root", () => {
      process.env.PROJECT_ROOT = "/first/path";
      getProjectRoot();

      resetProjectRoot();

      process.env.PROJECT_ROOT = "/second/path";
      const root = getProjectRoot();
      expect(root).toBe("/second/path");
    });
  });
});
