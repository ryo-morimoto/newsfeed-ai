# Cloudflare Workers Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy apps/web to Cloudflare Workers with search functionality using Turso for index storage.

**Architecture:** TanStack Start with @tanstack/start-cloudflare adapter. Orama search index pre-built by bot and stored in Turso. Workers loads index on cold start and caches in memory.

**Tech Stack:** TanStack Start, Cloudflare Workers, Turso (LibSQL), Orama, Wrangler, GitHub Actions

---

## Task 1: Add search_index Table Migration

**Files:**
- Create: `packages/core/src/db/migrations/003_search_index.sql`
- Modify: `packages/core/src/db/client.ts`

**Step 1: Create migration SQL file**

```sql
-- packages/core/src/db/migrations/003_search_index.sql
CREATE TABLE IF NOT EXISTS search_index (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data BLOB NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

**Step 2: Add migration to client.ts**

In `packages/core/src/db/client.ts`, add the search_index table creation after existing tables:

```typescript
// After existing CREATE TABLE statements, add:
await client.execute(`
  CREATE TABLE IF NOT EXISTS search_index (
    id TEXT PRIMARY KEY DEFAULT 'default',
    data BLOB NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);
```

**Step 3: Run to verify migration works**

```bash
cd apps/bot && bun run src/main.ts --dry-run
```

Expected: No errors, table created if not exists.

**Step 4: Commit**

```bash
git add packages/core/src/db/
git commit -m "feat(db): add search_index table for Orama persistence"
```

---

## Task 2: Add persistIndexToDb Function to Core

**Files:**
- Modify: `packages/core/src/search/orama.ts`
- Modify: `packages/core/src/search/index.ts`

**Step 1: Add persistIndexToDb function**

Add to `packages/core/src/search/orama.ts` after `persistIndex` function:

```typescript
/**
 * Persist the search index to database (Turso)
 */
export async function persistIndexToDb(
  db: { execute: (args: { sql: string; args: unknown[] }) => Promise<unknown> },
  indexId: string = "default"
): Promise<void> {
  if (!oramaDb) {
    console.warn("[search] No index to persist to db");
    return;
  }

  try {
    const data = await persist(oramaDb, "binary");
    await db.execute({
      sql: `INSERT OR REPLACE INTO search_index (id, data, updated_at)
            VALUES (?, ?, datetime('now'))`,
      args: [indexId, new Uint8Array(data as ArrayBuffer)],
    });
    console.log(`[search] Index persisted to database with id: ${indexId}`);
  } catch (error) {
    console.error("[search] Failed to persist index to db:", error);
  }
}

/**
 * Restore the search index from database (Turso)
 */
export async function restoreIndexFromDb(
  db: { execute: (args: { sql: string; args: unknown[] }) => Promise<{ rows: { data: ArrayBuffer }[] }> },
  indexId: string = "default"
): Promise<boolean> {
  try {
    const result = await db.execute({
      sql: "SELECT data FROM search_index WHERE id = ?",
      args: [indexId],
    });

    if (result.rows.length === 0) {
      console.log("[search] No index found in database");
      return false;
    }

    const data = result.rows[0].data;
    oramaDb = (await restore("binary", new Uint8Array(data as ArrayBuffer))) as OramaDb;
    console.log("[search] Index restored from database");
    return true;
  } catch (error) {
    console.error("[search] Failed to restore index from db:", error);
    return false;
  }
}
```

**Step 2: Export from index.ts**

Add to `packages/core/src/search/index.ts` exports:

```typescript
export { persistIndexToDb, restoreIndexFromDb } from "./orama";
```

**Step 3: Verify build**

```bash
cd packages/core && bun run build
```

Expected: Build succeeds without errors.

**Step 4: Commit**

```bash
git add packages/core/src/search/
git commit -m "feat(search): add Turso persistence functions for Orama index"
```

---

## Task 3: Update Bot to Save Index to Turso

**Files:**
- Modify: `apps/bot/src/search/orama-index.ts`

**Step 1: Import and use persistIndexToDb**

Update `apps/bot/src/search/orama-index.ts` to save index to Turso after persisting to file:

```typescript
import { search, db as coreDb } from "@newsfeed-ai/core";

// Add after existing persistIndex call in the appropriate function:
export async function persistSearchIndex(): Promise<void> {
  // Persist to file (existing behavior)
  await search.persistIndex(searchConfig);

  // Also persist to Turso for Workers
  const db = await coreDb.getDb();
  await search.persistIndexToDb(db);
}
```

**Step 2: Find and update where persistIndex is called**

Search for `persistIndex` calls and replace with `persistSearchIndex()` or add Turso persistence alongside.

**Step 3: Test locally**

```bash
cd apps/bot && bun run src/main.ts --dry-run
```

Expected: Index persisted message for both file and database.

**Step 4: Commit**

```bash
git add apps/bot/src/search/
git commit -m "feat(bot): persist Orama index to Turso for Workers"
```

---

## Task 4: Create Turso FileSystem Adapter for Web

**Files:**
- Create: `apps/web/src/adapters/turso-fs.ts`

**Step 1: Create the adapter file**

```typescript
// apps/web/src/adapters/turso-fs.ts
import type { FileSystem } from "@newsfeed-ai/core";
import { getDb } from "../lib/db";

/**
 * FileSystem adapter that uses Turso for storage
 * Used by Cloudflare Workers where node:fs is not available
 */
export const tursoFileSystem: FileSystem = {
  async exists(path: string): Promise<boolean> {
    try {
      const db = getDb();
      const result = await db.execute({
        sql: "SELECT 1 FROM search_index WHERE id = ?",
        args: [path],
      });
      return result.rows.length > 0;
    } catch {
      return false;
    }
  },

  async read(path: string): Promise<ArrayBuffer> {
    const db = getDb();
    const result = await db.execute({
      sql: "SELECT data FROM search_index WHERE id = ?",
      args: [path],
    });
    if (result.rows.length === 0) {
      throw new Error(`Index not found: ${path}`);
    }
    const data = result.rows[0].data;
    if (data instanceof ArrayBuffer) {
      return data;
    }
    // Handle Uint8Array or Buffer
    return (data as Uint8Array).buffer;
  },

  async write(path: string, data: ArrayBuffer): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: `INSERT OR REPLACE INTO search_index (id, data, updated_at)
            VALUES (?, ?, datetime('now'))`,
      args: [path, new Uint8Array(data)],
    });
  },

  async delete(path: string): Promise<void> {
    const db = getDb();
    await db.execute({
      sql: "DELETE FROM search_index WHERE id = ?",
      args: [path],
    });
  },
};
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add apps/web/src/adapters/turso-fs.ts
git commit -m "feat(web): add Turso FileSystem adapter for Workers"
```

---

## Task 5: Update Web Search to Use Turso Adapter on Workers

**Files:**
- Modify: `apps/web/src/lib/search.ts`

**Step 1: Add runtime detection and adapter switching**

```typescript
// apps/web/src/lib/search.ts
import { search, paths, type Article } from "@newsfeed-ai/core";
export type { SearchResult } from "@newsfeed-ai/core/search";
import { getAllArticles, ensureInitialized as ensureDbInitialized } from "./db";

// Detect if running on Cloudflare Workers
const isCloudflareWorkers = typeof globalThis.caches !== "undefined" &&
  typeof (globalThis as any).WebSocketPair !== "undefined";

// Lazy load the appropriate adapter
async function getFileSystem() {
  if (isCloudflareWorkers) {
    const { tursoFileSystem } = await import("../adapters/turso-fs");
    return tursoFileSystem;
  } else {
    const { nodeFileSystem } = await import("../adapters/fs");
    return nodeFileSystem;
  }
}

// Initialization tracking
let initialized = false;
let searchConfig: search.SearchConfig | null = null;

async function getSearchConfig(): Promise<search.SearchConfig> {
  if (!searchConfig) {
    const fs = await getFileSystem();
    searchConfig = {
      indexPath: isCloudflareWorkers ? "default" : paths.searchIndex,
      fs,
    };
  }
  return searchConfig;
}

/**
 * Ensure search service is initialized
 */
async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  await ensureDbInitialized();
  const config = await getSearchConfig();
  await search.initSearchService(config, getAllArticles);
  initialized = true;
}

/**
 * Search articles using Orama hybrid search (FTS + Vector) with fulltext fallback
 */
export async function searchArticles(
  query: string,
  limit: number = 20
): Promise<search.SearchResult[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  await ensureInitialized();
  return search.searchArticles({ query, limit }, getAllArticles);
}

/**
 * Rebuild index from articles
 */
export async function rebuildIndex(articles: Article[]): Promise<void> {
  console.log("[web-search] Rebuilding index...");
  const config = await getSearchConfig();
  await search.rebuildSearchIndex(config, async () => articles);
}

/**
 * Persist index to file
 */
export async function persistIndex(): Promise<void> {
  await search.shutdownSearchService();
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/web && bun run typecheck
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add apps/web/src/lib/search.ts
git commit -m "feat(web): add runtime detection for Turso adapter on Workers"
```

---

## Task 6: Install Cloudflare Workers Dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install dependencies**

```bash
cd apps/web
bun add -d wrangler @cloudflare/workers-types
```

**Step 2: Add scripts to package.json**

Add to `apps/web/package.json` scripts section:

```json
{
  "scripts": {
    "deploy": "wrangler deploy",
    "deploy:production": "wrangler deploy --env production",
    "dev:worker": "wrangler dev"
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/package.json bun.lockb
git commit -m "chore(web): add Cloudflare Workers dependencies"
```

---

## Task 7: Create wrangler.toml Configuration

**Files:**
- Create: `apps/web/wrangler.toml`

**Step 1: Create wrangler.toml**

```toml
# apps/web/wrangler.toml
name = "newsfeed-ai-web"
compatibility_date = "2026-01-22"
compatibility_flags = ["nodejs_compat"]

main = "./dist/server/index.js"

[placement]
mode = "smart"

[assets]
directory = "./dist/client/"
binding = "ASSETS"

# Environment variables are set via Cloudflare Dashboard or wrangler secret

# Production environment
[env.production]
routes = [
  { pattern = "newsfeed.ryo-o.dev", custom_domain = true }
]
```

**Step 2: Commit**

```bash
git add apps/web/wrangler.toml
git commit -m "feat(web): add Cloudflare Workers configuration"
```

---

## Task 8: Update Vite Config for Cloudflare

**Files:**
- Modify: `apps/web/vite.config.ts`

**Step 1: Check TanStack Start Cloudflare support**

First, check if @tanstack/start-cloudflare exists or if target option is used:

```bash
bun add -d @tanstack/start-cloudflare 2>/dev/null || echo "Package not found, check TanStack docs"
```

**Step 2: Update vite.config.ts**

The TanStack Start configuration may need adjustment. Check current config and update target if supported:

```typescript
// apps/web/vite.config.ts
// Add or modify the tanstackStart plugin configuration:
tanstackStart({
  // If target option is supported:
  target: "cloudflare-workers",
})
```

Note: This step may require checking TanStack Start documentation for exact Cloudflare Workers configuration.

**Step 3: Build and verify**

```bash
cd apps/web && bun run build
```

Expected: Build succeeds with server output in dist/server/.

**Step 4: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "feat(web): configure Vite for Cloudflare Workers build"
```

---

## Task 9: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/deploy-web.yml`

**Step 1: Create workflow file**

```yaml
# .github/workflows/deploy-web.yml
name: Deploy Web to Cloudflare Workers

on:
  push:
    branches:
      - main
    paths:
      - 'apps/web/**'
      - 'packages/core/**'
      - '.github/workflows/deploy-web.yml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build web app
        run: bun run build
        working-directory: apps/web

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          workingDirectory: apps/web
          command: deploy --env production
```

**Step 2: Commit**

```bash
git add .github/workflows/deploy-web.yml
git commit -m "ci: add GitHub Actions workflow for Cloudflare Workers deployment"
```

---

## Task 10: Test Local Workers Development

**Step 1: Set environment variables**

```bash
cd apps/web
echo "TURSO_DATABASE_URL=your-turso-url" >> .dev.vars
echo "TURSO_AUTH_TOKEN=your-turso-token" >> .dev.vars
```

**Step 2: Build the app**

```bash
bun run build
```

**Step 3: Run local Workers dev server**

```bash
bun run dev:worker
```

**Step 4: Test endpoints**

- Open http://localhost:8787
- Verify article list loads
- Test search functionality

Expected: App works locally with Workers runtime.

**Step 5: Commit .dev.vars to gitignore if not already**

```bash
echo ".dev.vars" >> .gitignore
git add .gitignore
git commit -m "chore: ignore .dev.vars for local Workers development"
```

---

## Task 11: Deploy to Production

**Step 1: Configure Cloudflare secrets**

```bash
cd apps/web
bunx wrangler secret put TURSO_DATABASE_URL
# Enter your Turso database URL when prompted

bunx wrangler secret put TURSO_AUTH_TOKEN
# Enter your Turso auth token when prompted
```

**Step 2: Deploy to production**

```bash
bun run deploy:production
```

**Step 3: Configure custom domain**

In Cloudflare Dashboard:
1. Go to Workers & Pages → newsfeed-ai-web
2. Settings → Triggers → Custom Domains
3. Add `newsfeed.ryo-o.dev`

**Step 4: Verify production deployment**

- Open https://newsfeed.ryo-o.dev
- Verify article list loads
- Test search functionality

Expected: App works on production URL.

---

## Task 12: Update Bot to Trigger Index Rebuild

**Files:**
- Modify: `apps/bot/src/main.ts`

**Step 1: Ensure index is saved to Turso after newsfeed run**

After the newsfeed pipeline completes successfully, ensure the search index is persisted to Turso:

```typescript
// At the end of runNewsfeed() function, add:
import { persistSearchIndex } from "./search/orama-index";

// After all articles are processed:
await persistSearchIndex();
console.log("[newsfeed] Search index saved to Turso for Workers");
```

**Step 2: Test by running newsfeed**

```bash
cd apps/bot && bun run src/main.ts --dry-run
```

Expected: "Search index saved to Turso for Workers" message appears.

**Step 3: Commit**

```bash
git add apps/bot/src/
git commit -m "feat(bot): save search index to Turso after newsfeed run"
```

---

## Summary

After completing all tasks:

1. **Database**: search_index table added to Turso
2. **Bot**: Saves Orama index to Turso after each newsfeed run
3. **Web**: Uses Turso adapter on Workers, node:fs adapter locally
4. **CI/CD**: GitHub Actions auto-deploys on push to main
5. **Production**: App running at https://newsfeed.ryo-o.dev

**GitHub Secrets to configure:**
- `CLOUDFLARE_API_TOKEN` - Create at Cloudflare Dashboard → My Profile → API Tokens

**Cloudflare Secrets to configure:**
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
