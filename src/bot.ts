import {
  Client,
  GatewayIntentBits,
  Events,
  TextChannel,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { ensureDb } from "./db";
import { runNewsfeed, markArticlesNotified } from "./main";
import { sendEmbedsViaBot } from "./discord-embed";
import { runFeedbackAgent, type FeedbackResult } from "./agent-feedback";
import { watchTask, checkPendingTasks, cleanup, type TaskCompletionInfo } from "./task-monitor";
import { smartSearch } from "./web-search";

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

// Task check interval (30 seconds)
const TASK_CHECK_INTERVAL_MS = 30_000;

// Schedule times (JST hours -> UTC hours)
// JST 8:00 = UTC 23:00 (previous day)
const SCHEDULE_HOURS_UTC = [23]; // 8:00 JST

let lastRunHour = -1;

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check if the bot is responding"),
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Show bot uptime and status"),
  new SlashCommandBuilder()
    .setName("run")
    .setDescription("Manually trigger the newsfeed"),
  new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Submit feedback to create a task in vibe-kanban")
    .addStringOption((option) =>
      option
        .setName("request")
        .setDescription("Your feedback or feature request")
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search the web with natural language")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Your search query (e.g., 'latest React 19 features')")
        .setRequired(true)
    ),
];

/**
 * Register slash commands with Discord API
 */
async function registerCommands(token: string, clientId: string) {
  const rest = new REST({ version: "10" }).setToken(token);

  try {
    console.log("🔄 Registering slash commands...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands.map((cmd) => cmd.toJSON()),
    });
    console.log("✅ Slash commands registered successfully");
  } catch (error) {
    console.error("❌ Failed to register slash commands:", error);
  }
}

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

/**
 * Check pending tasks and send notifications for completed ones
 */
async function checkAndNotifyTasks() {
  try {
    const completedTasks = await checkPendingTasks();

    for (const task of completedTasks) {
      await sendTaskNotification(task);
    }
  } catch (error) {
    console.error("[task-monitor] Error checking tasks:", error);
  }
}

/**
 * Send Discord notification for a completed task
 */
async function sendTaskNotification(task: TaskCompletionInfo) {
  const channel = client.channels.cache.get(task.channelId) as TextChannel;
  if (!channel) {
    console.error(`[task-monitor] Channel ${task.channelId} not found`);
    return;
  }

  let content: string;

  if (task.status === "completed") {
    // Compact format: just show PR link (wrapped in <> to disable preview)
    if (task.prUrl) {
      content = `✅ Done → <${task.prUrl}>`;
    } else {
      content = `✅ Done (no PR)`;
    }
  } else {
    content = `❌ Failed: ${task.error || "Unknown error"}`;
  }

  try {
    await channel.send({
      content,
      reply: { messageReference: task.messageId },
    });
  } catch {
    // If reply fails (e.g., message too old), just send to channel
    await channel.send(content);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot ready: ${c.user.tag}`);
  console.log(`📅 Scheduled hours (UTC): ${SCHEDULE_HOURS_UTC.join(", ")}`);
  console.log(`📺 Channel ID: ${CHANNEL_ID}`);

  // Register slash commands
  const token = process.env.DISCORD_BOT_TOKEN;
  if (token && c.user.id) {
    await registerCommands(token, c.user.id);
  }

  // Check schedule every minute
  setInterval(checkSchedule, 60 * 1000);

  // Check pending tasks every 30 seconds
  setInterval(checkAndNotifyTasks, TASK_CHECK_INTERVAL_MS);

  // Cleanup old task notifications daily
  setInterval(() => cleanup(7), 24 * 60 * 60 * 1000);

  // Run checks immediately on startup
  checkSchedule();
  checkAndNotifyTasks();
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;
  console.log(`📩 Slash command by ${interaction.user.tag}: /${commandName}`);

  if (commandName === "ping") {
    await interaction.reply("Pong!");
  } else if (commandName === "status") {
    const uptime = Math.floor(process.uptime());
    const hours = Math.floor(uptime / 3600);
    const mins = Math.floor((uptime % 3600) / 60);
    await interaction.reply(`Bot is running. Uptime: ${hours}h ${mins}m`);
  } else if (commandName === "run") {
    await interaction.reply("Running newsfeed now...");
    await runScheduledNewsfeed();
  } else if (commandName === "feedback") {
    const feedbackText = interaction.options.getString("request", true);
    await handleFeedbackInteraction(interaction, feedbackText);
  } else if (commandName === "search") {
    const query = interaction.options.getString("query", true);
    await handleSearchInteraction(interaction, query);
  }
});

/**
 * Handle the feedback slash command - creates task and starts execution via vibe-kanban
 */
async function handleFeedbackInteraction(
  interaction: ChatInputCommandInteraction,
  feedbackText: string
) {
  const requestedBy = interaction.user.tag;

  // Defer reply since this operation takes time
  await interaction.deferReply();

  try {
    const result: FeedbackResult = await runFeedbackAgent(feedbackText, requestedBy);

    if (result.success && result.taskId && result.attemptId) {
      // Compact format: just show the request and task ID
      const response = `🚀 Started: ${feedbackText.slice(0, 100)}${feedbackText.length > 100 ? "..." : ""}`;

      const replyMessage = await interaction.editReply(response);

      // Register task for notification (stateless - survives bot restarts)
      watchTask(result.taskId, interaction.channelId, replyMessage.id);

    } else if (result.taskId) {
      await interaction.editReply(
        `⚠️ Task created but not started: ${result.error || "Unknown error"}`
      );
    } else {
      await interaction.editReply(
        `❌ Failed: ${result.error || "Unknown error"}`
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await interaction.editReply(`Agent failed: ${errorMsg}`);
  }
}

/**
 * Handle the search slash command - performs web search with natural language
 */
async function handleSearchInteraction(
  interaction: ChatInputCommandInteraction,
  query: string
) {
  // Defer reply since search takes time
  await interaction.deferReply();

  try {
    console.log(`🔍 Web search by ${interaction.user.tag}: ${query}`);
    const result = await smartSearch(query);

    // Format response for Discord
    let response = `🔍 **${query}**\n\n${result.summary}`;

    // Add citations if available
    if (result.citations.length > 0) {
      response += "\n\n📚 **Sources:**";
      for (const url of result.citations.slice(0, 5)) {
        // Wrap URLs in <> to prevent embeds
        response += `\n• <${url}>`;
      }
    }

    // Discord has 2000 char limit
    if (response.length > 2000) {
      response = response.slice(0, 1997) + "...";
    }

    await interaction.editReply(response);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Search failed: ${errorMsg}`);
    await interaction.editReply(`❌ Search failed: ${errorMsg}`);
  }
}

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
