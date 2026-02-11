import { getCategoryColor } from "../lib/category";

interface FilterBarProps {
  sources: string[];
  categories: string[];
  currentSource?: string;
  currentCategory?: string;
}

function buildFilterUrl(source?: string, category?: string): string {
  const params = new URLSearchParams();
  if (source) params.set("source", source);
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export const FilterBar = ({
  sources,
  categories,
  currentSource,
  currentCategory,
}: FilterBarProps) => {
  const hasFilters = currentSource || currentCategory;

  return (
    <div class="mb-8 space-y-4">
      {/* Source filter */}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-text-muted uppercase tracking-wider mr-1">
          Source
        </span>
        <a
          href={buildFilterUrl(undefined, currentCategory)}
          class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            !currentSource
              ? "bg-accent text-white shadow-sm"
              : "bg-bg-secondary text-text-secondary hover:bg-bg-card hover:text-text-primary"
          }`}
        >
          All
        </a>
        {sources.map((source) => (
          <a
            key={source}
            href={buildFilterUrl(source, currentCategory)}
            class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
              source === currentSource
                ? "bg-accent text-white shadow-sm"
                : "bg-bg-secondary text-text-secondary hover:bg-bg-card hover:text-text-primary hover:shadow-sm"
            }`}
          >
            {source}
          </a>
        ))}
      </div>

      {/* Category filter */}
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-medium text-text-muted uppercase tracking-wider mr-1">
          Category
        </span>
        <a
          href={buildFilterUrl(currentSource, undefined)}
          class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
            !currentCategory
              ? "bg-accent text-white shadow-sm"
              : "bg-bg-secondary text-text-secondary hover:bg-bg-card hover:text-text-primary"
          }`}
        >
          All
        </a>
        {categories.map((category) => {
          const color = getCategoryColor(category);
          const isActive = category === currentCategory;
          return (
            <a
              key={category}
              href={buildFilterUrl(currentSource, category)}
              class={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                isActive ? "shadow-sm" : "opacity-70 hover:opacity-100 hover:shadow-sm"
              }`}
              style={{
                backgroundColor: color.bg,
                color: color.text,
              }}
            >
              {category}
            </a>
          );
        })}
      </div>

      {/* Clear filter - shown inline when filters active */}
      {hasFilters && (
        <div class="pt-2">
          <a
            href="/"
            class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-accent transition-colors"
          >
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            フィルターをクリア
          </a>
        </div>
      )}
    </div>
  );
};
