/**
 * 論文詳細要旨Web UIサーバー
 * 論文の詳細要旨をブラウザで確認できるサービス
 */

import { generateDetailedSummary, type DetailedSummaryResult } from "./detailed-summary";
import { getCategoryEmoji } from "./config";
import { getArticleDetailUrl } from "./article-url";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const PORT = 8001;

// Base URL for generating links (can be overridden by env)
const BASE_URL = process.env.ARTICLE_SERVER_URL || `https://moon-peak.exe.xyz:${PORT}`;

// Simple in-memory cache to avoid re-fetching
const cache = new Map<string, { result: DetailedSummaryResult; cachedAt: Date }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Re-export for convenience
export { getArticleDetailUrl };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Category colors matching Discord embed colors
const categoryColors: Record<string, string> = {
  ai: "#8b5cf6",       // Purple
  tech: "#3b82f6",     // Blue
  frontend: "#06b6d4", // Cyan
  backend: "#f97316",  // Orange
  repos: "#22c55e",    // Green
  crypto: "#eab308",   // Yellow
  "tech-jp": "#ef4444", // Red
  gaming: "#ec4899",   // Pink
};

function generateArticlePage(result: DetailedSummaryResult, loading: boolean = false): string {
  const color = categoryColors[result.category] || "#6b7280";
  const emoji = getCategoryEmoji(result.category);

  const keyPointsHtml = result.keyPoints.length > 0
    ? `
      <div class="key-points">
        <h3>Key Points</h3>
        <ul>
          ${result.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const targetAudienceHtml = result.targetAudience
    ? `
      <div class="target-audience">
        <h3>Target Audience</h3>
        <p>${escapeHtml(result.targetAudience)}</p>
      </div>
    `
    : "";

  const loadingIndicator = loading
    ? `<div class="loading"><div class="spinner"></div><p>詳細要旨を生成中...</p></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(result.title)} - 詳細要旨</title>
  <meta name="description" content="${escapeHtml(result.shortSummary)}">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', Roboto, sans-serif;
      background: #1a1b1e;
      color: #e4e4e7;
      line-height: 1.7;
      min-height: 100vh;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 24px 20px;
    }

    .header {
      margin-bottom: 32px;
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      background: ${color}20;
      border: 1px solid ${color}40;
      border-radius: 16px;
      font-size: 13px;
      color: ${color};
      margin-bottom: 16px;
    }

    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 14px;
      color: #a1a1aa;
    }

    .meta a {
      color: #60a5fa;
      text-decoration: none;
    }

    .meta a:hover {
      text-decoration: underline;
    }

    .card {
      background: #27272a;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
    }

    .card h2, .card h3 {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .short-summary {
      background: #18181b;
      border-left: 4px solid ${color};
      padding: 16px 20px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 20px;
      font-size: 15px;
    }

    .detailed-summary {
      font-size: 15px;
      color: #d4d4d8;
      white-space: pre-wrap;
    }

    .key-points ul {
      list-style: none;
      padding: 0;
    }

    .key-points li {
      position: relative;
      padding-left: 24px;
      margin-bottom: 10px;
      font-size: 14px;
    }

    .key-points li::before {
      content: ">";
      position: absolute;
      left: 0;
      color: ${color};
      font-weight: bold;
    }

    .target-audience p {
      font-size: 14px;
      color: #a1a1aa;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: ${color};
      color: #fff;
    }

    .btn-primary:hover {
      filter: brightness(1.1);
    }

    .btn-secondary {
      background: #3f3f46;
      color: #e4e4e7;
    }

    .btn-secondary:hover {
      background: #52525b;
    }

    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #3f3f46;
      font-size: 13px;
      color: #71717a;
      text-align: center;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #a1a1aa;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #3f3f46;
      border-top-color: ${color};
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-card {
      background: #450a0a;
      border: 1px solid #7f1d1d;
    }

    .error-card h2 {
      color: #fca5a5;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="category-badge">
        <span>${emoji}</span>
        <span>${escapeHtml(result.category.toUpperCase())}</span>
      </div>
      <h1>${escapeHtml(result.title)}</h1>
      <div class="meta">
        <span>Source: ${escapeHtml(result.source)}</span>
        <span>|</span>
        <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener">Open Original Article</a>
      </div>
    </div>

    ${loadingIndicator}

    ${!loading ? `
    <div class="short-summary">
      ${escapeHtml(result.shortSummary)}
    </div>

    <div class="card">
      <h2>Detailed Summary</h2>
      <div class="detailed-summary">${escapeHtml(result.detailedSummary)}</div>
    </div>

    ${keyPointsHtml}

    ${targetAudienceHtml}

    <div class="actions">
      <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener" class="btn btn-primary">
        Read Full Article
      </a>
      <a href="javascript:history.back()" class="btn btn-secondary">
        Back
      </a>
    </div>
    ` : ""}

    <div class="footer">
      Generated by News Bot | ${result.fetchedAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
    </div>
  </div>
</body>
</html>`;
}

function generateErrorPage(error: string, url?: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error - Article Summary</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', Roboto, sans-serif;
      background: #1a1b1e;
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .error-container {
      text-align: center;
      padding: 40px;
    }
    h1 {
      font-size: 24px;
      color: #fca5a5;
      margin-bottom: 16px;
    }
    p {
      color: #a1a1aa;
      margin-bottom: 24px;
    }
    a {
      color: #60a5fa;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="error-container">
    <h1>Error</h1>
    <p>${escapeHtml(error)}</p>
    ${url ? `<p><a href="${escapeHtml(url)}" target="_blank">Try opening the original article</a></p>` : ""}
    <p><a href="javascript:history.back()">Go Back</a></p>
  </div>
</body>
</html>`;
}

function generateIndexPage(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Summary Service</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', Roboto, sans-serif;
      background: #1a1b1e;
      color: #e4e4e7;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #a1a1aa;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    .usage {
      background: #27272a;
      border-radius: 12px;
      padding: 24px;
    }
    .usage h2 {
      font-size: 16px;
      margin-bottom: 12px;
    }
    code {
      background: #18181b;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 13px;
      color: #60a5fa;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Article Summary Service</h1>
    <p>
      This service generates detailed summaries for tech articles and papers.
      Access via Discord feed links or use the API directly.
    </p>
    <div class="usage">
      <h2>Usage</h2>
      <p>
        <code>GET /article?url=ENCODED_ARTICLE_URL</code>
      </p>
      <p>
        The service will fetch the article content, generate a detailed summary using AI,
        and display it in a readable format.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Start server
if (!GROQ_API_KEY) {
  console.error("GROQ_API_KEY environment variable is required");
  process.exit(1);
}

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Index page
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(generateIndexPage(), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Article detail page
    if (url.pathname === "/article") {
      const articleUrl = url.searchParams.get("url");

      if (!articleUrl) {
        return new Response(generateErrorPage("Article URL is required"), {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Check cache
      const cached = cache.get(articleUrl);
      if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
        console.log(`Cache hit for: ${articleUrl}`);
        return new Response(generateArticlePage(cached.result), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Extract article info from URL (basic metadata)
      const articleInfo = {
        title: decodeURIComponent(articleUrl.split("/").pop() || "Article"),
        url: articleUrl,
        source: new URL(articleUrl).hostname,
        category: guessCategory(articleUrl),
      };

      console.log(`Generating detailed summary for: ${articleUrl}`);

      try {
        const result = await generateDetailedSummary(articleInfo, GROQ_API_KEY);

        // Update cache
        cache.set(articleUrl, { result, cachedAt: new Date() });

        return new Response(generateArticlePage(result), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      } catch (error) {
        console.error("Error generating summary:", error);
        return new Response(
          generateErrorPage("Failed to generate summary. Please try again.", articleUrl),
          {
            status: 500,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", cached: cache.size }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 404
    return new Response(generateErrorPage("Page not found"), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  },
});

/**
 * Guess category from URL
 */
function guessCategory(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes("arxiv.org")) return "ai";
  if (urlLower.includes("huggingface.co")) return "ai";
  if (urlLower.includes("github.com")) return "repos";
  if (urlLower.includes("vercel.com") || urlLower.includes("react") || urlLower.includes("nextjs")) return "frontend";
  if (urlLower.includes("laravel") || urlLower.includes("php")) return "backend";
  if (urlLower.includes("zenn.dev") || urlLower.includes("qiita.com")) return "tech-jp";
  if (urlLower.includes("coindesk") || urlLower.includes("bitcoin") || urlLower.includes("crypto")) return "crypto";
  return "tech";
}

console.log(`Article summary server running at http://localhost:${PORT}`);
console.log(`External: ${BASE_URL}/`);
