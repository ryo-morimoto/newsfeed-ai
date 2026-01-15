/**
 * 詳細要旨ページのURL生成ユーティリティ
 */

const PORT = 8001;

// Base URL for generating links (can be overridden by env)
const BASE_URL = process.env.ARTICLE_SERVER_URL || `https://moon-peak.exe.xyz:${PORT}`;

/**
 * Generate the article detail page URL for Discord links
 */
export function getArticleDetailUrl(articleUrl: string): string {
  const encoded = encodeURIComponent(articleUrl);
  return `${BASE_URL}/article?url=${encoded}`;
}
