import { getCategoryColor } from "../lib/category";

interface ArticleForCard {
  url: string;
  title: string;
  summary?: string | null;
  category: string;
  source: string;
  created_at?: string | null;
  og_image?: string | null;
}

interface ArticleCardProps {
  article: ArticleForCard;
  featured?: boolean;
}

function getProxiedImageUrl(ogImage: string, width: number, height: number): string {
  return `https://wsrv.nl/?url=${encodeURIComponent(ogImage)}&w=${width}&h=${height}&fit=cover&output=webp`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const ArticleCard = ({ article, featured = false }: ArticleCardProps) => {
  const categoryColor = getCategoryColor(article.category);
  const encodedUrl = encodeURIComponent(article.url);
  const imageWidth = featured ? 800 : 400;
  const imageHeight = featured ? 400 : 200;
  const hasOgImage = !!article.og_image;

  return (
    <article
      class={`group relative bg-bg-card rounded-xl border border-border transition-all duration-200 ease-out hover:translate-y-[-4px] hover:shadow-lg h-full flex flex-col ${featured ? "md:col-span-2 md:row-span-2" : ""}`}
    >
      <div
        class={`h-32 rounded-t-xl shrink-0 overflow-hidden ${featured ? "md:h-48" : ""}`}
        style={!hasOgImage ? { background: `linear-gradient(135deg, ${categoryColor.bg}40, ${categoryColor.bg}20)` } : undefined}
      >
        {hasOgImage && (
          <img
            src={getProxiedImageUrl(article.og_image!, imageWidth, imageHeight)}
            alt=""
            class="w-full h-full object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div class="p-5 flex flex-col flex-1">
        <div class="flex items-center gap-2 mb-3">
          <span
            class="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
            style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
          >
            {article.category}
          </span>
          <span class="text-xs text-text-muted">{article.source}</span>
        </div>

        <h2 class={`font-bold leading-snug mb-3 text-text-primary group-hover:text-accent transition-colors line-clamp-3 ${featured ? "text-xl md:text-2xl" : "text-lg"}`}>
          <a href={`/article/${encodedUrl}`} class="after:absolute after:inset-0">
            {article.title}
          </a>
        </h2>

        {article.summary && (
          <p class={`text-text-secondary leading-relaxed mb-4 line-clamp-3 ${featured ? "text-base md:line-clamp-4" : "text-sm"}`}>
            {article.summary}
          </p>
        )}

        <div class="flex items-center justify-between pt-4 border-t border-border mt-auto">
          {article.created_at && (
            <time class="text-xs text-text-muted">{formatDate(article.created_at)}</time>
          )}
          <span class="text-sm font-medium text-accent group-hover:underline">詳細を読む</span>
        </div>
      </div>
    </article>
  );
};
