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

  const prompt = `Summarize each article in 1 short sentence (max 80 chars). Focus on what's new/important.

Articles:
${articles.map((a, i) => `[${i}] ${a.title}\n${a.content?.slice(0, 300) || ""}`).join("\n\n")}

Respond with JSON array only:
[{"index": 0, "summary": "brief summary"}, ...]`;

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
