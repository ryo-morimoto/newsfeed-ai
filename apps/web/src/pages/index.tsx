import { Layout } from "../components/Layout";
import { ArticleCard } from "../components/ArticleCard";
import type { Article } from "@newsfeed-ai/core/db";

interface IndexPageProps {
  articles: Article[];
}

export const IndexPage = ({ articles }: IndexPageProps) => {
  return (
    <Layout title="Newsfeed AI - 記事一覧">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <header class="mb-8">
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">記事一覧</h1>
          <p class="text-text-secondary">詳細要旨が生成された記事 ({articles.length}件)</p>
        </header>

        {articles.length === 0 ? (
          <div class="text-center py-16 text-text-muted">
            <p>詳細要旨が生成された記事はまだありません。</p>
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
