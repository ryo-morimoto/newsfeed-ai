import { getInterests } from "./config";

export interface ArticleToFilter {
  title: string;
  url: string;
  source: string;
  category: string;
  content?: string;
}

export interface FilteredArticle extends ArticleToFilter {
  score: number;
  reason: string;
}

function getInterestsPrompt(): string {
  return getInterests().map((i) => `- ${i}`).join("\n");
}

export async function filterArticles(
  articles: ArticleToFilter[],
  apiKey: string
): Promise<FilteredArticle[]> {
  if (!apiKey) {
    console.log("No Groq API key, returning all articles unfiltered");
    return articles.map((a) => ({ ...a, score: 0.5, reason: "unfiltered" }));
  }

  if (articles.length === 0) return [];

  // Batch articles for efficiency
  const batchSize = 20;
  const results: FilteredArticle[] = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);

    const prompt = `You are filtering news articles for a developer. Score each article 0-1 based on relevance to these interests:
${getInterestsPrompt()}

Articles to evaluate:
${batch.map((a, idx) => `[${idx}] ${a.title} (${a.source}) - ${a.content?.slice(0, 200) || "no description"}`).join("\n")}

Respond with JSON array only, no explanation:
[{"index": 0, "score": 0.8, "reason": "brief reason"}, ...]

Only include articles with score >= 0.5`;

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
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Groq API error: ${res.status}`, errorText);
        results.push(
          ...batch.map((a) => ({ ...a, score: 0.5, reason: "api error" }))
        );
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "[]";

      // Parse JSON from response
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        const scored: { index: number; score: number; reason: string }[] =
          JSON.parse(jsonMatch[0]);

        for (const s of scored) {
          if (s.index >= 0 && s.index < batch.length && s.score >= 0.5) {
            results.push({
              ...batch[s.index],
              score: s.score,
              reason: s.reason,
            });
          }
        }
      }
    } catch (error) {
      console.error("Filter error", error);
      results.push(
        ...batch.map((a) => ({ ...a, score: 0.5, reason: "error" }))
      );
    }

    // Rate limit: small delay between batches
    if (i + batchSize < articles.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Sort by score
  return results.sort((a, b) => b.score - a.score);
}
