import { Layout } from "../components/Layout";
import { getCategoryColor } from "../lib/category";
import type { Article } from "@newsfeed-ai/core/db";

interface ArticlePageProps {
  article: Article;
}

export const ArticlePage = ({ article }: ArticlePageProps) => {
  const categoryColor = getCategoryColor(article.category);
  const date = article.created_at
    ? new Date(article.created_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  let keyPoints: string[] = [];
  if (article.key_points) {
    try {
      keyPoints = JSON.parse(article.key_points);
    } catch {
      keyPoints = [];
    }
  }

  return (
    <Layout title={`${article.title} - Newsfeed AI`}>
      <div class="max-w-4xl mx-auto px-6 py-8 animate-fade-in-up">
        <nav aria-label="Breadcrumb" class="mb-6">
          <a href="/" class="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <span class="i-lucide-arrow-left w-4 h-4" aria-hidden="true"></span>
            記事一覧に戻る
          </a>
        </nav>

        <article>
          <header class="mb-8">
            <div class="flex items-center gap-3 mb-4">
              <span
                class="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
              >
                {article.category}
              </span>
              <span class="text-sm text-text-muted">{article.source}</span>
            </div>

            <h1 class="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary leading-tight mb-4">
              {article.title}
            </h1>

            <div class="flex items-center gap-4 text-sm text-text-muted">
              {date && <time datetime={article.created_at || ""}>{date}</time>}
            </div>
          </header>

          {article.summary && (
            <section class="mb-8 p-6 bg-bg-secondary rounded-xl border-l-4 border-accent">
              <h2 class="text-lg font-semibold text-text-primary mb-3">要約</h2>
              <p class="text-text-secondary leading-relaxed text-lg">{article.summary}</p>
            </section>
          )}

          {article.detailed_summary && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">詳細解説</h2>
              <div class="space-y-4">
                {article.detailed_summary.split("\n").filter(Boolean).map((paragraph, i) => (
                  <p key={i} class="text-text-primary leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {keyPoints.length > 0 && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">ポイント</h2>
              <ul class="space-y-3">
                {keyPoints.map((point, i) => (
                  <li key={i} class="flex items-start gap-3 text-text-primary">
                    <span class="i-lucide-check-circle w-5 h-5 text-success flex-shrink-0 mt-0.5" aria-hidden="true"></span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {article.target_audience && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">対象読者</h2>
              <p class="text-text-secondary italic">{article.target_audience}</p>
            </section>
          )}

          <footer class="pt-8 border-t border-border">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              元の記事を読む
              <span class="i-lucide-external-link w-4 h-4" aria-hidden="true"></span>
            </a>
          </footer>
        </article>
      </div>
    </Layout>
  );
};

export const NotFoundPage = () => {
  return (
    <Layout title="Article Not Found - Newsfeed AI">
      <div class="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 class="text-6xl font-bold text-text-muted mb-4">404</h1>
        <p class="text-text-secondary mb-8">記事が見つかりませんでした</p>
        <a
          href="/"
          class="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          <span class="i-lucide-arrow-left w-4 h-4" aria-hidden="true"></span>
          記事一覧に戻る
        </a>
      </div>
    </Layout>
  );
};
