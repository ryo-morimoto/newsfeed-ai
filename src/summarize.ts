export interface ArticleToSummarize {
  title: string;
  url: string;
  content?: string;
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

  const prompt = `各記事を日本語で1文（最大80文字）で要約してください。何が新しいか・重要かに焦点を当ててください。

Articles:
${articles.map((a, i) => `[${i}] ${a.title}\n${a.content?.slice(0, 300) || ""}`).join("\n\n")}

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
      return articles.map((a, i) => ({
        ...a,
        summary: summaries.find((s) => s.index === i)?.summary || "",
      }));
    }
  } catch (error) {
    console.error("Summary error", error);
  }

  return articles.map((a) => ({ ...a, summary: "" }));
}
