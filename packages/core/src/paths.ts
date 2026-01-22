import { join, dirname } from "path";
import { existsSync, readFileSync } from "fs";

let cachedProjectRoot: string | null = null;

/**
 * Find the monorepo root by looking for package.json with "workspaces"
 */
function findProjectRoot(startDir: string): string | null {
  let dir = startDir;

  // Loop until we reach the filesystem root (where dirname returns the same value)
  while (dir !== dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.workspaces) {
          return dir;
        }
      } catch (error) {
        // Log parse errors but continue searching parent directories
        const message = error instanceof Error ? error.message : String(error);
        console.debug(`[paths] Could not parse ${pkgPath}: ${message}`);
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

  // Fallback to cwd - warn as this may indicate misconfiguration
  console.warn("[paths] Could not detect monorepo root, falling back to cwd:", process.cwd());
  console.warn("[paths] Set PROJECT_ROOT environment variable for explicit configuration.");
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
