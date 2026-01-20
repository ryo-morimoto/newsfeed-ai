import { createCategoryEmbeds, createArticleEmbeds, createDigestEmbed, type DiscordEmbed } from "./discord/discord-embed";
import type { NotifyArticle } from "./discord/notify";
import { getCategoryEmoji } from "./config";

// Sample data for preview
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

const sampleArticles: NotifyArticle[] = [
  {
    title: "Claude 4 Released with Enhanced Coding Capabilities",
    url: "https://example.com/claude-4",
    summary: "Anthropic releases Claude 4 with significant improvements in code generation",
    category: "ai",
    source: "Hacker News",
    published: now,
  },
  {
    title: "Next.js 15 Introduces Server Actions 2.0",
    url: "https://example.com/nextjs-15",
    summary: "Vercel announces Next.js 15 with enhanced server actions and improved DX",
    category: "frontend",
    source: "Vercel Blog",
    published: yesterday,
  },
  {
    title: "Rust 2.0 RFC Published",
    url: "https://example.com/rust-2",
    summary: "The Rust team publishes RFC for Rust 2.0 with async improvements",
    category: "tech",
    source: "Lobsters",
    published: twoDaysAgo,
  },
  {
    title: "Laravel 12 Released with AI Integration",
    url: "https://example.com/laravel-12",
    summary: "Laravel 12 brings native AI/ML integration for PHP developers",
    category: "backend",
    source: "Laravel News",
    published: threeDaysAgo,
  },
  {
    title: "bun - JavaScript runtime with bundler",
    url: "https://github.com/oven-sh/bun",
    summary: "All-in-one JS runtime with fast bundler (★2,500 today)",
    category: "repos",
    source: "GitHub (TypeScript)",
    published: now,
  },
  {
    title: "Bitcoin ETFの承認がWeb3に与える影響",
    url: "https://example.com/bitcoin-etf-jp",
    summary: "Bitcoin ETF approval impact on Web3",
    category: "crypto",
    source: "CoinDesk",
    published: yesterday,
  },
  {
    title: "Bunで始めるモダンTypeScript開発",
    url: "https://zenn.dev/example",
    summary: "",
    category: "tech-jp",
    source: "Zenn",
    published: now,
  },
];

