export interface ArticleToSummarize {
  title: string;
  url: string;
  source: string;
  category: string;
  content?: string;
  published?: Date;
}

export interface SummarizedArticle extends ArticleToSummarize {
  summary: string;
}

/**
 * Check if the content is meaningful enough to generate a good summary
 * Returns true if content has substantial information beyond just the title
 */
function hasSubstantialContent(article: ArticleToSummarize): boolean {
  const content = article.content?.trim() || "";
  // No content at all
  if (!content) return false;
  // Content is just HN Score/comments (not enough for meaningful summary)
  if (content.match(/^HN Score:\s*\d+点(、\d+コメント)?$/)) return false;
  // Very short content (less than 50 chars) - but allow HN metadata
  if (content.length < 50) return false;
  return true;
}

/**
 * Check if the generated summary is low quality and should be replaced with original title
 */
function isLowQualitySummary(summary: string, title: string): boolean {
  if (!summary || summary.trim() === "") return true;

  // Generic fallback phrases that indicate insufficient information
  const lowQualityPatterns = [
    /^詳細は記事参照$/,
    /^詳細は記事を参照$/,
    /^記事を参照$/,
    /詳細は記事参照$/,  // Even if it's just appended
    /^.{0,10}詳細は記事参照$/,  // Very short text + fallback
    /^新しい.{0,20}が(発表|公開|リリース)された?$/,  // Generic "new X released"
    /^.{0,20}について(の記事|解説|紹介)$/,  // Generic "about X"
  ];

  for (const pattern of lowQualityPatterns) {
    if (pattern.test(summary)) return true;
  }

  // If summary is mostly just repeating the title (similarity check)
  const normalizedSummary = summary.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "");
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/g, "");

  if (normalizedTitle.length > 10) {
    // Check if summary is just a subset or superset of title without new info
    if (normalizedSummary === normalizedTitle) return true;
    // Check high overlap
    const overlap = [...normalizedSummary].filter(c => normalizedTitle.includes(c)).length;
    const overlapRatio = overlap / Math.max(normalizedSummary.length, 1);
    if (overlapRatio > 0.8 && normalizedSummary.length < normalizedTitle.length * 1.3) {
      return true;
    }
  }

  return false;
}

export async function summarizeArticles(
  articles: ArticleToSummarize[],
  apiKey: string
): Promise<SummarizedArticle[]> {
  if (!apiKey || articles.length === 0) {
    return articles.map((a) => ({ ...a, summary: "" }));
  }

  // Skip Japanese articles (tech-jp) - they don't need summarization
  const toSummarize = articles.filter((a) => a.category !== "tech-jp");

  if (toSummarize.length === 0) {
    return articles.map((a) => ({ ...a, summary: "" }));
  }

  // Separate articles with substantial content from title-only articles
  const withContent = toSummarize.filter(a => hasSubstantialContent(a));
  const titleOnly = toSummarize.filter(a => !hasSubstantialContent(a));

  // For title-only articles, use original title + supplementary info if available
  const titleOnlySummaries = new Map<string, string>();
  for (const article of titleOnly) {
    let summary = article.title;

    // Add HN metrics as supplementary info
    const hnMatch = article.content?.match(/^HN Score:\s*(\d+)点(、(\d+)コメント)?$/);
    if (hnMatch && hnMatch[1]) {
      const score = parseInt(hnMatch[1], 10);
      const comments = hnMatch[3] ? parseInt(hnMatch[3], 10) : 0;
      // Only add if score is significant (indicates community interest)
      if (score >= 100 || comments >= 50) {
        const parts = [];
        if (score >= 100) parts.push(`${score}pt`);
        if (comments >= 50) parts.push(`${comments}comments`);
        summary = `${article.title} (${parts.join(", ")})`;
      }
    }

    titleOnlySummaries.set(article.url, summary);
  }

  // If no articles with content, return all with titles
  if (withContent.length === 0) {
    return articles.map((a) => ({
      ...a,
      summary: a.category === "tech-jp" ? "" : (titleOnlySummaries.get(a.url) || a.title),
    }));
  }

  const prompt = `あなたはテック記事の要約者です。各記事について、読者が「この記事を読むべきか」判断できる要約を日本語で生成してください。

## 要約のルール
- 1文、最大100文字
- タイトルの言い換えではなく、本文から得られる具体的な情報を含める
- 以下のいずれかを必ず含める：
  - 具体的な数値・成果（例：「30%高速化」「GPT-4を超える精度」）
  - 技術的な新規性（例：「従来のTransformerを使わず」「Rustで再実装」）
  - 実用的な影響（例：「本番環境で使用可能」「MITライセンスで公開」）
  - 対象者・ユースケース（例：「大規模データ向け」「モバイル特化」）

## 重要：情報不足時の対応
- 本文から具体的な情報が得られない場合は、元のタイトルをそのまま返してください
- 「詳細は記事参照」という表現は絶対に使わないでください
- 曖昧な要約よりも、元のタイトルの方が有用です

## 悪い例と良い例
悪い: 「新しいAIモデルが発表された」（タイトルの言い換え）→ 元タイトルを使用
悪い: 「詳細は記事参照」（情報ゼロ）→ 元タイトルを使用
良い: 「Llamaベースで推論速度2倍、8GBメモリで動作可能」（具体的価値）

悪い: 「Reactの新機能について解説」（何もわからない）→ 元タイトルを使用
良い: 「Server Componentsでバンドルサイズ40%削減、既存コードとの互換性あり」（判断材料）

Articles:
${withContent.map((a, i) => `[${i}] Title: ${a.title}\nSource: ${a.source}\nContent: ${a.content?.slice(0, 800) || "(本文なし)"}`).join("\n\n")}

JSON配列のみで回答（他のテキストは一切不要）:
[{"index": 0, "summary": "日本語の要約（情報不足なら元タイトルをそのまま）"}, ...]`;

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
      console.error(`Summary API error: ${res.status}`);
      // On API error, return original titles as summaries for non-Japanese articles
      return articles.map((a) => ({
        ...a,
        summary: a.category === "tech-jp" ? "" : (titleOnlySummaries.get(a.url) || a.title),
      }));
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "[]";
    const jsonMatch = content.match(/\[.*\]/s);

    if (jsonMatch) {
      const summaries: { index: number; summary: string }[] = JSON.parse(
        jsonMatch[0]
      );

      // Build a map of URL -> summary for articles with content
      const summaryMap = new Map<string, string>();
      withContent.forEach((a, i) => {
        const found = summaries.find((s) => s.index === i);
        if (found) {
          // Quality check: if summary is low quality, use original title
          if (isLowQualitySummary(found.summary, a.title)) {
            summaryMap.set(a.url, a.title);
          } else {
            summaryMap.set(a.url, found.summary);
          }
        } else {
          // No summary generated, use original title
          summaryMap.set(a.url, a.title);
        }
      });

      // Return all articles with summaries
      // - Japanese articles get empty summary (displayed as-is)
      // - Title-only articles use original title
      // - Articles with content use generated summary (or title if low quality)
      return articles.map((a) => {
        if (a.category === "tech-jp") {
          return { ...a, summary: "" };
        }
        // Check title-only first, then summary map
        const summary = titleOnlySummaries.get(a.url) || summaryMap.get(a.url) || a.title;
        return { ...a, summary };
      });
    }
  } catch (error) {
    console.error("Summary error", error);
  }

  // On error, return original titles as summaries for non-Japanese articles
  return articles.map((a) => ({
    ...a,
    summary: a.category === "tech-jp" ? "" : a.title,
  }));
}
