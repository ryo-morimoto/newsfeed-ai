/**
 * 詳細要旨ページのURL生成ユーティリティ
 */

// Base URL for generating links - must be configured via env
const BASE_URL = process.env.ARTICLE_SERVER_URL || "";

/**
 * Generate the article detail page URL for Discord links
 * Returns empty string if ARTICLE_SERVER_URL is not configured
 */
export function getArticleDetailUrl(articleUrl: string): string {
  if (!BASE_URL) return "";
  const encoded = encodeURIComponent(articleUrl);
  return `${BASE_URL}/article/${encoded}`;
}
