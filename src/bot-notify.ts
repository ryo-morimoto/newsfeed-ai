import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { getCategoryEmoji } from "./config";
import { saveMessageId } from "./db";
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

/**
 * Send articles via Discord Bot and save message IDs for feedback tracking
 */
export async function sendArticlesViaBot(
  client: Client,
  channelId: string,
  articles: NotifyArticle[]
): Promise<boolean> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !(channel instanceof TextChannel)) {
    console.error(`Channel ${channelId} not found or not a text channel`);
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

  const now = new Date();
  const dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  // Send header
  const headerEmbed = new EmbedBuilder()
    .setTitle("📰 Tech Digest")
    .setDescription(`**${dateStr} ${timeStr}** のまとめ（${articles.length}件）\n\n👍 = 興味あり / 👎 = 興味なし でフィードバック`)
    .setColor(0x5865f2);

  await channel.send({ embeds: [headerEmbed] });

  // Send each article as individual message for reaction tracking
  for (const [category, items] of Object.entries(grouped)) {
    const emoji = getCategoryEmoji(category);
    const color = categoryColors[category] || 0x6b7280;

    // Category header
    await channel.send(`**${emoji}**`);

    for (const item of items.slice(0, 5)) {
      const isJapanese = category === "tech-jp";
      const displayText = isJapanese ? item.title : (item.summary || item.title);

      const embed = new EmbedBuilder()
        .setDescription(`**[${displayText}](${item.url})**\n└ \`${item.source}\``)
        .setColor(color);

      const message = await channel.send({ embeds: [embed] });
      
      // Save message ID for feedback tracking
      saveMessageId(item.url, message.id);
      
      // Add reaction buttons
      await message.react("👍");
      await message.react("👎");

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  console.log(`Sent ${articles.length} articles via Bot`);
  return true;
}
