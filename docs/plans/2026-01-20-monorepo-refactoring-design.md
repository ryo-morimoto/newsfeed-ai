# Monorepo Refactoring Design

Date: 2026-01-20

## Overview

Refactor the project from flat structure to Bun workspace monorepo with shared packages.

## Current Issues

1. **Code Duplication**: `db.ts` and `search.ts` duplicated between `src/` and `web/src/lib/`
2. **Path Resolution**: Hard-coded relative paths (`join(__dirname, "..", "..", "..", "..")`)
3. **Runtime Differences**: `Bun.file()` vs `node:fs` implementations
4. **TensorFlow.js**: Native module bundling issues in Web SSR

## Target Structure

```
newsfeed-ai/
├── package.json                    # Workspace root
├── packages/
│   └── core/
│       ├── package.json            # @newsfeed-ai/core
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts            # Re-exports
│           ├── db/
│           │   ├── index.ts
│           │   ├── types.ts        # Article, PendingTaskNotification
│           │   ├── client.ts       # DB connection (config injection)
│           │   └── operations.ts   # CRUD operations
│           ├── search/
│           │   ├── index.ts
│           │   ├── types.ts        # SearchResult, FileSystem interface
│           │   ├── orama.ts        # Orama management (DI-ready)
│           │   └── service.ts      # Search service
│           └── config/
│               ├── index.ts
│               ├── types.ts        # Source, Config types
│               ├── categories.ts   # Unified emoji + color definitions
│               └── loader.ts       # YAML config loader
├── apps/
│   ├── bot/
│   │   ├── package.json            # @newsfeed-ai/bot
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── main.ts
│   │       ├── bot.ts
│   │       ├── adapters/
│   │       │   ├── fs.ts           # Bun.file wrapper
│   │       │   └── embeddings.ts   # TensorFlow.js wrapper
│   │       ├── discord/
│   │       ├── sources/
│   │       └── summarize/
│   └── web/
│       ├── package.json            # @newsfeed-ai/web
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── src/
│           ├── adapters/
│           │   └── fs.ts           # Node.js fs wrapper
│           ├── lib/
│           └── routes/
├── config/                         # YAML config files
├── data/                           # SQLite, Orama index
└── systemd/                        # Service files
```

## Key Design Decisions

### 1. Path Resolution - Config Injection

Instead of hard-coded relative paths, accept configuration:

```typescript
// packages/core/src/db/client.ts
export interface DbConfig {
  dbPath?: string;
  tursoUrl?: string;
  tursoToken?: string;
}

export function createDbClient(config: DbConfig = {}): Client {
  const tursoUrl = config.tursoUrl || process.env.TURSO_DATABASE_URL;
  const tursoToken = config.tursoToken || process.env.TURSO_AUTH_TOKEN;

  if (tursoUrl && tursoToken) {
    return createClient({ url: tursoUrl, authToken: tursoToken });
  }

  const dbPath = config.dbPath || process.env.DB_PATH;
  if (!dbPath) {
    throw new Error("DB_PATH environment variable or dbPath config required");
  }
  return createClient({ url: `file:${dbPath}` });
}
```

### 2. FileSystem Abstraction - Dependency Injection

Abstract file operations to support both Bun and Node.js:

```typescript
// packages/core/src/search/types.ts
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<ArrayBuffer>;
  write(path: string, data: ArrayBuffer | string): Promise<void>;
}

// packages/core/src/search/orama.ts
export async function initSearchIndex(config: {
  indexPath: string;
  fs: FileSystem;
}): Promise<OramaDb> {
  if (await config.fs.exists(config.indexPath)) {
    const data = await config.fs.read(config.indexPath);
    return restore("binary", Buffer.from(data));
  }
  return createOramaDb();
}
```

Bot adapter (Bun):
```typescript
// apps/bot/src/adapters/fs.ts
export const bunFileSystem: FileSystem = {
  async exists(path) {
    return await Bun.file(path).exists();
  },
  async read(path) {
    return await Bun.file(path).arrayBuffer();
  },
  async write(path, data) {
    await Bun.write(path, data);
  },
};
```

Web adapter (Node.js):
```typescript
// apps/web/src/adapters/fs.ts
import * as fs from "node:fs";

export const nodeFileSystem: FileSystem = {
  async exists(path) {
    return fs.existsSync(path);
  },
  async read(path) {
    const buffer = fs.readFileSync(path);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  },
  async write(path, data) {
    const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    fs.writeFileSync(path, buffer);
  },
};
```

