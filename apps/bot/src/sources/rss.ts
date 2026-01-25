import Parser from "rss-parser";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "NewsBot/1.0",
  },
});

export interface FeedItem {
  title: string;
  url: string;
  published?: Date;
  content?: string;
}

export async function fetchRss(feedUrl: string): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);

    return feed.items
      .map((item) => ({
        title: item.title || "No title",
        url: item.link || item.guid || "",
        published: item.pubDate ? new Date(item.pubDate) : undefined,
        content: item.contentSnippet || item.content || "",
      }))
      .filter((item) => item.url);
  } catch (error) {
    console.error(`Failed to fetch RSS: ${feedUrl}`, error);
    return [];
  }
}
