import { Client, GatewayIntentBits, Events } from "discord.js";
import { initDb, getArticleByMessageId } from "./db";

// Initialize database
initDb();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot ready: ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  // メンションされたら反応
  if (message.mentions.has(client.user!)) {
    const content = message.content.replace(/<@!?\d+>/g, "").trim();
    console.log(`📩 Mentioned by ${message.author.tag}: ${content}`);

    if (content.toLowerCase() === "ping") {
      await message.reply("Pong! 🏓");
    } else if (content.toLowerCase() === "status") {
      await message.reply(`Bot is running. Uptime: ${Math.floor(process.uptime())}s`);
    } else {
      await message.reply("👋 Hello! Commands: `ping`, `status`");
    }
  }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  // Fetch partial if needed
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (e) {
      console.error("Failed to fetch reaction:", e);
      return;
    }
  }

  const emoji = reaction.emoji.name;
  const messageId = reaction.message.id;

  // Check if this is an article we posted
  const article = getArticleByMessageId(messageId);
  if (article) {
    console.log(`👍 Feedback: ${emoji} on "${article.title}" by ${user.tag}`);
    // TODO: Save feedback to database
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN not set");
  process.exit(1);
}

client.login(token);

// Export client for use in other modules
export { client };