### 3. TensorFlow.js - Optional Peer Dependency

Make embeddings plugin optional:

```json
// packages/core/package.json
{
  "peerDependencies": {
    "@orama/plugin-embeddings": "^3.1.18"
  },
  "peerDependenciesMeta": {
    "@orama/plugin-embeddings": {
      "optional": true
    }
  }
}
```

Bot installs it, Web doesn't.

### 4. Category Config - Unified Definition

Merge emoji (bot) and color (web) definitions:

```typescript
// packages/core/src/config/categories.ts
export interface CategoryConfig {
  key: string;
  emoji: string;
  displayName: string;
  colors: { bg: string; text: string };
}

export const CATEGORIES: Record<string, CategoryConfig> = {
  AI: {
    key: "AI",
    emoji: "🤖",
    displayName: "AI/LLM",
    colors: { bg: "#8b5cf6", text: "#ffffff" },
  },
  // ...
};

export function getCategoryEmoji(category: string): string {
  const cat = CATEGORIES[category];
  return cat ? `${cat.emoji} ${cat.displayName}` : `📌 ${category}`;
}

export function getCategoryColor(category: string): { bg: string; text: string } {
  return CATEGORIES[category]?.colors || { bg: "#6b7280", text: "#ffffff" };
}
```

### 5. Namespace Exports

```typescript
// packages/core/src/index.ts
export * as db from "./db";
export * as search from "./search";
export * as config from "./config";
export * as types from "./db/types";
```

Usage:
```typescript
import { db, search, config, types } from "@newsfeed-ai/core";

const article: types.Article = ...;
const results = await search.searchIndex("AI", 20);
```

## Package Dependencies

### packages/core/package.json
```json
{
  "name": "@newsfeed-ai/core",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./db": "./src/db/index.ts",
    "./search": "./src/search/index.ts",
    "./config": "./src/config/index.ts"
  },
  "dependencies": {
    "@libsql/client": "^0.17.0",
    "@orama/orama": "^3.1.18",
    "@orama/plugin-data-persistence": "^3.1.18",
    "zod": "^4.0.0"
  },
  "peerDependencies": {
    "@orama/plugin-embeddings": "^3.1.18"
  },
  "peerDependenciesMeta": {
    "@orama/plugin-embeddings": { "optional": true }
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.8.0"
  }
}
```

### apps/bot/package.json
```json
{
  "name": "@newsfeed-ai/bot",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun run src/main.ts",
    "dev": "bun --watch src/main.ts"
  },
  "dependencies": {
    "@newsfeed-ai/core": "workspace:*",
    "@anthropic-ai/claude-agent-sdk": "^0.2.7",
    "@orama/plugin-embeddings": "^3.1.18",
    "@tensorflow/tfjs-node": "^4.22.0",
    "discord.js": "^14.25.1",
    "rss-parser": "^3.13.0"
  }
}
```

### apps/web/package.json
```json
{
  "name": "@newsfeed-ai/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3000",
    "build": "vite build",
    "start": "bun run server.ts"
  },
  "dependencies": {
    "@newsfeed-ai/core": "workspace:*",
    "@tanstack/react-router": "^1.150.0",
    "@tanstack/react-start": "^1.150.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/react": "^19.0.0",
    "@vitejs/plugin-react": "^4.5.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0"
  }
}
```

## Implementation Phases

### Phase 1: Create packages/core (no breaking changes)
1. Create `packages/core/` directory structure
2. Extract types (Article, Config, etc.)
3. Extract db operations (with config injection)
4. Extract search functionality (with FileSystem DI)
5. Extract category definitions

### Phase 2: Migrate Bot
1. Move `src/` → `apps/bot/src/`
2. Create Bun adapters
3. Update imports to use `@newsfeed-ai/core`
4. Verify tests pass

### Phase 3: Migrate Web
1. Move `web/` → `apps/web/`
2. Create Node.js adapters
3. Update imports
4. Verify Vite build works

### Phase 4: Cleanup
1. Remove duplicated code
2. Update systemd service files
3. Update deploy scripts
4. Add integration tests

## Verification Checklist

- [ ] Bun workspace resolves `workspace:*` correctly
- [ ] `import.meta.dir` works correctly in workspace packages
- [ ] TanStack Start + Vite resolves `@newsfeed-ai/core`
- [ ] SSR build excludes TensorFlow.js correctly
- [ ] Production paths resolve correctly (systemd services)
- [ ] All existing tests pass
