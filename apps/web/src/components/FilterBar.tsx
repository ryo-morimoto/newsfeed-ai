interface FilterBarProps {
  sources: string[];
  categories: string[];
  currentSource?: string;
  currentCategory?: string;
}

export const FilterBar = ({
  sources,
  categories,
  currentSource,
  currentCategory,
}: FilterBarProps) => {
  return (
    <div class="flex flex-wrap gap-4 mb-6 p-4 bg-bg-card rounded-lg border border-border">
      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-text-secondary" for="source-filter">
          ソース:
        </label>
        <select
          id="source-filter"
          name="source"
          class="px-3 py-1.5 rounded-md bg-bg-primary border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onchange="this.form.submit()"
        >
          <option value="">すべて</option>
          {sources.map((source) => (
            <option key={source} value={source} selected={source === currentSource}>
              {source}
            </option>
          ))}
        </select>
      </div>

      <div class="flex items-center gap-2">
        <label class="text-sm font-medium text-text-secondary" for="category-filter">
          カテゴリ:
        </label>
        <select
          id="category-filter"
          name="category"
          class="px-3 py-1.5 rounded-md bg-bg-primary border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          onchange="this.form.submit()"
        >
          <option value="">すべて</option>
          {categories.map((category) => (
            <option key={category} value={category} selected={category === currentCategory}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {(currentSource || currentCategory) && (
        <a
          href="/"
          class="px-3 py-1.5 rounded-md bg-bg-primary border border-border text-text-secondary text-sm hover:text-accent hover:border-accent transition-colors"
        >
          フィルターをクリア
        </a>
      )}
    </div>
  );
};
