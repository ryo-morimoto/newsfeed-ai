import { createFileRoute, notFound } from "@tanstack/react-router";
import { fetchArticle } from "~/lib/server-fns";
import { getCategoryColor } from "~/lib/category";

export const Route = createFileRoute("/article/$url")({
  loader: async ({ params }) => {
    const url = decodeURIComponent(params.url);
    // @ts-expect-error TanStack Start typing issue
    const article = await fetchArticle({ data: url });
    if (!article) {
      throw notFound();
    }
    return { article };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.article?.title || "記事詳細 - Newsfeed AI" },
      {
        name: "description",
        content: loaderData?.article?.summary || "記事の詳細要旨",
      },
    ],
  }),
  component: ArticlePage,
  notFoundComponent: NotFoundPage,
});

function NotFoundPage() {
  return (
    <div className="container">
      <div className="not-found">
        <h1>404</h1>
        <p>記事が見つかりませんでした</p>
        <a href="/" className="btn">
          ← 記事一覧に戻る
        </a>
      </div>
    </div>
  );
}

function ArticlePage() {
  const { article } = Route.useLoaderData();
  const categoryColor = getCategoryColor(article.category);

  let keyPoints: string[] = [];
  if (article.key_points) {
    try {
      keyPoints = JSON.parse(article.key_points);
    } catch {
      keyPoints = [];
    }
  }

  return (
    <div className="container">
      <div className="breadcrumb">
        <a href="/">← 記事一覧に戻る</a>
      </div>

      <article className="article-detail">
        <header className="article-header">
          <span
            className="badge badge-lg"
            style={{
              backgroundColor: categoryColor.bg,
              color: categoryColor.text,
            }}
          >
            {article.category}
          </span>
          <h1>{article.title}</h1>
          <div className="article-meta">
            <span className="source">出典: {article.source}</span>
            {article.created_at && (
              <span className="date">
                {new Date(article.created_at).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        </header>

        {article.summary && (
          <section className="summary-section">
            <h2>概要</h2>
            <p className="summary-text">{article.summary}</p>
          </section>
        )}

        {article.detailed_summary && (
          <section className="detailed-section">
            <h2>詳細要旨</h2>
            <div className="detailed-text">
              {article.detailed_summary.split("\n").map((paragraph: string, i: number) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </section>
        )}

        {keyPoints.length > 0 && (
          <section className="keypoints-section">
            <h2>キーポイント</h2>
            <ul className="keypoints-list">
              {keyPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </section>
        )}

        {article.target_audience && (
          <section className="audience-section">
            <h2>対象読者</h2>
            <p>{article.target_audience}</p>
          </section>
        )}

        <footer className="article-footer">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            元記事を読む ↗
          </a>
        </footer>
      </article>
    </div>
  );
}
