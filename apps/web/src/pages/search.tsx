import { Layout } from "../components/Layout";
import { ArticleCard } from "../components/ArticleCard";
import type { SearchResult } from "../lib/search";

interface SearchPageProps {
  results: SearchResult[];
  query: string;
}

export const SearchPage = ({ results, query }: SearchPageProps) => {
  const title = query ? `"${query}" の検索結果 - Newsfeed AI` : "検索 - Newsfeed AI";

  return (
    <Layout title={title}>
      <div class="max-w-7xl mx-auto px-6 py-8">
        <header class="mb-8">
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">検索</h1>
          <p class="text-text-secondary">記事をキーワードで検索</p>
        </header>

        {/* React Island: SearchForm */}
        <div id="search-form-island" data-initial-query={query} class="mb-8">
          {/* SSR fallback form */}
          <form action="/search" method="get" class="max-w-2xl">
            <div class="flex gap-3">
              <label for="search-input" class="sr-only">検索キーワード</label>
              <input
                id="search-input"
                type="search"
                name="q"
                value={query}
                placeholder="キーワードを入力..."
                class="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
              />
              <button
                type="submit"
                class="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-all flex items-center gap-2"
              >
                <span class="i-lucide-search w-4 h-4" aria-hidden="true"></span>
                検索
              </button>
            </div>
          </form>
        </div>

        {query && (
          <section aria-label="検索結果">
            <div class="mb-6">
              <p class="text-text-secondary">
                「<span class="font-medium text-text-primary">{query}</span>」の検索結果: {results.length}件
              </p>
            </div>

            {results.length === 0 ? (
              <div class="text-center py-16 text-text-muted">
                <span class="i-lucide-search-x w-12 h-12 mx-auto mb-4 block" aria-hidden="true"></span>
                <p>該当する記事が見つかりませんでした</p>
              </div>
            ) : (
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children auto-rows-fr">
                {results.map((result) => (
                  <div key={result.article.url} class="relative h-full">
                    <ArticleCard article={result.article} />
                    <div class="absolute top-4 right-4 px-2 py-1 bg-accent text-white text-xs font-semibold rounded z-10">
                      {Math.round(result.score * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!query && (
          <div class="text-center py-16 text-text-muted">
            <span class="i-lucide-search w-12 h-12 mx-auto mb-4 block" aria-hidden="true"></span>
            <p>キーワードを入力して検索してください</p>
          </div>
        )}
      </div>
    </Layout>
  );
};
