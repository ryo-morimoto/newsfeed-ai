/** @jsxImportSource react */
import { useState } from "react";

interface SearchFormProps {
  initialQuery: string;
}

export function SearchForm({ initialQuery }: SearchFormProps) {
  const [inputValue, setInputValue] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setIsSearching(true);
    window.location.href = `/search?q=${encodeURIComponent(inputValue.trim())}`;
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="flex gap-3">
        <label htmlFor="search-input" className="sr-only">検索キーワード</label>
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
  );
}
