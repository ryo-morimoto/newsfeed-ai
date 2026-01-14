import { getCategoryEmoji } from "./config";
import type { NotifyArticle } from "./notify";

// Discord Embed colors by category
const categoryColors: Record<string, number> = {
  ai: 0x8b5cf6,       // Purple
  tech: 0x3b82f6,     // Blue
  frontend: 0x06b6d4, // Cyan
  backend: 0xf97316,  // Orange
  repos: 0x22c55e,    // Green
  crypto: 0xeab308,   // Yellow
  "tech-jp": 0xef4444, // Red
  gaming: 0xec4899,   // Pink
};

export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: {
    text: string;
    icon_url?: string;
  };
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Create a single embed per category with multiple articles
 */
export function createCategoryEmbeds(articles: NotifyArticle[]): DiscordEmbed[] {
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

  const embeds: DiscordEmbed[] = [];

  for (const [category, items] of Object.entries(grouped)) {
    const emoji = getCategoryEmoji(category);
    const color = categoryColors[category] || 0x6b7280;

    // Build description with article list
    let description = "";
    for (const item of items.slice(0, 5)) {
      const isJapanese = category === "tech-jp";
      const displayText = isJapanese ? item.title : (item.summary || item.title);
      description += `**[${displayText}](${item.url})**\n`;
      description += `└ \`${item.source}\`\n\n`;
    }

    embeds.push({
      title: emoji,
      description: description.trim(),
      color,
    });
  }

  return embeds;
}

/**
 * Create individual embeds for each article (more detailed view)
 */
export function createArticleEmbeds(articles: NotifyArticle[]): DiscordEmbed[] {
  return articles.map((article) => {
    const color = categoryColors[article.category] || 0x6b7280;
    const emoji = getCategoryEmoji(article.category);

    return {
      title: article.title.slice(0, 256), // Discord limit
      url: article.url,
      description: article.summary || undefined,
      color,
      footer: {
        text: `${emoji} • ${article.source}`,
      },
    };
  });
}

/**
 * Create a compact daily digest embed
 */
export function createDigestEmbed(articles: NotifyArticle[]): DiscordEmbed[] {
  const today = new Date().toISOString().split("T")[0];

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

  const fields: DiscordEmbed["fields"] = [];

  for (const [category, items] of Object.entries(grouped)) {
    const emoji = getCategoryEmoji(category);
    let value = "";
    
    for (const item of items.slice(0, 3)) {
      const isJapanese = category === "tech-jp";
      const displayText = isJapanese ? item.title : (item.summary || item.title);
      const shortText = displayText.length > 60 ? displayText.slice(0, 57) + "..." : displayText;
      value += `• [${shortText}](${item.url})\n`;
    }

    if (items.length > 3) {
      value += `*+${items.length - 3} more*\n`;
    }

    fields.push({
      name: emoji,
      value: value.trim() || "No items",
      inline: false,
    });
  }

  return [{
    title: `📰 Today's Tech Digest`,
    description: `${today} • ${articles.length} articles curated just for you`,
    color: 0x5865f2, // Discord blurple
    fields,
    footer: {
      text: "Powered by News Bot 🤖",
    },
    timestamp: new Date().toISOString(),
  }];
}

/**
 * Send embeds to Discord webhook
 */
export async function sendEmbedsToDiscord(
  webhookUrl: string,
  embeds: DiscordEmbed[]
): Promise<boolean> {
  if (!webhookUrl) {
    console.error("Discord webhook URL not configured");
    return false;
  }

  if (embeds.length === 0) {
    console.log("No embeds to send");
    return true;
  }

  // Discord allows max 10 embeds per message
  const chunks: DiscordEmbed[][] = [];
  for (let i = 0; i < embeds.length; i += 10) {
    chunks.push(embeds.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    try {
      const payload: DiscordWebhookPayload = { embeds: chunk };
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`Discord webhook failed: ${res.status} - ${text}`);
        return false;
      }

      // Rate limit
      if (chunks.length > 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (error) {
      console.error("Failed to send Discord embed", error);
      return false;
    }
  }

  console.log(`Sent ${embeds.length} embeds to Discord`);
  return true;
}
