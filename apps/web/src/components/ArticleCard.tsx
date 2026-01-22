import { useState } from 'react'
import { getCategoryColor } from '~/lib/category'

// Minimal article fields needed for card display
interface ArticleForCard {
  url: string
  title: string
  summary?: string | null
  category: string
  source: string
  created_at?: string | null
  og_image?: string | null
}

interface ArticleCardProps {
  article: ArticleForCard
  featured?: boolean
}

/**
 * Generate wsrv.nl proxy URL for OG images
 * Provides caching, resizing, and WebP conversion
 */
function getProxiedImageUrl(ogImage: string, width: number, height: number): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(ogImage)}&w=${width}&h=${height}&fit=cover&output=webp`
}

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const categoryColor = getCategoryColor(article.category)
  const encodedUrl = encodeURIComponent(article.url)
  const [imageError, setImageError] = useState(false)
  const date = article.created_at
    ? new Date(article.created_at).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : ''

  // Determine image dimensions based on featured status
  const imageWidth = featured ? 800 : 400
  const imageHeight = featured ? 400 : 200
  const hasOgImage = article.og_image && !imageError

  return (
    <article
      className={`
        group relative bg-bg-card rounded-xl border border-border
        transition-all duration-200 ease-out
        hover:translate-y-[-4px] hover:shadow-lg
        h-full flex flex-col
        ${featured ? 'md:col-span-2 md:row-span-2' : ''}
      `}
      aria-labelledby={`article-title-${encodedUrl}`}
    >
      {/* Thumbnail - OG image or gradient fallback */}
      <div
        className={`h-32 rounded-t-xl shrink-0 overflow-hidden ${featured ? 'md:h-48' : ''}`}
        style={!hasOgImage ? {
          background: `linear-gradient(135deg, ${categoryColor.bg}40, ${categoryColor.bg}20)`,
        } : undefined}
        aria-hidden="true"
      >
        {hasOgImage && (
          <img
            src={getProxiedImageUrl(article.og_image!, imageWidth, imageHeight)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageError(true)}
          />
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span
            className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: categoryColor.bg,
              color: categoryColor.text,
            }}
          >
            {article.category}
          </span>
          <span className="text-xs text-text-muted">
            {article.source}
          </span>
        </div>

        {/* Title */}
        <h2
          id={`article-title-${encodedUrl}`}
          className={`
            font-bold leading-snug mb-3 text-text-primary
            group-hover:text-accent transition-colors line-clamp-3
            ${featured ? 'text-xl md:text-2xl' : 'text-lg'}
          `}
        >
          <a
            href={`/article/${encodedUrl}`}
            className="after:absolute after:inset-0"
          >
            {article.title}
          </a>
        </h2>

        {/* Summary */}
        {article.summary && (
          <p
            className={`
              text-text-secondary leading-relaxed mb-4 line-clamp-3
              ${featured ? 'text-base md:line-clamp-4' : 'text-sm'}
            `}
          >
            {article.summary}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
          <time
            dateTime={article.created_at || ''}
            className="text-xs text-text-muted"
          >
            {date}
          </time>
          <span className="text-sm font-medium text-accent group-hover:underline">
            詳細を読む
            <span className="sr-only">: {article.title}</span>
          </span>
        </div>
      </div>
    </article>
  )
}
