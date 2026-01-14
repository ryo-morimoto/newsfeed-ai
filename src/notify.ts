export interface NotifyArticle {
  title: string;
  url: string;
  summary?: string;
  category: string;
  source: string;
}

const CATEGORY_EMOJI: Record<string, string> = {
  ai: "🤖 AI/LLM",
  tech: "💻 Tech",
  frontend: "⚛️ Frontend",
  backend: "🔧 Backend",
  repos: "📦 Trending Repos",
  crypto: "📊 Crypto",
  "tech-jp": "🇯🇵 日本語Tech",
  gaming: "🎮 Gaming",
};

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

  // Build message
  const today = new Date().toISOString().split("T")[0];
  let content = `📰 **Today's Tech Digest** (${today})\n\n`;

  for (const [category, items] of Object.entries(grouped)) {
    const emoji = CATEGORY_EMOJI[category] || `📌 ${category}`;
    content += `**${emoji}**\n`;

    for (const item of items.slice(0, 5)) {
      // Max 5 per category
      const summary = item.summary ? ` - ${item.summary}` : "";
      content += `• [${item.title}](${item.url})${summary}\n`;
    }
    content += "\n";
  }

  // Discord has 2000 char limit per message
  const chunks: string[] = [];
  if (content.length > 1900) {
    // Split into multiple messages
    const lines = content.split("\n");
    let chunk = "";
    for (const line of lines) {
      if (chunk.length + line.length > 1900) {
        chunks.push(chunk);
        chunk = line + "\n";
      } else {
        chunk += line + "\n";
      }
    }
    if (chunk) chunks.push(chunk);
  } else {
    chunks.push(content);
  }

  // Send messages
  for (const chunk of chunks) {
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: chunk }),
      });

      if (!res.ok) {
        console.error(`Discord webhook failed: ${res.status}`);
        return false;
      }

      // Rate limit: wait between messages
      if (chunks.length > 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (error) {
      console.error("Failed to send Discord notification", error);
      return false;
    }
  }

  console.log(`Sent ${articles.length} articles to Discord`);
  return true;
}
