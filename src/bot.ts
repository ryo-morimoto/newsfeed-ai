import { Client, GatewayIntentBits, Events } from "discord.js";
import { initDb } from "./db";

// Initialize database
initDb();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
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

    // コマンド解析
    const args = content.split(/\s+/);
    const command = args[0]?.toLowerCase();

    if (command === "ping") {
      await message.reply("Pong! 🏓");
    } else if (command === "status") {
      await message.reply(`Bot is running. Uptime: ${Math.floor(process.uptime())}s`);
    } else {
      await message.reply("👋 Commands: `ping`, `status`");
    }
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN not set");
  process.exit(1);
}

client.login(token);

export { client };
