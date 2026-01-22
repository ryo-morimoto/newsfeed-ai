import { createFileRoute, notFound } from '@tanstack/react-router'
import { fetchArticle } from '~/lib/server-fns'
import { getCategoryColor } from '~/lib/category'

export const Route = createFileRoute('/article/$url')({
  loader: async ({ params }) => {
    const url = decodeURIComponent(params.url)
    const article = await fetchArticle({ data: url })
    if (!article) {
      throw notFound()
    }
    return { article }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.article
          ? `${loaderData.article.title} - Newsfeed AI`
          : 'Article Not Found - Newsfeed AI',
      },
    ],
  }),
  component: ArticleDetailPage,
  notFoundComponent: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 text-center">
      <h1 className="text-6xl font-bold text-text-muted mb-4">404</h1>
      <p className="text-text-secondary mb-8">
        記事が見つかりませんでした
      </p>
      <a
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
      >
        <span className="i-lucide-arrow-left w-4 h-4" aria-hidden="true" />
        記事一覧に戻る
      </a>
    </div>
  )
}

function ArticleDetailPage() {
  const { article } = Route.useLoaderData()
  const categoryColor = getCategoryColor(article.category)
  const date = article.created_at
    ? new Date(article.created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : ''

  let keyPoints: string[] = []
  if (article.key_points) {
    try {
      keyPoints = JSON.parse(article.key_points)
    } catch {
      keyPoints = []
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 animate-fade-in-up">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <span className="i-lucide-arrow-left w-4 h-4" aria-hidden="true" />
          記事一覧に戻る
        </a>
      </nav>

      <article>
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: categoryColor.bg,
                color: categoryColor.text,
              }}
            >
              {article.category}
            </span>
            <span className="text-sm text-text-muted">
              {article.source}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary leading-tight mb-4">
            {article.title}
          </h1>

          <div className="flex items-center gap-4 text-sm text-text-muted">
            {date && (
              <time dateTime={article.created_at || ''}>
                {date}
              </time>
            )}
          </div>
        </header>

        {/* Summary Section */}
        {article.summary && (
          <section
            className="mb-8 p-6 bg-bg-secondary rounded-xl border-l-4 border-accent"
            aria-labelledby="summary-heading"
          >
            <h2
              id="summary-heading"
              className="text-lg font-semibold text-text-primary mb-3"
            >
              要約
            </h2>
            <p className="text-text-secondary leading-relaxed text-lg">
              {article.summary}
            </p>
          </section>
        )}

        {/* Detailed Summary */}
        {article.detailed_summary && (
          <section className="mb-8" aria-labelledby="detail-heading">
            <h2
              id="detail-heading"
              className="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border"
            >
              詳細解説
            </h2>
            <div className="space-y-4">
              {article.detailed_summary.split('\n').filter(Boolean).map((paragraph: string, i: number) => (
                <p
                  key={i}
                  className="text-text-primary leading-relaxed"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Key Points */}
        {keyPoints.length > 0 && (
          <section className="mb-8" aria-labelledby="keypoints-heading">
            <h2
              id="keypoints-heading"
              className="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border"
            >
              ポイント
            </h2>
            <ul className="space-y-3">
              {keyPoints.map((point: string, i: number) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-text-primary"
                >
                  <span
                    className="i-lucide-check-circle w-5 h-5 text-success flex-shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Target Audience */}
        {article.target_audience && (
          <section className="mb-8" aria-labelledby="audience-heading">
            <h2
              id="audience-heading"
              className="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border"
            >
              対象読者
            </h2>
            <p className="text-text-secondary italic">
              {article.target_audience}
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-8 border-t border-border">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
          >
            元の記事を読む
            <span className="i-lucide-external-link w-4 h-4" aria-hidden="true" />
          </a>
        </footer>
      </article>
    </div>
  )
}
