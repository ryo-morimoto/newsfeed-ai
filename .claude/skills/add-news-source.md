---
name: add-news-source
description: Add a new RSS, Hacker News, or GitHub Trending source to the newsfeed configuration
allowed-tools:
  - Read
  - Edit
  - Glob
---

# Adding News Sources

This skill guides you through adding new news sources to the newsfeed-ai project.

## Configuration File

Sources are defined in `config/sources.yaml`.

## Source Types

### RSS Source

```yaml
- name: Example RSS
  type: rss
  url: https://example.com/feed.xml
  category: tech
  enabled: true
```

### Hacker News Source

```yaml
- name: Hacker News
  type: hackernews
  category: tech
  enabled: true
```

### GitHub Trending Source

```yaml
- name: GitHub Trending
  type: github-trending
  languages:
    - typescript
    - rust
  category: repos
  enabled: true
```

## Categories

Available categories (defined in same config file):
- `ai` - AI/LLM content
- `tech` - General tech news
- `frontend` - Frontend development
- `backend` - Backend development
- `repos` - GitHub repositories
- `crypto` - Cryptocurrency
- `tech-jp` - Japanese tech content
- `gaming` - Gaming news

To add a new category, also add it to the `categories` section with an emoji.

## Type Definitions

Source types are defined in `src/config.ts`:
- `RssSource`
- `HackerNewsSource`
- `GitHubTrendingSource`

## Validation

After adding a source:
1. Run `bun run typecheck` to verify types
2. Run `bun test src/config.test.ts` to test config loading
