import { getCategoryEmoji } from "../config";

export interface NotifyArticle {
  title: string;
  url: string;
  summary?: string;
  category: string;
  source: string;
  published?: Date;
}

const DISCORD_RATE_LIMIT_MS = 500;
const DISCORD_MAX_MESSAGE_LENGTH = 1900;

function splitIntoChunks(content: string, maxLength: number): string[] {
  if (content.length <= maxLength) {
    return [content];
  }

  const chunks: string[] = [];
  const lines = content.split("\n");
  let chunk = "";

  for (const line of lines) {
    if (chunk.length + line.length > maxLength) {
      chunks.push(chunk);
      chunk = line + "\n";
    } else {
      chunk += line + "\n";
    }
  }
  if (chunk) chunks.push(chunk);

  return chunks;
}

async function sendChunksWithRateLimit(
  webhookUrl: string,
  chunks: string[],
  delayMs: number
): Promise<boolean> {
  try {
    await chunks.reduce<Promise<void>>(async (prevPromise, chunk, index) => {
      await prevPromise;
      if (index > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chunk }),
      });

      if (!res.ok) {
        throw new Error(`Discord webhook failed: ${res.status}`);
      }
    }, Promise.resolve());
    return true;
  } catch (error) {
    console.error("Failed to send Discord notification", error);
    return false;
  }
}

export async function sendToDiscord(
  webhookUrl: string,
  articles: NotifyArticle[]
): Promise<boolean> {
  if (!webhookUrl) {
    console.error("Discord webhook URL not configured");
    return false;
  }

  if (articles.length === 0) {
    console.log("No articles to send");
    return true;
  }

  // Group by category
  const grouped = articles.reduce(
    (acc, article) => {
      const cat = article.category || "tech";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(article);
      return acc;
    },
    {} as Record<string, NotifyArticle[]>
  );

  // Get all category emojis in parallel
  const categories = Object.keys(grouped);
  const emojis = await Promise.all(categories.map(getCategoryEmoji));
  const categoryEmojis = Object.fromEntries(categories.map((cat, i) => [cat, emojis[i]]));

  // Build message
  const today = new Date().toISOString().split("T")[0];
  let content = `📰 **Today's Tech Digest** (${today})\n\n`;

  for (const [category, items] of Object.entries(grouped)) {
    const emoji = categoryEmojis[category];
    content += `**${emoji}**\n`;

    for (const item of items.slice(0, 5)) {
      // Max 5 per category
      const isJapanese = category === "tech-jp";
      const displayText = isJapanese ? item.title : item.summary || item.title;
      content += `• ${displayText} [${item.source}]\n  <${item.url}>\n`;
    }
    content += "\n";
  }

  const chunks = splitIntoChunks(content, DISCORD_MAX_MESSAGE_LENGTH);
  const success = await sendChunksWithRateLimit(webhookUrl, chunks, DISCORD_RATE_LIMIT_MS);

  if (success) {
    console.log(`Sent ${articles.length} articles to Discord`);
  }
  return success;
}
