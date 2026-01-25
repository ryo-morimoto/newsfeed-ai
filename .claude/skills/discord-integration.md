---
name: discord-integration
description: Modify Discord bot behavior, commands, embeds, or notification settings
allowed-tools:
  - Read
  - Edit
  - Glob
  - Grep
---

# Discord Integration

This skill helps you modify Discord-related functionality.

## Key Files

- `src/bot.ts` - Discord bot with scheduler and commands
- `src/discord-embed.ts` - Embed formatting (text, digest, category)
- `src/notify.ts` - Webhook-based notifications (legacy)

## Bot Commands

Commands are handled in `src/bot.ts` in the `MessageCreate` event:

```typescript
if (command === "ping") {
  await message.reply("Pong!");
} else if (command === "status") {
  // ...
} else if (command === "run" || command === "now") {
  // ...
}
```

### Adding a New Command

1. Add a new condition in the command handler
2. Update the help message: `await message.reply("Commands: ping, status, run, NEW_COMMAND");`

## Embed Formats

Three formats available in `src/discord-embed.ts`:

- `text` - Plain markdown messages
- `digest` - Compact daily digest
- `category` - Grouped by category

Set via `EMBED_FORMAT` environment variable.

## Schedule Configuration

In `src/bot.ts`:

```typescript
const SCHEDULE_HOURS_UTC = [23]; // 8:00 JST
```

To add more times, add to the array: `[7, 15, 23]` for 3 times per day.

## Environment Variables

- `DISCORD_BOT_TOKEN` - Bot token (required for bot mode)
- `DISCORD_CHANNEL_ID` - Target channel (required for bot mode)
- `DISCORD_WEBHOOK` - Webhook URL (for webhook mode)
- `EMBED_FORMAT` - Output format (text/digest/category)

## Color Scheme

Category colors are defined in `src/discord-embed.ts`:

```typescript
const CATEGORY_COLORS: Record<string, number> = {
  ai: 0x10a37f,
  tech: 0x0066cc,
  // ...
};
```

## Testing

Run `bun test src/discord-embed.test.ts` after modifications.
