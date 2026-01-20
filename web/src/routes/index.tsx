import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { fetchArticles, performSearch } from "~/lib/server-fns";
import { getCategoryColor } from "~/lib/category";
import type { Article } from "~/lib/db";
import type { SearchResult } from "~/lib/search";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => {
    return {
      q: typeof search.q === "string" ? search.q : undefined,
    };
  },
  loaderDeps: ({ search: { q } }) => ({ q }),
  loader: async ({ deps: { q } }): Promise<{
    articles: Article[];
    searchResults: SearchResult[];
    query: string;
  }> => {
    if (q && q.trim().length > 0) {
      const results = await performSearch({ data: q });
      return { articles: [], searchResults: results, query: q };
    }
    const articles = await fetchArticles();
    return { articles, searchResults: [], query: "" };
  },
  head: () => ({
    meta: [{ title: "Newsfeed AI" }],
  }),
  component: IndexPage,
});

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ArticleCard({ article }: { article: Article }) {
  const categoryColor = getCategoryColor(article.category);
  const encodedUrl = encodeURIComponent(article.url);

  return (
    <article className="card">
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
          詳細を読む →
        </a>
      </div>
    </article>
  );
}

function SearchResultCard({ result }: { result: SearchResult }) {
  const { article, score } = result;
  const categoryColor = getCategoryColor(article.category);
  const encodedUrl = encodeURIComponent(article.url);

  return (
    <article className="card">
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
          詳細を読む →
        </a>
      </div>
    </article>
  );
}

function IndexPage() {
  const { articles, searchResults, query: initialQuery } = Route.useLoaderData();
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(q || "");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setSearchQuery(q || "");
  }, [q]);

  const handleSearch = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) {
        await navigate({ to: "/", search: {} });
        return;
      }

      setIsSearching(true);
      await navigate({
        to: "/",
        search: { q: searchQuery.trim() },
      });
      setIsSearching(false);
    },
    [searchQuery, navigate]
  );

  const handleClearSearch = useCallback(async () => {
    setSearchQuery("");
    await navigate({ to: "/", search: {} });
  }, [navigate]);

  const handleHintClick = useCallback(
    (hint: string) => {
      setSearchQuery(hint);
      navigate({ to: "/", search: { q: hint } });
    },
    [navigate]
  );

  const isShowingResults = initialQuery && initialQuery.length > 0;

  return (
    <div className="container">
      {/* Hero Search Section */}
      <section className="hero-search">
        <h1 className="hero-title">
          <span>ニュースを、深く。</span>
        </h1>
        <p className="hero-subtitle">
          AIが要約した技術ニュースを検索・閲覧
        </p>

        <form className="search-box" onSubmit={handleSearch}>
          <div className="search-wrapper">
            <span className="search-icon">
              <SearchIcon />
            </span>
            <input
              type="text"
              className="search-input"
              placeholder="キーワードで記事を検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button
              type="submit"
              className={`search-btn ${isSearching ? "loading" : ""}`}
              disabled={isSearching}
            >
              {isSearching ? "" : "検索"}
            </button>
          </div>
        </form>

        {!isShowingResults && (
          <div className="search-hints">
            <button
              type="button"
              className="search-hint"
              onClick={() => handleHintClick("AI")}
            >
              AI
            </button>
            <button
              type="button"
              className="search-hint"
              onClick={() => handleHintClick("TypeScript")}
            >
              TypeScript
            </button>
            <button
              type="button"
              className="search-hint"
              onClick={() => handleHintClick("React")}
            >
              React
            </button>
            <button
              type="button"
              className="search-hint"
              onClick={() => handleHintClick("セキュリティ")}
            >
              セキュリティ
            </button>
          </div>
        )}
      </section>

      {/* Content Section */}
      {isShowingResults ? (
        <>
          <div className="search-results-header">
            <div className="results-query">
              <span className="results-query-text">「{initialQuery}」</span>
              <span className="results-count">{searchResults.length}件</span>
              <button
                type="button"
                className="clear-search"
                onClick={handleClearSearch}
              >
                ✕ クリア
              </button>
            </div>
          </div>

          {searchResults.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <p>「{initialQuery}」に一致する記事が見つかりませんでした</p>
              <p>別のキーワードで検索してみてください</p>
            </div>
          ) : (
            <div className="card-grid">
              {searchResults.map((result) => (
                <SearchResultCard key={result.article.url} result={result} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="section-header">
            <h2 className="section-title">最新の記事</h2>
            <span className="section-count">{articles.length}件</span>
          </div>

          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📰</div>
              <p>詳細要旨が生成された記事はまだありません</p>
            </div>
          ) : (
            <div className="card-grid">
              {articles.map((article) => (
                <ArticleCard key={article.url} article={article} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
