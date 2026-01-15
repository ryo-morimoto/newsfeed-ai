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

  const prompt = `あなたはテック記事の要約者です。各記事について、読者が「この記事を読むべきか」判断できる要約を日本語で生成してください。

## 要約のルール
- 1文、最大100文字
- タイトルの言い換えではなく、本文から得られる具体的な情報を含める
- 以下のいずれかを必ず含める：
  - 具体的な数値・成果（例：「30%高速化」「GPT-4を超える精度」）
  - 技術的な新規性（例：「従来のTransformerを使わず」「Rustで再実装」）
  - 実用的な影響（例：「本番環境で使用可能」「MITライセンスで公開」）
  - 対象者・ユースケース（例：「大規模データ向け」「モバイル特化」）
- 情報が不足している場合のみ「詳細は記事参照」と補足

## 悪い例と良い例
悪い: 「新しいAIモデルが発表された」（タイトルの言い換え）
良い: 「Llamaベースで推論速度2倍、8GBメモリで動作可能」（具体的価値）

悪い: 「Reactの新機能について解説」（何もわからない）
良い: 「Server Componentsでバンドルサイズ40%削減、既存コードとの互換性あり」（判断材料）

Articles:
${toSummarize.map((a, i) => `[${i}] ${a.title}\nSource: ${a.source}\n${a.content?.slice(0, 800) || "(本文なし)"}`).join("\n\n")}

JSON配列のみで回答（他のテキストは一切不要）:
[{"index": 0, "summary": "日本語の要約"}, ...]`;

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
      return articles.map((a) => ({ ...a, summary: "" }));
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

      // Build a map of URL -> summary for non-Japanese articles
      const summaryMap = new Map<string, string>();
      toSummarize.forEach((a, i) => {
        const found = summaries.find((s) => s.index === i);
        if (found) summaryMap.set(a.url, found.summary);
      });

      // Return all articles with summaries (Japanese articles get empty summary)
      return articles.map((a) => ({
        ...a,
        summary: a.category === "tech-jp" ? "" : (summaryMap.get(a.url) || ""),
      }));
    }
  } catch (error) {
    console.error("Summary error", error);
  }

  return articles.map((a) => ({ ...a, summary: "" }));
}