// Convert Discord embed to HTML for preview
function embedToHtml(embed: DiscordEmbed): string {
  const colorHex = embed.color ? `#${embed.color.toString(16).padStart(6, "0")}` : "#5865f2";
  
  let html = `<div class="embed" style="border-left-color: ${colorHex}">`;
  
  if (embed.title) {
    if (embed.url) {
      html += `<div class="embed-title"><a href="${embed.url}" target="_blank">${escapeHtml(embed.title)}</a></div>`;
    } else {
      html += `<div class="embed-title">${escapeHtml(embed.title)}</div>`;
    }
  }
  
  if (embed.description) {
    // Convert markdown links to HTML
    const desc = embed.description
      .replace(/\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g, '<strong><a href="$2" target="_blank">$1</a></strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/└/g, '<span class="tree-line">└</span>')
      .replace(/\n/g, '<br>');
    html += `<div class="embed-description">${desc}</div>`;
  }
  
  if (embed.fields && embed.fields.length > 0) {
    html += '<div class="embed-fields">';
    for (const field of embed.fields) {
      const value = field.value
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
      html += `
        <div class="embed-field${field.inline ? ' inline' : ''}">
          <div class="embed-field-name">${escapeHtml(field.name)}</div>
          <div class="embed-field-value">${value}</div>
        </div>
      `;
    }
    html += '</div>';
  }
  
  if (embed.footer || embed.timestamp) {
    html += '<div class="embed-footer">';
    if (embed.footer) {
      html += `<span>${escapeHtml(embed.footer.text)}</span>`;
    }
    if (embed.timestamp) {
      const date = new Date(embed.timestamp).toLocaleString();
      html += `<span class="timestamp">${date}</span>`;
    }
    html += '</div>';
  }
  
  html += '</div>';
  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Generate full preview page
function generatePreviewPage(format: string): string {
  let embeds: DiscordEmbed[];
  let formatName: string;
  
  switch (format) {
    case 'category':
      embeds = createCategoryEmbeds(sampleArticles);
      formatName = 'Category Grouped';
      break;
    case 'article':
      embeds = createArticleEmbeds(sampleArticles);
      formatName = 'Individual Articles';
      break;
    case 'digest':
    default:
      embeds = createDigestEmbed(sampleArticles);
      formatName = 'Daily Digest';
      break;
  }
  
  const embedsHtml = embeds.map(embedToHtml).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discord Feed Preview</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background: #313338;
      color: #dbdee1;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    h1 {
      color: #fff;
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .format-selector {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    
    .format-btn {
      padding: 8px 16px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-size: 14px;
      text-decoration: none;
      background: #4e5058;
      color: #dbdee1;
      transition: background 0.2s;
    }
    
    .format-btn:hover {
      background: #6d6f78;
    }
    
    .format-btn.active {
      background: #5865f2;
      color: #fff;
    }
    
    .discord-preview {
      background: #313338;
      border-radius: 8px;
      padding: 10px 0;
    }
    
    .embed {
      background: #2b2d31;
      border-left: 4px solid #5865f2;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 8px 0;
      max-width: 520px;
    }
    
    .embed-title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
    }
    
    .embed-title a {
      color: #00aff4;
      text-decoration: none;
    }
    
    .embed-title a:hover {
      text-decoration: underline;
    }
    
    .embed-description {
      font-size: 14px;
      line-height: 1.5;
      color: #dbdee1;
    }
    
    .embed-description a {
      color: #00aff4;
      text-decoration: none;
    }
    
    .embed-description a:hover {
      text-decoration: underline;
    }
    
    .embed-description code {
      background: #1e1f22;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', monospace;
      font-size: 12px;
    }
    
    .embed-description .tree-line {
      color: #6d6f78;
    }
    
    .embed-fields {
      margin-top: 12px;
    }
    
    .embed-field {
      margin-bottom: 12px;
    }
    
    .embed-field.inline {
      display: inline-block;
      width: 45%;
      vertical-align: top;
      margin-right: 5%;
    }
    
    .embed-field-name {
      font-size: 14px;
      font-weight: 600;
      color: #dbdee1;
      margin-bottom: 4px;
    }
    
    .embed-field-value {
      font-size: 14px;
      color: #b5bac1;
      line-height: 1.5;
    }
    
    .embed-field-value a {
      color: #00aff4;
      text-decoration: none;
    }
    
    .embed-field-value a:hover {
      text-decoration: underline;
    }
    
    .embed-footer {
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #3f4147;
      font-size: 12px;
      color: #b5bac1;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    
    .embed-footer .timestamp {
      color: #6d6f78;
    }
    
    .json-preview {
      background: #1e1f22;
      border-radius: 8px;
      padding: 16px;
      margin-top: 20px;
      overflow-x: auto;
    }
    
    .json-preview h3 {
      color: #fff;
      font-size: 14px;
      margin: 0 0 12px 0;
    }
    
    .json-preview pre {
      margin: 0;
      font-family: 'Consolas', monospace;
      font-size: 12px;
      color: #b5bac1;
      white-space: pre-wrap;
      word-break: break-all;
    }
    
    .info-text {
      font-size: 13px;
      color: #b5bac1;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>👀 Discord Feed Preview</h1>
    <p class="info-text">Compare different embed formats for the news bot</p>
    
    <div class="format-selector">
      <a href="?format=digest" class="format-btn${format === 'digest' ? ' active' : ''}">Daily Digest</a>
      <a href="?format=category" class="format-btn${format === 'category' ? ' active' : ''}">Category Grouped</a>
      <a href="?format=article" class="format-btn${format === 'article' ? ' active' : ''}">Individual Articles</a>
    </div>
    
    <h2 style="color: #fff; font-size: 16px; margin-bottom: 10px;">📱 Format: ${formatName}</h2>
    
    <div class="discord-preview">
      ${embedsHtml}
    </div>
    
    <div class="json-preview">
      <h3>📦 JSON Payload</h3>
      <pre>${escapeHtml(JSON.stringify({ embeds }, null, 2))}</pre>
    </div>
  </div>
</body>
</html>`;
}

// Start preview server
const port = 8000;

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    const format = url.searchParams.get('format') || 'digest';
    
    const html = generatePreviewPage(format);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  },
});

console.log(`🚀 Preview server running at http://localhost:${port}`);
console.log(`🌐 External: https://moon-peak.exe.xyz:${port}/`);
