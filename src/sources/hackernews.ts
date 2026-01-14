export interface HNItem {
  title: string;
  url: string;
  score: number;
  published?: Date;
}

interface HNStory {
  title?: string;
  url?: string;
  score?: number;
  time?: number;
}

const HN_API = "https://hacker-news.firebaseio.com/v0";

export async function fetchHackerNews(limit: number = 30): Promise<HNItem[]> {
  try {
    // Get top stories
    const res = await fetch(`${HN_API}/topstories.json`);
    const ids = (await res.json()) as number[];

    // Fetch details for top N stories
    const items = await Promise.all(
      ids.slice(0, limit).map(async (id) => {
        const itemRes = await fetch(`${HN_API}/item/${id}.json`);
        return (await itemRes.json()) as HNStory;
      })
    );

    return items
      .filter((item): item is HNStory & { url: string } => Boolean(item?.url))
      .map((item) => ({
        title: item.title || "No title",
        url: item.url,
        score: item.score || 0,
        published: item.time ? new Date(item.time * 1000) : undefined,
      }));
  } catch (error) {
    console.error("Failed to fetch Hacker News", error);
    return [];
  }
}
