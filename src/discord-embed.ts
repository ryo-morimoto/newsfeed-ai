import { getCategoryEmoji } from "./config";
import type { NotifyArticle } from "./notify";
import type { TextChannel } from "discord.js";
import { getArticleDetailUrl } from "./article-url";

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
 * Format relative date (e.g., "今日", "1日前", "3日前")
 */
function formatRelativeDate(date?: Date): string {
  if (!date) return "";
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "今日";
  if (diffDays === 1) return "1日前";
  if (diffDays <= 7) return `${diffDays}日前`;
  
  // More than a week: show date
  return `${date.getMonth() + 1}/${date.getDate()}`;
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
  const now = new Date();
  const dateStr = now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" });
  const timeStr = now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });

  // Header embed
  embeds.push({
    title: `📰 Tech Digest`,
    description: `**${dateStr} ${timeStr}** のまとめ（${articles.length}件）`,
    color: 0x5865f2, // Discord blurple
  });

  for (const [category, items] of Object.entries(grouped)) {
    const emoji = getCategoryEmoji(category);
    const color = categoryColors[category] || 0x6b7280;

    // Build description with article list
    let description = "";
    for (const item of items.slice(0, 5)) {
      const isJapanese = category === "tech-jp";
      const displayText = isJapanese ? item.title : (item.summary || item.title);
      const dateLabel = formatRelativeDate(item.published);
      const datePart = dateLabel ? ` • ${dateLabel}` : "";
      const detailUrl = getArticleDetailUrl(item.url);
      description += `**[${displayText}](${item.url})**\n`;
      description += `└ \`${item.source}\`${datePart} • [Summary](${detailUrl})\n\n`;
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
    const detailUrl = getArticleDetailUrl(article.url);

    // Add detail link to description
    const description = article.summary
      ? `${article.summary}\n\n[View Detailed Summary](${detailUrl})`
      : `[View Detailed Summary](${detailUrl})`;

    return {
      title: article.title.slice(0, 256), // Discord limit
      url: article.url,
      description,
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
      const shortText = displayText.length > 50 ? displayText.slice(0, 47) + "..." : displayText;
      const detailUrl = getArticleDetailUrl(item.url);
      value += `• [${shortText}](${item.url}) [[+]](${detailUrl})\n`;
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


/**
 * Send embeds via Discord.js client (Bot)
 */
export async function sendEmbedsViaBot(
  channel: TextChannel,
  embeds: DiscordEmbed[]
): Promise<boolean> {
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
      await channel.send({ embeds: chunk });

      // Rate limit
      if (chunks.length > 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (error) {
      console.error("Failed to send Discord embed via bot", error);
      return false;
    }
  }

  console.log(`Sent ${embeds.length} embeds via bot`);
  return true;
}
