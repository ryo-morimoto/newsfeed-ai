import { Client, GatewayIntentBits, Events, TextChannel } from "discord.js";
import { ensureDb } from "./db";
import { runNewsfeed, markArticlesNotified } from "./main";
import { sendEmbedsViaBot } from "./discord-embed";

// Initialize database
ensureDb();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID || "";

// Schedule times (JST hours -> UTC hours)
// JST 8:00 = UTC 23:00 (previous day)
const SCHEDULE_HOURS_UTC = [23]; // 8:00 JST

let lastRunHour = -1;

/**
 * Run scheduled newsfeed and post to Discord
 */
async function runScheduledNewsfeed() {
  console.log(`\n⏰ Running scheduled newsfeed...`);
  
  const channel = client.channels.cache.get(CHANNEL_ID) as TextChannel;
  if (!channel) {
    console.error(`Channel ${CHANNEL_ID} not found`);
    return;
  }

  try {
    const result = await runNewsfeed();
    if (!result || result.articles.length === 0) {
      console.log("No articles to post");
      return;
    }

    const success = await sendEmbedsViaBot(channel, result.embeds);
    if (success) {
      markArticlesNotified(result.articles);
      console.log(`✅ Posted ${result.articles.length} articles to Discord`);
    }
  } catch (error) {
    console.error("Scheduled newsfeed failed:", error);
  }
}

/**
 * Check if it's time to run the scheduled task
 */
function checkSchedule() {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentMinute = now.getUTCMinutes();

  // Run at the top of the scheduled hour (minute 0-1)
  if (
    SCHEDULE_HOURS_UTC.includes(currentHour) &&
    currentMinute <= 1 &&
    lastRunHour !== currentHour
  ) {
    lastRunHour = currentHour;
    runScheduledNewsfeed();
  }
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot ready: ${c.user.tag}`);
  console.log(`📅 Scheduled hours (UTC): ${SCHEDULE_HOURS_UTC.join(", ")}`);
  console.log(`📺 Channel ID: ${CHANNEL_ID}`);

  // Check schedule every minute
  setInterval(checkSchedule, 60 * 1000);
  
  // Also check immediately on startup
  checkSchedule();
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
      const uptime = Math.floor(process.uptime());
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      await message.reply(`Bot is running. Uptime: ${hours}h ${mins}m`);
    } else if (command === "run" || command === "now") {
      // Manual trigger
      await message.reply("🚀 Running newsfeed now...");
      await runScheduledNewsfeed();
    } else {
      await message.reply("👋 Commands: `ping`, `status`, `run`");
    }
  }
});

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN not set");
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error("❌ DISCORD_CHANNEL_ID not set");
  process.exit(1);
}

client.login(token);

export { client };
