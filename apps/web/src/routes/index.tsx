import { createFileRoute } from "@tanstack/react-router";
import { fetchArticles } from "~/lib/server-fns";
import { ArticleCard } from "~/components/ArticleCard";

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

function IndexPage() {
  const { articles } = Route.useLoaderData();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">記事一覧</h1>
        <p className="text-text-secondary">詳細要旨が生成された記事 ({articles.length}件)</p>
      </header>

      {articles.length === 0 ? (
        <div className="text-center py-16 text-text-muted">
          <p>詳細要旨が生成された記事はまだありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children auto-rows-fr">
          {articles.map((article, index) => (
            <ArticleCard key={article.url} article={article} featured={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
