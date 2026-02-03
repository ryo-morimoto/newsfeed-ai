export interface TrendingRepo {
  title: string;
  url: string;
  description: string;
  stars: number;
  language: string;
}

interface ArticleState {
  url: string | null;
  title: string | null;
  description: string;
  starsText: string;
}

export async function parseTrendingHtml(
  html: string,
  language: string
): Promise<TrendingRepo[]> {
  const repos: TrendingRepo[] = [];
  let current: ArticleState | null = null;
  let inH2 = false;

  function finalize() {
    if (!current?.url || !current?.title) return;
    const starsMatch = current.starsText.match(/([\d,]+)\s*stars?\s*today/i);
    const stars = starsMatch?.[1]
      ? parseInt(starsMatch[1].replace(/,/g, ""))
      : 0;
    repos.push({
      title: current.title,
      url: current.url,
      description: current.description.trim() || "No description",
      stars,
      language,
    });
  }

  const rewriter = new HTMLRewriter()
    .on("article.Box-row", {
      element() {
        finalize();
        current = { url: null, title: null, description: "", starsText: "" };
        inH2 = false;
      },
    })
    .on("h2", {
      element(el) {
        inH2 = true;
        el.onEndTag(() => {
          inH2 = false;
        });
      },
    })
    .on("a[href]", {
      element(el) {
        if (!current || !inH2 || current.url) return;
        const href = el.getAttribute("href");
        if (!href) return;
        const segments = href.split("/").filter(Boolean);
        if (segments.length !== 2) return;
        if (href.startsWith("/sponsors/") || href.startsWith("/login")) return;
        current.url = `https://github.com${href}`;
        current.title = segments.join("/");
      },
    })
    .on("p.col-9", {
      text(chunk) {
        if (current) current.description += chunk.text;
      },
    })
    .on("span.d-inline-block.float-sm-right", {
      text(chunk) {
        if (current) current.starsText += chunk.text;
      },
    });

  await rewriter.transform(new Response(html)).text();
  finalize();

  return repos;
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

      if (!res.ok) {
        console.error(
          `GitHub trending returned ${res.status} for ${lang}`
        );
        continue;
      }

      const html = await res.text();
      const repos = await parseTrendingHtml(html, lang);

      if (repos.length === 0) {
        console.warn(`No trending repos parsed for ${lang}`);
      }

      results.push(...repos);
    } catch (error) {
      console.error(`Failed to fetch GitHub trending for ${lang}`, error);
    }
  }

  return results;
}
