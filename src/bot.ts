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
    } else if (command === "good" || command === "bad") {
      // フィードバック: good/bad [URL]
      const url = args[1];
      await handleFeedback(message, command, url, content);
    } else if (content.length > 0) {
      // URL付きの感想 or 自由形式のフィードバック
      const urlMatch = content.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        await handleFeedback(message, "comment", urlMatch[0], content);
      } else {
        // URLなしの感想
        await handleFeedback(message, "general", undefined, content);
      }
    } else {
      await message.reply("👋 Commands: `good [URL]`, `bad [URL]`, or just share your thoughts!");
    }
  }
});

/**
 * フィードバックを処理
 * 
 * TODO: 現在はログに保存するのみ。今後の使い道:
 * - 興味プロファイルの更新（LLMで「AIエージェント系が好き」等を抽出）
 * - スコアリングプロンプトへの反映（フィルタリング時に過去の感想を参照）
 * - ソース品質の評価
 * 
 * NOTE: UX未完成 - フィードバックがどう反映されるかユーザーに見えない状態
 */
async function handleFeedback(
  message: any,
  type: "good" | "bad" | "comment" | "general",
  url: string | undefined,
  rawContent: string
) {
  // TODO: DBにfeedbackテーブルを作って保存
  // 今はログ出力のみ
  console.log(`📝 Feedback [${type}]: ${url || "(no URL)"} - "${rawContent}"`);

  if (type === "good" && url) {
    await message.reply(`👍 Thanks! Noted that you liked this article.`);
  } else if (type === "bad" && url) {
    await message.reply(`👎 Got it. Will try to filter similar content.`);
  } else if (type === "comment" && url) {
    await message.reply(`📝 Thanks for the feedback!`);
  } else if (type === "general") {
    await message.reply(`📝 Thanks! Your feedback helps improve recommendations.`);
  } else {
    await message.reply(`🤔 Please include a URL: \`good [URL]\` or \`bad [URL]\``);
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("❌ DISCORD_BOT_TOKEN not set");
  process.exit(1);
}

client.login(token);

export { client };
