export interface ArticleToSummarize {
  title: string;
  url: string;
  content?: string;
  category?: string;
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

  const prompt = `各記事を日本語で1文（最大80文字）で要約してください。何が新しいか・重要かに焦点を当ててください。

Articles:
${toSummarize.map((a, i) => `[${i}] ${a.title}\n${a.content?.slice(0, 300) || ""}`).join("\n\n")}

JSON配列のみで回答:
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
        max_tokens: 1024,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`Summary API error: ${res.status}`);
      return articles.map((a) => ({ ...a, summary: "" }));
    }

    const data = await res.json();
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
