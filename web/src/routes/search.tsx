import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { performSearch, type WebSearchResponse } from "~/lib/server-fns";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => {
    if (!deps.q) {
      return { result: null, query: "" };
    }
    try {
      const result = await performSearch({ data: deps.q });
      return { result, query: deps.q };
    } catch (error) {
      return {
        result: null,
        query: deps.q,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
  head: () => ({
    meta: [{ title: "Web検索 - Newsfeed AI" }],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { result, query, error } = Route.useLoaderData() as {
    result: WebSearchResponse | null;
    query: string;
    error?: string;
  };
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState(query);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setIsSearching(true);
    navigate({
      to: "/search",
      search: { q: inputValue.trim() },
    });
  };

  return (
    <div className="container">
      <div className="page-header">
        <h1>Web検索</h1>
        <p className="subtitle">自然言語でテック情報を検索</p>
      </div>

      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="例: React 19の新機能、Claude APIの料金、Rustの並行処理..."
            className="search-input"
            autoFocus
          />
          <button
            type="submit"
            className="search-button"
            disabled={isSearching || !inputValue.trim()}
          >
            {isSearching ? "検索中..." : "検索"}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="search-results">
          <div className="search-summary">
            <h2>回答</h2>
            <div className="summary-content">{result.summary}</div>
          </div>

          {result.citations.length > 0 && (
            <div className="search-sources">
              <h3>ソース</h3>
              <ul className="source-list">
                {result.citations.map((url, index) => (
                  <li key={index}>
                    <a href={url} target="_blank" rel="noopener noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!result && !error && query && (
        <div className="empty-state">
          <p>検索結果がありません。</p>
        </div>
      )}

      {!query && (
        <div className="search-hints">
          <h3>検索例</h3>
          <ul>
            <li
              onClick={() => setInputValue("React 19の新機能は何ですか？")}
              className="hint-item"
            >
              React 19の新機能は何ですか？
            </li>
            <li
              onClick={() => setInputValue("Rustでasync/awaitを使う方法")}
              className="hint-item"
            >
              Rustでasync/awaitを使う方法
            </li>
            <li
              onClick={() => setInputValue("Claude APIとGPT-4の比較")}
              className="hint-item"
            >
              Claude APIとGPT-4の比較
            </li>
            <li
              onClick={() => setInputValue("最新のTypeScript 5.xの機能")}
              className="hint-item"
            >
              最新のTypeScript 5.xの機能
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
