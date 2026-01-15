---
name: testing
description: Write and run tests for newsfeed-ai using Bun test framework
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash
  - Glob
  - Grep
---

# Testing in newsfeed-ai

This skill helps you write and run tests using Bun's test framework.

## Test Structure

```
src/
  *.test.ts              # Unit tests (co-located with source)
  __tests__/
    integration/         # Integration tests
      pipeline.test.ts
      source-db.test.ts
      discord.test.ts
```

## Running Tests

```bash
# All tests
bun test

# Unit tests only
bun test src/*.test.ts

# Integration tests only
bun test src/__tests__/

# Watch mode
bun test --watch

# Specific file
bun test src/filter.test.ts
```

## Writing Tests

```typescript
import { test, expect, describe, beforeEach, mock } from "bun:test";

describe("Module Name", () => {
  beforeEach(() => {
    // Setup
  });

  test("should do something", () => {
    expect(result).toBe(expected);
  });

  test("async operation", async () => {
    const result = await asyncFunction();
    expect(result).toBeDefined();
  });
});
```

## Mocking

```typescript
import { mock } from "bun:test";

// Mock a module
mock.module("./db", () => ({
  isArticleSeen: mock(() => false),
  saveArticle: mock(() => {}),
}));

// Mock fetch
globalThis.fetch = mock(() =>
  Promise.resolve(new Response(JSON.stringify({ data: "test" })))
);
```

## Test Patterns in This Project

### Testing with Database

Integration tests use in-memory SQLite:
```typescript
import { Database } from "bun:sqlite";
const db = new Database(":memory:");
```

### Testing Discord Embeds

```typescript
const embed = createEmbed(article);
expect(embed.title).toBe(article.title);
expect(embed.color).toBe(CATEGORY_COLORS[article.category]);
```

## CI Pipeline

Tests run in GitHub Actions:
1. Type checking: `bun x tsc --noEmit`
2. Unit tests: `bun test src/*.test.ts`
3. Integration tests: `bun test src/__tests__/`

## Coverage

Bun supports coverage reporting:
```bash
bun test --coverage
```
