import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { performSearch } from "~/lib/server-fns";
import { getCategoryColor } from "~/lib/category";
import type { SearchResult } from "~/lib/search";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps: { q } }) => {
    if (!q || q.trim().length === 0) {
      return { results: [], query: "" };
    }
    const results = await performSearch({ data: q });
    return { results, query: q };
  },
  head: () => ({
    meta: [{ title: "Newsfeed AI - 検索" }],
  }),
  component: SearchPage,
});

function SearchResultCard({ result }: { result: SearchResult }) {
  const { article, score } = result;
  const categoryColor = getCategoryColor(article.category);
  const encodedUrl = encodeURIComponent(article.url);

  return (
    <div className="card search-result-card">
      <div className="card-header">
        <span
          className="badge"
          style={{
            backgroundColor: categoryColor.bg,
            color: categoryColor.text,
          }}
        >
          {article.category}
        </span>
        <span className="source">{article.source}</span>
        <span className="score-badge" title={`検索スコア: ${score.toFixed(3)}`}>
          {(score * 100).toFixed(0)}%
        </span>
      </div>
      <h2 className="card-title">
        <a href={`/article/${encodedUrl}`}>{article.title}</a>
      </h2>
      {article.summary && <p className="card-summary">{article.summary}</p>}
      <div className="card-footer">
        <span className="date">
          {article.created_at
            ? new Date(article.created_at).toLocaleDateString("ja-JP")
            : ""}
        </span>
        <a href={`/article/${encodedUrl}`} className="read-more">
          詳細を読む
        </a>
      </div>
    </div>
  );
}

function SearchPage() {
  const { results, query: initialQuery } = Route.useLoaderData();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(q || "");
  const [isSearching, setIsSearching] = useState(false);

  // Sync input with URL query param
  useEffect(() => {
    setSearchQuery(q || "");
  }, [q]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    await navigate({
      to: "/search",
      search: { q: searchQuery.trim() },
    });
    setIsSearching(false);
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1>記事検索</h1>
        <p className="subtitle">キーワードで記事を検索できます</p>
      </div>

      <form className="search-form" onSubmit={handleSearch}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="検索キーワードを入力..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isSearching}
          />
          <button
            type="submit"
            className="btn btn-primary search-btn"
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? "検索中..." : "検索"}
          </button>
        </div>
      </form>

      {initialQuery && (
        <div className="search-results-header">
          <p className="results-count">
            「{initialQuery}」の検索結果: {results.length}件
          </p>
        </div>
      )}

      {results.length === 0 && initialQuery ? (
        <div className="empty-state">
          <p>「{initialQuery}」に一致する記事が見つかりませんでした。</p>
          <p>別のキーワードで検索してみてください。</p>
        </div>
      ) : results.length > 0 ? (
        <div className="card-grid">
          {results.map((result) => (
            <SearchResultCard key={result.article.url} result={result} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <p>検索キーワードを入力してください。</p>
        </div>
      )}
    </div>
  );
}
