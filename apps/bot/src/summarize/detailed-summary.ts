/**
 * 詳細要旨生成機能
 * 論文やテック記事のコンテンツを深く読み込んで、詳細な要旨を生成する
 */

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
  shortSummary: string;   // 1-2文の短い要約（既存の要約）
  detailedSummary: string; // 詳細な要旨（5-10文）
  keyPoints: string[];     // 重要ポイントのリスト
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
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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
    // コンテンツが取得できない場合は基本情報のみ返す
    return {
      title: article.title,
      url: article.url,
      source: article.source,
      category: article.category,
      shortSummary: article.summary || article.title,
      detailedSummary: "コンテンツを取得できませんでした。元の記事をご確認ください。",
      keyPoints: [],
      fetchedAt: new Date(),
    };
  }

  const prompt = `あなたは技術記事・論文の要旨作成の専門家です。以下の記事の内容を分析し、詳細な要旨を作成してください。

## 記事情報
タイトル: ${article.title}
ソース: ${article.source}
カテゴリ: ${article.category}

## 記事本文
${content.slice(0, 12000)}

## 出力形式（JSON）
{
  "detailedSummary": "詳細な要旨（5-10文、300-500文字程度）。記事の主要な内容、提案手法、結果、意義を含める。技術的な詳細も適度に含める。",
  "keyPoints": ["重要ポイント1（50文字以内）", "重要ポイント2", ...（3-5個）],
  "targetAudience": "この記事が役立つ対象読者（例：機械学習エンジニア、フロントエンド開発者など）"
}

## 注意事項
- 日本語で出力してください
- 具体的な数値や手法名があれば含めてください
- 「詳細は記事参照」のような曖昧な表現は避けてください
- JSONのみを出力してください`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 2048,
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
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

      return {
        title: article.title,
        url: article.url,
        source: article.source,
        category: article.category,
        shortSummary: article.summary || article.title,
        detailedSummary: parsed.detailedSummary || "要旨を生成できませんでした。",
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

function createFallbackResult(
  article: {
    title: string;
    url: string;
    source: string;
    category: string;
    summary?: string;
  },
  content: string
): DetailedSummaryResult {
  // コンテンツの最初の500文字を要旨として使用
  const fallbackSummary = content.slice(0, 500) + (content.length > 500 ? "..." : "");

  return {
    title: article.title,
    url: article.url,
    source: article.source,
    category: article.category,
    shortSummary: article.summary || article.title,
    detailedSummary: fallbackSummary || "要旨を生成できませんでした。",
    keyPoints: [],
    fetchedAt: new Date(),
  };
}
