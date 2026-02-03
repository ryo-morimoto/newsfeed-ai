# E2E Testing Design for Web UI

## Overview

Playwright を使用した E2E テスト基盤。デプロイ後の本番確認と PR 時のリグレッションテストを実現する。

## Architecture

```
apps/web/
├── e2e/
│   ├── tests/
│   │   ├── smoke.spec.ts       # 全ページの基本チェック (本番スモークテスト用)
│   │   └── pages/
│   │       ├── index.spec.ts   # トップページ詳細テスト
│   │       ├── article.spec.ts # 記事詳細ページ
│   │       └── search.spec.ts  # 検索ページ
│   ├── playwright.config.ts
│   └── fixtures.ts              # 共通セットアップ
├── package.json                 # playwright 追加
```

## Test Execution Strategy

| Trigger | Target URL | Test Suite | Purpose |
|---------|------------|------------|---------|
| PR created/updated | Cloudflare Preview URL | All tests | Regression testing |
| Push to main | `newsfeed-ai.ryo-o.dev` | smoke.spec.ts only | Post-release verification |

## Test Scenarios

### smoke.spec.ts (Smoke Tests)
Minimal checks for all pages - runs after production release.

```typescript
- GET / → 200, <h1>記事一覧</h1> exists
- GET /search → 200, search form exists
- GET /article/{known-url} → 200 or 404 (depends on DB)
```

### pages/index.spec.ts (Index Page)
```typescript
- Page title contains "Newsfeed AI"
- Header navigation links exist (記事一覧, 検索)
- Article cards displayed (1+) OR "no articles" message
- Footer exists
```

### pages/article.spec.ts (Article Detail)
```typescript
- Existing article URL → 200, title & summary sections exist
- Non-existing URL → 404 page displayed
- "Back to list" link exists
```

### pages/search.spec.ts (Search Page)
```typescript
- Search form (input, button) exists
- No query → "enter keyword" message
- With query (?q=test) → results OR "no results" message
```

## GitHub Actions Workflows

### e2e-preview.yml (PR Regression)
```yaml
Trigger: pull_request (apps/web/** changes)
Steps:
  1. Wait for Cloudflare Preview deployment
  2. Get Preview URL (wrangler or GitHub Deployment API)
  3. Run all Playwright tests
  4. Post results as PR comment
```

### e2e-production.yml (Production Smoke)
```yaml
Trigger:
  - push to main (apps/web/** changes)
  - workflow_dispatch (manual)
Steps:
  1. Wait for production deploy completion
  2. Run Playwright smoke tests
  3. Notify on failure (optional: Slack/Discord)
```

## Local Development

### Commands
```bash
# Run smoke tests against production
bun run test:e2e:smoke

# Run all tests against Preview URL
E2E_BASE_URL=https://xxx.newsfeed-ai-web.pages.dev bun run test:e2e

# Debug with UI mode
bun run test:e2e:ui
```

### Environment Variables
```bash
E2E_BASE_URL=https://newsfeed-ai.ryo-o.dev  # Default: production
```

## Playwright Configuration Notes

- No `webServer` config (testing external URLs)
- Timeout: 30s (accounts for Cloudflare Workers cold start)
- Retries: 2 in CI, 0 locally
