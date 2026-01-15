/**
 * Natural language web search using Perplexity API
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source?: string;
}

export interface WebSearchResponse {
  query: string;
  summary: string;
  results: WebSearchResult[];
  citations: string[];
}

/**
 * Perform a natural language web search using Perplexity API
 */
export async function webSearch(
  query: string,
  apiKey?: string
): Promise<WebSearchResponse> {
  const key = apiKey || process.env.PERPLEXITY_API_KEY;

  if (!key) {
    throw new Error("PERPLEXITY_API_KEY not set");
  }

  const systemPrompt = `You are a helpful assistant that searches the web for tech news and information.
When answering, always:
1. Provide a concise summary (2-3 sentences) of the search results
2. Focus on technical accuracy and recent information
3. Prioritize authoritative sources (official docs, tech blogs, news sites)

For Japanese queries, respond in Japanese. For English queries, respond in English.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      max_tokens: 1024,
      temperature: 0.2,
      return_citations: true,
      return_related_questions: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };

  const content = data.choices?.[0]?.message?.content || "";
  const citations = data.citations || [];

  // Parse citations into structured results
  const results: WebSearchResult[] = citations.map((url, index) => ({
    title: extractTitleFromUrl(url),
    url,
    snippet: "",
    source: extractDomainFromUrl(url),
  }));

  return {
    query,
    summary: content,
    results,
    citations,
  };
}

/**
 * Search with Groq API as fallback (uses web search via function calling)
 * This is a backup when Perplexity is not available
 */
export async function webSearchWithGroq(
  query: string,
  apiKey?: string
): Promise<WebSearchResponse> {
  const key = apiKey || process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("GROQ_API_KEY not set");
  }

  // Groq doesn't have native web search, so we use it to generate a search-optimized query
  // and provide general knowledge. For actual web search, Perplexity is recommended.
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a tech knowledge assistant. Answer questions about technology, programming, and software development.
Respond in the same language as the query.
If you don't have recent information, mention that the user should verify from official sources.
Format your response as a concise summary (2-3 sentences).`,
        },
        { role: "user", content: query },
      ],
      max_tokens: 512,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content || "";

  return {
    query,
    summary: content + "\n\n⚠️ This response is based on training data and may not reflect the latest information. For real-time web search, set PERPLEXITY_API_KEY.",
    results: [],
    citations: [],
  };
}

/**
 * Smart search that uses Perplexity if available, falls back to Groq
 */
export async function smartSearch(query: string): Promise<WebSearchResponse> {
  if (process.env.PERPLEXITY_API_KEY) {
    return webSearch(query);
  }

  if (process.env.GROQ_API_KEY) {
    return webSearchWithGroq(query);
  }

  throw new Error("No API key available. Set PERPLEXITY_API_KEY or GROQ_API_KEY.");
}

// Helper functions
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      // Convert slug to title
      return lastPart
        .replace(/[-_]/g, " ")
        .replace(/\.\w+$/, "") // Remove extension
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }
    return urlObj.hostname;
  } catch {
    return url;
  }
}

function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
