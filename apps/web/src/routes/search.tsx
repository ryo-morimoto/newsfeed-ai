import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { performSearch } from '~/lib/server-fns'
import { ArticleCard } from '~/components/ArticleCard'
import type { SearchResult } from '~/lib/search'

interface SearchParams {
  q?: string
}

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search.q === 'string' ? search.q : undefined,
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }): Promise<{ results: SearchResult[]; query: string }> => {
    if (!deps.q) {
      return { results: [], query: '' }
    }
    const results = await performSearch({ data: deps.q })
    return { results, query: deps.q }
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.query
          ? `"${loaderData.query}" の検索結果 - Newsfeed AI`
          : '検索 - Newsfeed AI',
      },
    ],
  }),
  component: SearchPage,
})

function SearchPage() {
  const { results, query } = Route.useLoaderData()
  const { q } = Route.useSearch()
  const navigate = useNavigate()
  const [inputValue, setInputValue] = useState(q || '')
  const [isSearching, setIsSearching] = useState(false)

  // Sync input with URL query param
  useEffect(() => {
    setInputValue(q || '')
  }, [q])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim()) return

    setIsSearching(true)
    await navigate({
      to: '/search',
      search: { q: inputValue.trim() },
    })
    setIsSearching(false)
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-text-primary mb-2">
          検索
        </h1>
        <p className="text-text-secondary">
          記事をキーワードで検索
        </p>
      </header>

      {/* Search Form - use div with role for broader compatibility */}
      <div role="search" className="mb-8">
        <form onSubmit={handleSubmit} className="max-w-2xl">
          <div className="flex gap-3">
            <label htmlFor="search-input" className="sr-only">
              検索キーワード
            </label>
            <input
              id="search-input"
              type="search"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="キーワードを入力..."
              disabled={isSearching}
              className="flex-1 px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isSearching || !inputValue.trim()}
              className="px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSearching ? (
                <>
                  <span className="i-lucide-loader-2 w-4 h-4 animate-spin" aria-hidden="true" />
                  検索中...
                </>
              ) : (
                <>
                  <span className="i-lucide-search w-4 h-4" aria-hidden="true" />
                  検索
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {query && (
        <section aria-label="検索結果">
          <div className="mb-6">
            <p className="text-text-secondary">
              「<span className="font-medium text-text-primary">{query}</span>」の検索結果: {results.length}件
            </p>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16 text-text-muted">
              <span className="i-lucide-search-x w-12 h-12 mx-auto mb-4 block" aria-hidden="true" />
              <p>該当する記事が見つかりませんでした</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children auto-rows-fr">
              {results.map((result: SearchResult) => (
                <div key={result.article.url} className="relative h-full">
                  <ArticleCard article={result.article} />
                  <div className="absolute top-4 right-4 px-2 py-1 bg-accent text-white text-xs font-semibold rounded z-10">
                    {Math.round(result.score * 100)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Initial State */}
      {!query && (
        <div className="text-center py-16 text-text-muted">
          <span className="i-lucide-search w-12 h-12 mx-auto mb-4 block" aria-hidden="true" />
          <p>キーワードを入力して検索してください</p>
        </div>
      )}
    </div>
  )
}
