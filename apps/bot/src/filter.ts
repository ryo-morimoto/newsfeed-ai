import { getInterests } from "./config";

export interface ArticleToFilter {
  title: string;
  url: string;
  source: string;
  category: string;
  content?: string;
  published?: Date;
  og_image?: string;
}

export type OriginalityLevel = "high" | "medium" | "low";
export type NoveltyLevel = "high" | "medium" | "low";

export interface FilteredArticle extends ArticleToFilter {
  score: number;
  reason: string;
  originality?: OriginalityLevel;
  novelty?: NoveltyLevel;
}

// Freshness decay settings
const FRESHNESS_DECAY_PER_DAY = 0.1; // 10% score reduction per day
const FRESHNESS_MIN_FACTOR = 0.3; // Minimum 30% of original score
const MAX_AGE_DAYS = 14; // Articles older than this are excluded

/**
 * Calculate freshness factor based on article age.
 * Newer articles get higher scores, older articles get penalized.
 */
function calculateFreshnessFactor(published?: Date): number {
  if (!published) {
    // If no publish date, assume it's relatively fresh (factor 0.8)
    return 0.8;
  }

  const now = new Date();
  const ageInMs = now.getTime() - published.getTime();
  const ageInDays = ageInMs / (1000 * 60 * 60 * 24);

  // Articles older than MAX_AGE_DAYS get excluded (return 0)
  if (ageInDays > MAX_AGE_DAYS) {
    return 0;
  }

  // Linear decay: 1.0 at day 0, decreasing by DECAY_PER_DAY each day
  // Minimum is FRESHNESS_MIN_FACTOR
  const factor = Math.max(FRESHNESS_MIN_FACTOR, 1 - ageInDays * FRESHNESS_DECAY_PER_DAY);

  return factor;
}

async function getInterestsPrompt(): Promise<string> {
  const interests = await getInterests();
  return interests.map((i) => `- ${i}`).join("\n");
}

const RATE_LIMIT_DELAY_MS = 6000; // 6 seconds between batches (Groq free tier: 12k TPM)

async function processBatch(
  batch: ArticleToFilter[],
  apiKey: string,
  interestsPrompt: string
): Promise<FilteredArticle[]> {
  const prompt = `You are filtering news articles for a developer focused on AI agents, LLMOps, and production deployment.

## Scoring Priorities (in order of importance):
1. **Practical production experience** (highest value): "how we built", "lessons learned", production post-mortems, real metrics from deployments, trial-and-error stories
2. **Self-improving agents**: recursive improvement, meta-learning, agent evolution, Gödel Agent, SICA, self-evolving systems
3. **Agent metrics & observability**: evaluation frameworks, monitoring in production, tracing, task completion rates, LLM-as-judge
4. **Last-mile problems**: prototype-to-production challenges, deployment failures, cost optimization, context pollution fixes

## Originality & Novelty Evaluation (CRITICAL for blog posts):
**Originality** (独自性): Does the article provide unique insights, original analysis, or first-hand experience?
- HIGH: Author's own experiments, unique data, original research, proprietary insights
- MEDIUM: Synthesis of multiple sources with new perspective
- LOW: Rehashing well-known information, summarizing others' work without adding value

**Novelty** (新規性): Does the article cover new developments, recent findings, or emerging topics?
- HIGH: Breaking news, new techniques, recent discoveries, cutting-edge approaches
- MEDIUM: Updates to existing knowledge, new applications of known methods
- LOW: Already widely covered topics, basic tutorials without new angles

Articles lacking BOTH originality AND novelty impose cognitive load without providing value - score them LOW.

## Score Boosters (+0.15 each):
- Contains specific metrics/numbers from real production use
- Describes failures, debugging, or trial-and-error process
- From practitioner blog (Simon Willison, Latent Space, etc.) vs news site
- Discusses agent evaluation methodology or metrics design
- Deep technical content about agent internals or LLMOps
- **Original research or first-hand experimental results**
- **Novel technique or approach not widely documented**

## Score Reducers (-0.15 each):
- Generic product announcement without technical depth
- Marketing content, listicles, or superficial overviews
- Game/entertainment releases (unless AI/agent related)
- Cryptocurrency price/market news (keep DeFi tech only)
- **Rehashing commonly known information without new insights**
- **Content that duplicates what's already widely available**
- **Basic explanations of well-established concepts**

## User Interests:
${interestsPrompt}

## Articles to evaluate:
${batch.map((a, idx) => `[${idx}] ${a.title} (${a.source}) - ${a.content?.slice(0, 300) || "no description"}`).join("\n")}

Respond with JSON array only:
[{"index": 0, "score": 0.8, "originality": "high", "novelty": "medium", "reason": "practical production experience with metrics"}, ...]

originality/novelty values: "high", "medium", or "low"
Only include articles with score >= 0.5`;

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
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Groq API error: ${res.status}`, errorText);
      return batch.map((a) => ({ ...a, score: 0.5, reason: "api error" }));
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content || "[]";

    const jsonMatch = content.match(/\[.*\]/s);
    if (!jsonMatch) {
      return [];
    }

    const scored: {
      index: number;
      score: number;
      reason: string;
      originality?: OriginalityLevel;
      novelty?: NoveltyLevel;
    }[] = JSON.parse(jsonMatch[0]);
    return scored
      .filter((s): s is typeof s & { index: number } => batch[s.index] !== undefined && s.score >= 0.5)
      .map((s) => {
        const article = batch[s.index]!;
        return {
          title: article.title,
          url: article.url,
          source: article.source,
          category: article.category,
          content: article.content,
          published: article.published,
          og_image: article.og_image,
          score: s.score,
          reason: s.reason,
          originality: s.originality,
          novelty: s.novelty,
        };
      });
  } catch (error) {
    console.error("Filter error", error);
    return batch.map((a) => ({ ...a, score: 0.5, reason: "error" }));
  }
}

async function processWithRateLimit<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  processor: (batch: T[]) => Promise<R[]>
): Promise<R[]> {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  const results = await batches.reduce<Promise<R[]>>(async (accPromise, batch, index) => {
    const acc = await accPromise;
    if (index > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
    const batchResults = await processor(batch);
    return [...acc, ...batchResults];
  }, Promise.resolve([]));

  return results;
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

  const interestsPrompt = await getInterestsPrompt();

  const results = await processWithRateLimit(articles, 10, RATE_LIMIT_DELAY_MS, (batch) =>
    processBatch(batch, apiKey, interestsPrompt)
  );

  // Apply freshness factor
  const withFreshness = results.map((article) => {
    const freshnessFactor = calculateFreshnessFactor(article.published);
    return {
      ...article,
      score: article.score * freshnessFactor,
      originalScore: article.score,
      freshnessFactor,
    };
  });

  // Filter out articles that are too old and sort by adjusted score
  return withFreshness.filter((a) => a.freshnessFactor > 0).toSorted((a, b) => b.score - a.score);
}
