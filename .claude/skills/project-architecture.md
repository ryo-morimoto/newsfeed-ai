---
name: project-architecture
description: Understand the newsfeed-ai architecture, module structure, and data flow
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Project Architecture

This skill provides an overview of the newsfeed-ai project structure.

## Overview

newsfeed-ai is an AI-powered personalized tech news aggregator that:

1. Fetches articles from multiple sources (Hacker News, RSS, GitHub Trending)
2. Filters articles by relevance using AI (Groq/Llama 3.3)
3. Sends daily digests to Discord

## Data Flow

```
Sources → Fetch → Dedupe → Filter → Rank → Summarize → Format → Discord
```

## Key Modules

### Entry Points

- `src/main.ts` - CLI entry, orchestrates the pipeline
- `src/bot.ts` - Discord bot with scheduler

### Data Layer

- `src/db.ts` - SQLite operations (bun:sqlite)
- `src/config.ts` - YAML config loader

### Pipeline

- `src/filter.ts` - AI-based relevance filtering
- `src/summarize.ts` - Article summarization (Japanese)

### Sources

- `src/sources/hackernews.ts` - Hacker News API
- `src/sources/rss.ts` - RSS feed parser
- `src/sources/github-trending.ts` - GitHub trending

### Output

- `src/discord-embed.ts` - Rich embed formatting
- `src/notify.ts` - Webhook notifications (legacy)

## Database Schema

SQLite at `data/history.db`:

```sql
articles (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  source TEXT,
  category TEXT,
  summary TEXT,
  score REAL,
  published_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  notified INTEGER DEFAULT 0
)
```

## Article Type

```typescript
interface Article {
  title: string;
  url: string;
  source: string;
  category: string;
  summary?: string;
  score?: number;
  publishedAt?: Date;
}
```

## Environment Variables

| Variable             | Purpose                        |
| -------------------- | ------------------------------ |
| `GROQ_API_KEY`       | AI filtering/summarization     |
| `DISCORD_BOT_TOKEN`  | Bot authentication             |
| `DISCORD_CHANNEL_ID` | Target channel                 |
| `DISCORD_WEBHOOK`    | Webhook URL                    |
| `DRY_RUN`            | Skip notifications             |
| `MAX_ARTICLES`       | Limit per digest (default: 20) |
| `MAX_PER_SOURCE`     | Limit per source (default: 10) |
| `EMBED_FORMAT`       | text/digest/category           |

## Runtime

Uses Bun exclusively:

- `bun:sqlite` for database
- `Bun.YAML.parse` for config
- `Bun.file` for file operations
