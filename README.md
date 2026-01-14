# 📰 Newsfeed AI

AI-powered personalized tech news aggregator with adaptive learning. Collects articles from various sources, filters them based on your interests using AI, learns from your feedback, and automatically improves recommendations over time.

## Features

- 📡 **Multiple Sources**: Hacker News, Lobsters, arXiv, GitHub Trending, RSS feeds
- 🧠 **AI Filtering**: Groq API (Llama 3.3 70B) scores articles based on your interests
- 📝 **Auto-Summarization**: Each article gets a brief summary
- 💬 **Discord Notifications**: Daily digest sent to your channel
- 🗄️ **Deduplication**: SQLite tracks seen articles

## Setup

```bash
# Install dependencies
bun install

# Copy and edit environment variables
cp .env.example .env
# Edit .env with your API keys

# Test run (no notifications)
bun run dry-run

# Production run
bun run start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key (free at https://console.groq.com) |
| `DISCORD_WEBHOOK` | Discord webhook URL |
| `MAX_ARTICLES` | Max articles per digest (default: 20) |
| `DRY_RUN` | Skip Discord notification if true |

## Cron Setup

```bash
# Add to crontab
crontab crontab

# Or edit directly
crontab -e
# Add: 0 23 * * * cd /home/exedev/news-bot && ~/.bun/bin/bun run src/main.ts >> data/cron.log 2>&1
```

## Sources

- **Tech**: Hacker News, Lobsters
- **AI/LLM**: arXiv (cs.AI, cs.CL), Hugging Face Blog
- **Frontend**: Vercel Blog
- **Backend**: Laravel News
- **Japanese**: Zenn
- **Repos**: GitHub Trending (TypeScript, Rust, Go)
- **Crypto**: CoinDesk

## Architecture

```
1. Fetch     → Collect articles from all sources
2. Dedup     → Filter out already-seen articles
3. Filter    → Claude scores relevance (0-1)
4. Rank      → Select top N articles
5. Summarize → Claude generates brief summaries
6. Notify    → Send to Discord webhook
7. Save      → Store in SQLite for dedup
```

## License

MIT
