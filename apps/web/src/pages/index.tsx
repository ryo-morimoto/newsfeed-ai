import { Layout } from "../components/Layout";
import { ArticleCard } from "../components/ArticleCard";
import { FilterBar } from "../components/FilterBar";
import type { Article } from "@newsfeed-ai/core/db";

interface IndexPageProps {
  articles: Article[];
  sources: string[];
  categories: string[];
  currentSource?: string;
  currentCategory?: string;
}

export const IndexPage = ({
  articles,
  sources,
  categories,
  currentSource,
  currentCategory,
}: IndexPageProps) => {
  const hasFilters = currentSource || currentCategory;
  return (
    <Layout title="Newsfeed AI - 記事一覧">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <header class="mb-8">
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">記事一覧</h1>
          <p class="text-text-secondary">
            詳細要旨が生成された記事 ({articles.length}件)
            {hasFilters && " - フィルター適用中"}
          </p>
        </header>

        <form method="get" action="/">
          <FilterBar
            sources={sources}
            categories={categories}
            currentSource={currentSource}
            currentCategory={currentCategory}
          />
        </form>

        {articles.length === 0 ? (
          <div class="text-center py-16 text-text-muted">
            {hasFilters ? (
              <p>条件に一致する記事がありません。</p>
            ) : (
              <p>詳細要旨が生成された記事はまだありません。</p>
            )}
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children auto-rows-fr">
            {articles.map((article, index) => (
              <ArticleCard key={article.url} article={article} featured={index === 0} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
