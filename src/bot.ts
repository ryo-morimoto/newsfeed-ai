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
    content = `🎉 **Task completed!**\nTask ID: \`${task.taskId}\``;

    if (task.branch) {
      content += `\nBranch: \`${task.branch}\``;
    }

    if (task.prUrl) {
      content += `\n\n📝 **PR created:** ${task.prUrl}`;
    } else {
      content += `\n\n⚠️ No PR found. Check vibe-kanban for details.`;
    }
  } else {
    content = `❌ **Task failed**\nTask ID: \`${task.taskId}\`\nError: ${task.error || "Unknown error"}\n\nCheck vibe-kanban for details.`;
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
      let response =
        `**Task started!**\n` +
        `> ${feedbackText}\n\n` +
        `Task ID: \`${result.taskId}\`\n` +
        `Attempt ID: \`${result.attemptId}\`\n\n` +
        `vibe-kanban is now running claude-code on this task.\n` +
        `I'll notify you when it's done!`;

      if (result.prUrl) {
        response += `\n\nPR: ${result.prUrl}`;
      }

      const replyMessage = await interaction.editReply(response);

      // Register task for notification (stateless - survives bot restarts)
      watchTask(result.taskId, interaction.channelId, replyMessage.id);

    } else if (result.taskId) {
      await interaction.editReply(
        `Task created but execution not started.\n` +
          `> ${feedbackText}\n\n` +
          `Task ID: \`${result.taskId}\`\n` +
          `Error: ${result.error || "Unknown error"}\n\n` +
          `Check vibe-kanban UI for details.`
      );
    } else {
      await interaction.editReply(
        `Failed to create task.\n` +
          `> ${feedbackText}\n\n` +
          `Error: ${result.error || "Unknown error"}\n\n` +
          `Make sure vibe-kanban is running.`
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await interaction.editReply(`Agent failed: ${errorMsg}`);
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
