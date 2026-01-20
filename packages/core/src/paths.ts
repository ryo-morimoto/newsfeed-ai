import { join, dirname } from "path";
import { existsSync, readFileSync } from "fs";

let cachedProjectRoot: string | null = null;

/**
 * Find the monorepo root by looking for package.json with "workspaces"
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;
  const root = dirname(dir);

  while (dir !== root) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces) {
          return dir;
        }
      } catch {
        // Continue searching
      }
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Get the project root directory.
 * Priority:
 * 1. PROJECT_ROOT environment variable
 * 2. Auto-detect by finding package.json with "workspaces"
 */
export function getProjectRoot(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  // 1. Check environment variable
  const envRoot = process.env.PROJECT_ROOT;
  if (envRoot) {
    cachedProjectRoot = envRoot;
    return envRoot;
  }

  // 2. Auto-detect from current working directory
  const detected = findProjectRoot(process.cwd());
  if (detected) {
    cachedProjectRoot = detected;
    return detected;
  }

  // Fallback to cwd
  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
}

/**
 * Get the data directory path
 */
export function getDataDir(): string {
  return process.env.DATA_DIR || join(getProjectRoot(), "data");
}

/**
 * Get the config directory path
 */
export function getConfigDir(): string {
  return process.env.CONFIG_DIR || join(getProjectRoot(), "config");
}

/**
 * Common paths used throughout the application
 */
export const paths = {
  get root() {
    return getProjectRoot();
  },
  get data() {
    return getDataDir();
  },
  get config() {
    return getConfigDir();
  },
  get database() {
    return join(getDataDir(), "history.db");
  },
  get searchIndex() {
    return join(getDataDir(), "orama-index.msp");
  },
  get sourcesConfig() {
    return join(getConfigDir(), "sources.yaml");
  },
};

/**
 * Reset cached project root (for testing)
 */
export function resetProjectRoot(): void {
  cachedProjectRoot = null;
}
