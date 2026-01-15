/**
 * 論文詳細要旨Web UIサーバー
 * DBから事前生成された詳細要旨を取得して即座に表示
 */

import { ensureDb, getArticleByUrl, getArticlesWithDetailedSummary, type Article } from "./db";
import { getCategoryEmoji } from "./config";
import { getArticleDetailUrl } from "./article-url";

const PORT = parseInt(process.env.ARTICLE_SERVER_PORT || "8001");

// Re-export for convenience
export { getArticleDetailUrl };

interface ArticleDisplay {
  title: string;
  url: string;
  source: string;
  category: string;
  shortSummary: string;
  detailedSummary: string;
  keyPoints: string[];
  targetAudience?: string;
  createdAt: Date;
}

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

function generateArticlePage(article: ArticleDisplay): string {
  const color = categoryColors[article.category] || "#6b7280";
  const emoji = getCategoryEmoji(article.category);

  const keyPointsHtml = article.keyPoints.length > 0
    ? `
      <div class="card">
        <h3>Key Points</h3>
        <ul class="key-points">
          ${article.keyPoints.map(point => `<li>${escapeHtml(point)}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  const targetAudienceHtml = article.targetAudience
    ? `
      <div class="card">
        <h3>Target Audience</h3>
        <p class="target-audience">${escapeHtml(article.targetAudience)}</p>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)} - 詳細要旨</title>
  <meta name="description" content="${escapeHtml(article.shortSummary)}">
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

    .key-points {
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

    .target-audience {
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
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="category-badge">
        <span>${emoji}</span>
        <span>${escapeHtml(article.category.toUpperCase())}</span>
      </div>
      <h1>${escapeHtml(article.title)}</h1>
      <div class="meta">
        <span>Source: ${escapeHtml(article.source)}</span>
        <span>|</span>
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener">元記事を開く</a>
      </div>
    </div>

    <div class="short-summary">
      ${escapeHtml(article.shortSummary)}
    </div>

    <div class="card">
      <h2>詳細要旨</h2>
      <div class="detailed-summary">${escapeHtml(article.detailedSummary)}</div>
    </div>

    ${keyPointsHtml}

    ${targetAudienceHtml}

    <div class="actions">
      <a href="${escapeHtml(article.url)}" target="_blank" rel="noopener" class="btn btn-primary">
        元記事を読む
      </a>
      <a href="javascript:history.back()" class="btn btn-secondary">
        戻る
      </a>
    </div>

    <div class="footer">
      Generated by News Bot | ${article.createdAt.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
    </div>
  </div>
</body>
</html>`;
}

function generateNotFoundPage(articleUrl: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>記事が見つかりません</title>
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
    .container {
      text-align: center;
      padding: 40px;
      max-width: 500px;
    }
    h1 {
      font-size: 24px;
      color: #fbbf24;
      margin-bottom: 16px;
    }
    p {
      color: #a1a1aa;
      margin-bottom: 24px;
      line-height: 1.6;
    }
    a {
      color: #60a5fa;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #3b82f6;
      color: #fff;
      border-radius: 8px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>詳細要旨がまだ生成されていません</h1>
    <p>
      この記事の詳細要旨はまだデータベースに保存されていません。
      次回のフィード更新時に生成される可能性があります。
    </p>
    <p>
      <a href="${escapeHtml(articleUrl)}" target="_blank" class="btn">元記事を直接読む</a>
    </p>
    <p style="margin-top: 24px;">
      <a href="javascript:history.back()">戻る</a>
    </p>
  </div>
</body>
</html>`;
}

function generateErrorPage(error: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error</title>
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
    .container {
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
  </style>
</head>
<body>
  <div class="container">
    <h1>Error</h1>
    <p>${escapeHtml(error)}</p>
    <p><a href="javascript:history.back()">戻る</a></p>
  </div>
</body>
</html>`;
}

function formatRelativeDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "たった今";
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays === 1) return "昨日";
  if (diffDays < 7) return `${diffDays}日前`;
  return date.toLocaleDateString("ja-JP");
}

