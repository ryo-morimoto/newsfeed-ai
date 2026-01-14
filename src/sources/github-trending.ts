export interface TrendingRepo {
  title: string;
  url: string;
  description: string;
  stars: number;
  language: string;
}

export async function fetchGitHubTrending(
  languages: string[] = ["typescript", "rust", "go"]
): Promise<TrendingRepo[]> {
  const results: TrendingRepo[] = [];

  for (const lang of languages) {
    try {
      const res = await fetch(
        `https://github.com/trending/${lang}?since=daily`,
        {
          headers: {
            "User-Agent": "NewsBot/1.0",
            Accept: "text/html",
          },
        }
      );

      const html = await res.text();

      // Simple regex parsing for trending repos
      const repoPattern =
        /<article class="Box-row">.*?<a href="(\/[^"]+)"[^>]*>.*?<\/a>.*?<p class="[^"]*">([^<]*)<\/p>.*?<\/article>/gs;

      // More targeted patterns
      const articles = html.split('<article class="Box-row">');

      for (const article of articles.slice(1, 6)) {
        // Top 5 per language
        // Extract repo URL
        const urlMatch = article.match(/href="(\/[^\/]+\/[^\/"]+)"/);
        if (!urlMatch) continue;

        const repoPath = urlMatch[1];
        const repoUrl = `https://github.com${repoPath}`;
        const repoName = repoPath.slice(1); // Remove leading /

        // Extract description
        const descMatch = article.match(
          /<p class="col-9[^"]*">\s*([^<]+?)\s*<\/p>/
        );
        const description = descMatch
          ? descMatch[1].trim()
          : "No description";

        // Extract stars (today)
        const starsMatch = article.match(
          /(\d[\d,]*)\s*stars\s*today/i
        );
        const stars = starsMatch
          ? parseInt(starsMatch[1].replace(/,/g, ""))
          : 0;

        results.push({
          title: repoName,
          url: repoUrl,
          description,
          stars,
          language: lang,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch GitHub trending for ${lang}`, error);
    }
  }

  return results;
}
