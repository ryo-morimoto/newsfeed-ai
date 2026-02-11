/**
 * 詳細要旨生成機能
 * 論文やテック記事のコンテンツを深く読み込んで、詳細な要旨を生成する
 */

import { RateLimitError } from "../utils/retry";

/** Maximum URL length for OG images (avoid abnormally long URLs) */
const MAX_OG_IMAGE_URL_LENGTH = 2048;

export interface FetchArticleResult {
  content: string;
  ogImage: string | null;
}
export interface DetailedSummaryResult {
  title: string;
  url: string;
  source: string;
  category: string;
  shortSummary: string; // 1-2文の短い要約（既存の要約）
  detailedSummary: string; // 詳細な要旨（5-10文）
  keyPoints: string[]; // 重要ポイントのリスト
  targetAudience?: string; // 対象読者
  fetchedAt: Date;
}

/**
 * HTMLからog:image URLを抽出する
 */
function extractOgImage(html: string): string | null {
  // <meta property="og:image" content="..."> を抽出
  const ogImageMatch = html.match(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogImageMatch && ogImageMatch[1]) {
    const url = ogImageMatch[1];
    // URL長制限チェック
    if (url.length <= MAX_OG_IMAGE_URL_LENGTH) {
      return url;
    }
  }

  // 逆順のパターンも試す: <meta content="..." property="og:image">
  const reverseMatch = html.match(
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
  );
  if (reverseMatch && reverseMatch[1]) {
    const url = reverseMatch[1];
    if (url.length <= MAX_OG_IMAGE_URL_LENGTH) {
      return url;
    }
  }

  return null;
}

/**
 * URLからコンテンツとOG画像を取得する
 */
export async function fetchArticleContentWithOgImage(url: string): Promise<FetchArticleResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NewsBot/1.0 (Article Summary Service)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.error(`Failed to fetch article: ${response.status}`);
      return { content: "", ogImage: null };
    }

    const html = await response.text();

    // HTMLからテキストを抽出
    const content = extractTextFromHtml(html);
    // OG画像を抽出
    const ogImage = extractOgImage(html);

    return { content, ogImage };
  } catch (error) {
    console.error(`Error fetching article content: ${error}`);
    return { content: "", ogImage: null };
  }
}

/**
 * URLからコンテンツを取得する (後方互換性のため維持)
 */
export async function fetchArticleContent(url: string): Promise<string> {
  const result = await fetchArticleContentWithOgImage(url);
  return result.content;
}

/**
 * HTMLからメインコンテンツのテキストを抽出
 */
function extractTextFromHtml(html: string): string {
  // scriptとstyleタグを除去
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "");

  // article, main, または content クラスの内容を優先
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);

  if (articleMatch && articleMatch[1]) {
    text = articleMatch[1];
  } else if (mainMatch && mainMatch[1]) {
    text = mainMatch[1];
  }

  // HTMLタグを除去
  text = text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  // 最大文字数を制限（トークン節約）
  return text.slice(0, 15000);
}

/**
 * 詳細要旨を生成する
 */
export async function generateDetailedSummary(
  article: {
    title: string;
    url: string;
    source: string;
    category: string;
    summary?: string;
  },
  apiKey: string
): Promise<DetailedSummaryResult> {
  const content = await fetchArticleContent(article.url);

  if (!content || content.length < 100) {
    // コンテンツが取得できない場合は空を返して後で再試行
    console.warn(
      `[detailed-summary] Content too short (${content?.length || 0} chars), will retry later: ${article.url}`
    );
    return createFallbackResult(article, content || "");
  }

  const systemPrompt = `あなたは日本語で技術記事を要約する専門家です。
すべての出力は必ず日本語で行ってください。英語での出力は絶対に禁止です。
技術用語（API、LLM、GPUなど）はそのまま使用できますが、説明文は必ず日本語です。`;

  const userPrompt = `以下の記事の詳細な要旨を日本語で作成してください。

## 記事情報
タイトル: ${article.title}
ソース: ${article.source}
カテゴリ: ${article.category}

## 記事本文
${content.slice(0, 12000)}

## 出力形式（必ずこのJSON形式で日本語出力）
{
  "detailedSummary": "詳細な要旨を日本語で5-10文、300-500文字程度で記述。記事の主要な内容、提案手法、結果、意義を含める。",
  "keyPoints": ["重要ポイント1を日本語で（50文字以内）", "重要ポイント2を日本語で", "重要ポイント3を日本語で"],
  "targetAudience": "対象読者を日本語で記述（例：機械学習エンジニア、フロントエンド開発者）"
}

## 重要な注意事項
- 【必須】すべての値を日本語で出力すること。英語での出力は不可。
- 技術用語はそのまま使用可能（例：LLM、API、GPU）
- 具体的な数値や手法名があれば含める
- 「詳細は記事参照」のような曖昧な表現は避ける
- JSONのみを出力`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 30_000;
        throw new RateLimitError(retryAfterMs);
      }
      console.error(`Detailed summary API error: ${res.status}`);
      return createFallbackResult(article, content);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const responseContent = data.choices?.[0]?.message?.content || "{}";

    // JSONを抽出
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as {
        detailedSummary?: string;
        keyPoints?: string[];
        targetAudience?: string;
      };

      const summary = parsed.detailedSummary || "";

      // Validate that the summary is in Japanese
      if (!containsJapanese(summary)) {
        console.warn(
          `[detailed-summary] Generated summary is not in Japanese, returning empty for retry: ${article.url}`
        );
        return createFallbackResult(article, content);
      }

      return {
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        shortSummary: article.summary || article.title,
        detailedSummary: summary,
        keyPoints: parsed.keyPoints || [],
        targetAudience: parsed.targetAudience,
        fetchedAt: new Date(),
      };
    }
  } catch (error) {
    console.error("Detailed summary generation error:", error);
  }

  return createFallbackResult(article, content);
}

/**
 * Check if text contains substantial Japanese characters
 * Returns true if at least 10% of the text is Japanese
 */
function containsJapanese(text: string): boolean {
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g;
  const matches = text.match(japaneseRegex);
  if (!matches) return false;
  // At least 10% should be Japanese characters for a meaningful Japanese summary
  return matches.length >= text.length * 0.1;
}

function createFallbackResult(
  article: {
    title: string;
    url: string;
    source: string;
    category: string;
    summary?: string;
  },
  _content: string
): DetailedSummaryResult {
  // Return empty summary to allow retry later by background job
  // Don't use English content fallback as it won't be useful for Japanese users
  return {
    title: article.title,
    url: article.url,
    source: article.source,
    category: article.category,
    shortSummary: article.summary || article.title,
    detailedSummary: "", // Empty to trigger retry later
    keyPoints: [],
    fetchedAt: new Date(),
  };
}