function generateIndexPage(articles: Article[]): string {
  const articleListHtml = articles.length > 0
    ? articles.map(article => {
        const color = categoryColors[article.category] || "#6b7280";
        const emoji = getCategoryEmoji(article.category);
        const shortSummary = article.summary
          ? (article.summary.length > 80 ? article.summary.slice(0, 77) + "..." : article.summary)
          : "";
        const dateLabel = formatRelativeDate(article.created_at);
        const encodedUrl = encodeURIComponent(article.url);

        return `
          <a href="/article?url=${encodedUrl}" class="article-card">
            <div class="article-header">
              <span class="category-badge" style="background: ${color}20; border-color: ${color}40; color: ${color};">
                ${emoji} ${article.category.toUpperCase()}
              </span>
              <span class="date">${dateLabel}</span>
            </div>
            <h3 class="article-title">${escapeHtml(article.title)}</h3>
            ${shortSummary ? `<p class="article-summary">${escapeHtml(shortSummary)}</p>` : ""}
            <div class="article-meta">
              <span class="source">${escapeHtml(article.source)}</span>
            </div>
          </a>
        `;
      }).join("")
    : `<p class="no-articles">まだ記事がありません。フィード処理が実行されると記事が表示されます。</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Article Summary - 詳細要旨一覧</title>
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
      min-height: 100vh;
      margin: 0;
      padding: 24px 20px;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    header {
      margin-bottom: 32px;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .subtitle {
      color: #71717a;
      font-size: 14px;
    }

    .article-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .article-card {
      display: block;
      background: #27272a;
      border-radius: 12px;
      padding: 20px;
      text-decoration: none;
      color: inherit;
      transition: background 0.2s, transform 0.2s;
    }

    .article-card:hover {
      background: #3f3f46;
      transform: translateY(-2px);
    }

    .article-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .category-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 10px;
      border: 1px solid;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .date {
      font-size: 12px;
      color: #71717a;
    }

    .article-title {
      font-size: 16px;
      font-weight: 600;
      color: #fff;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .article-summary {
      font-size: 14px;
      color: #a1a1aa;
      line-height: 1.5;
      margin-bottom: 12px;
    }

    .article-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #71717a;
    }

    .source {
      background: #18181b;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .no-articles {
      text-align: center;
      color: #71717a;
      padding: 40px;
    }

    .stats {
      display: flex;
      gap: 24px;
      margin-bottom: 24px;
      padding: 16px;
      background: #27272a;
      border-radius: 8px;
    }

    .stat {
      text-align: center;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
    }

    .stat-label {
      font-size: 12px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Article Summary</h1>
      <p class="subtitle">テック記事・論文の詳細要旨</p>
    </header>

    <div class="stats">
      <div class="stat">
        <div class="stat-value">${articles.length}</div>
        <div class="stat-label">記事数</div>
      </div>
    </div>

    <div class="article-list">
      ${articleListHtml}
    </div>
  </div>
</body>
</html>`;
}

// Initialize database
ensureDb();

// Start server
Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Index page - show article list
    if (url.pathname === "/" || url.pathname === "") {
      const articles = getArticlesWithDetailedSummary(50);
      return new Response(generateIndexPage(articles), {
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

      // Fetch from DB
      const article = getArticleByUrl(articleUrl);

      if (!article) {
        return new Response(generateNotFoundPage(articleUrl), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      if (!article.detailed_summary) {
        return new Response(generateNotFoundPage(articleUrl), {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      // Parse key_points from JSON
      let keyPoints: string[] = [];
      if (article.key_points) {
        try {
          keyPoints = JSON.parse(article.key_points);
        } catch {
          keyPoints = [];
        }
      }

      const display: ArticleDisplay = {
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        shortSummary: article.summary || article.title,
        detailedSummary: article.detailed_summary,
        keyPoints,
        targetAudience: article.target_audience,
        createdAt: article.created_at ? new Date(article.created_at) : new Date(),
      };

      return new Response(generateArticlePage(display), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
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

console.log(`Article summary server running at http://localhost:${PORT}`);
