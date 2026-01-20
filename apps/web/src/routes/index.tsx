import { createFileRoute } from "@tanstack/react-router";
import { fetchArticles } from "~/lib/server-fns";
import { getCategoryColor } from "~/lib/category";
import type { Article } from "~/lib/db";

export const Route = createFileRoute("/")({
  loader: async () => {
    const articles = await fetchArticles();
    return { articles };
  },
  head: () => ({
    meta: [{ title: "Newsfeed AI - 記事一覧" }],
  }),
  component: IndexPage,
});

function ArticleCard({ article }: { article: Article }) {
  const categoryColor = getCategoryColor(article.category);
  const encodedUrl = encodeURIComponent(article.url);

  return (
    <div className="card">
      <div className="card-header">
        <span
          className="badge"
          style={{
            backgroundColor: categoryColor.bg,
            color: categoryColor.text,
          }}
        >
          {article.category}
        </span>
        <span className="source">{article.source}</span>
      </div>
      <h2 className="card-title">
        <a href={`/article/${encodedUrl}`}>{article.title}</a>
      </h2>
      {article.summary && <p className="card-summary">{article.summary}</p>}
      <div className="card-footer">
        <span className="date">
          {article.created_at
            ? new Date(article.created_at).toLocaleDateString("ja-JP")
            : ""}
        </span>
        <a href={`/article/${encodedUrl}`} className="read-more">
          詳細を読む →
        </a>
      </div>
    </div>
  );
}

function IndexPage() {
  const { articles } = Route.useLoaderData();

  return (
    <div className="container">
      <div className="page-header">
        <h1>記事一覧</h1>
        <p className="subtitle">
          詳細要旨が生成された記事 ({articles.length}件)
        </p>
      </div>

      {articles.length === 0 ? (
        <div className="empty-state">
          <p>詳細要旨が生成された記事はまだありません。</p>
        </div>
      ) : (
        <div className="card-grid">
          {articles.map((article) => (
            <ArticleCard key={article.url} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
