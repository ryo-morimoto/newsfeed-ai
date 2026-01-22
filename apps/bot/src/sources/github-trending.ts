export interface TrendingRepo {
  title: string;
  url: string;
  description: string;
  stars: number;
  language: string;
}

function parseReposFromHtml(html: string, lang: string): TrendingRepo[] {
  const repos: TrendingRepo[] = [];
  const articles = html.split('<article class="Box-row">');

  for (const article of articles.slice(1, 6)) {
    // Top 5 per language
    const urlMatch = article.match(/href="(\/[^/]+\/[^/"]+)"/);
    if (!urlMatch?.[1]) continue;

    const repoPath = urlMatch[1];
    const repoUrl = `https://github.com${repoPath}`;
    const repoName = repoPath.slice(1); // Remove leading /

    const descMatch = article.match(/<p class="col-9[^"]*">\s*([^<]+?)\s*<\/p>/);
    const description = descMatch?.[1]?.trim() ?? "No description";

    const starsMatch = article.match(/(\d[\d,]*)\s*stars\s*today/i);
    const stars = starsMatch?.[1] ? parseInt(starsMatch[1].replace(/,/g, "")) : 0;

    repos.push({
      title: repoName,
      url: repoUrl,
      description,
      stars,
      language: lang,
    });
  }

  return repos;
}

async function fetchTrendingForLanguage(lang: string): Promise<TrendingRepo[]> {
  try {
    const res = await fetch(`https://github.com/trending/${lang}?since=daily`, {
      headers: {
        "User-Agent": "NewsBot/1.0",
        Accept: "text/html",
      },
    });
    const html = await res.text();
    return parseReposFromHtml(html, lang);
  } catch (error) {
    console.error(`Failed to fetch GitHub trending for ${lang}`, error);
    return [];
  }
}

export async function fetchGitHubTrending(
  languages: string[] = ["typescript", "rust", "go"]
): Promise<TrendingRepo[]> {
  const results = await Promise.all(languages.map(fetchTrendingForLanguage));
  return results.flat();
}
