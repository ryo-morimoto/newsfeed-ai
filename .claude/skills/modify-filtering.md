---
name: modify-filtering
description: Modify article filtering logic, user interests, or AI scoring behavior
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
---

# Modifying Article Filtering

This skill helps you modify how articles are filtered and scored for relevance.

## Key Files

- `src/filter.ts` - Main filtering logic using Groq API
- `config/sources.yaml` - User interests list

## User Interests

Interests are defined in `config/sources.yaml` under the `interests` key:

```yaml
interests:
  - AI/LLM developments, especially Claude, GPT, agent frameworks
  - React, Next.js, TypeScript frontend
  - ...
```

These are used in the prompt to score article relevance.

## Filtering Logic

In `src/filter.ts`:

1. Articles are batched (10 per batch)
2. Each batch is sent to Groq API (Llama 3.3-70B)
3. AI returns scores 0-1 for each article
4. Articles with score >= 0.5 pass the filter

## Customization Points

### Change Score Threshold

In `src/filter.ts`, find:
```typescript
.filter((a) => a.score >= 0.5)
```

### Modify Batch Size

```typescript
const BATCH_SIZE = 10;
```

### Adjust Rate Limiting

```typescript
await new Promise((r) => setTimeout(r, 6000)); // 6 seconds between batches
```

### Change AI Model

The model is set in the Groq API call. Current: `llama-3.3-70b-versatile`

## Environment Variables

- `GROQ_API_KEY` - Required for filtering (fallback: all articles pass with score 0.5)

## Testing

Run `bun test src/filter.test.ts` after modifications.
