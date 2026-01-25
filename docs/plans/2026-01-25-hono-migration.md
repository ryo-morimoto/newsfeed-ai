# Hono/JSX + React Islands 移行実装計画

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** TanStack Start を Hono/JSX に置き換え、Cloudflare Workers で `nodejs_compat` なしで動作させる

**Architecture:** Hono で SSR + 静的アセット配信。検索フォームとテーマトグルのみ React Islands でハイドレート。DB は `@libsql/client/web` で Turso 接続。

**Tech Stack:** Hono, hono/jsx, Vite, @hono/vite-dev-server, UnoCSS, React (Islands のみ), @libsql/client/web, @orama/orama

---

## Task 1: 依存関係の更新

**Files:**
- Modify: `apps/web/package.json`

**Step 1: TanStack 関連を削除し、Hono を追加**

```json
{
  "name": "@newsfeed-ai/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "vite build && wrangler deploy",
    "deploy:production": "vite build && wrangler deploy --env production"
  },
  "dependencies": {
    "@libsql/client": "^0.17.0",
    "@newsfeed-ai/core": "workspace:*",
    "@orama/orama": "^3.1.18",
    "@orama/plugin-data-persistence": "^3.1.18",
    "@orama/plugin-embeddings": "^3.1.18",
    "hono": "^4.7.0",
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20260122.0",
    "@hono/vite-build": "^1.3.0",
    "@hono/vite-dev-server": "^0.19.0",
    "@iconify-json/lucide": "^1.2.86",
    "@types/react": "^19.2.9",
    "@types/react-dom": "^19.2.3",
    "@unocss/preset-icons": "^66.6.0",
    "@unocss/preset-uno": "^66.6.0",
    "@unocss/transformer-directives": "^66.6.0",
    "typescript": "^5.9.3",
    "unocss": "^66.6.0",
    "vite": "^7.3.1",
    "wrangler": "^4.60.0"
  }
}
```

**Step 2: 依存関係をインストール**

Run: `bun install`
Expected: 成功

**Step 3: コミット**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(web): replace TanStack Start with Hono dependencies"
```

---

## Task 2: Vite 設定を Hono 用に更新

**Files:**
- Modify: `apps/web/vite.config.ts`

**Step 1: Hono 用の Vite 設定に書き換え**

```typescript
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import build from "@hono/vite-build/cloudflare-workers";
import UnoCSS from "unocss/vite";

export default defineConfig({
  plugins: [
    UnoCSS(),
    build({
      entry: "src/index.tsx",
    }),
    devServer({
      entry: "src/index.tsx",
    }),
  ],
});
```

**Step 2: コミット**

```bash
git add apps/web/vite.config.ts
git commit -m "chore(web): update vite config for Hono"
```

---

## Task 3: wrangler.toml を更新

**Files:**
- Modify: `apps/web/wrangler.toml`

**Step 1: nodejs_compat を削除し、main を変更**

```toml
name = "newsfeed-ai-web"
compatibility_date = "2026-01-20"
preview_urls = false

main = "dist/index.js"

assets = { directory = "dist/assets" }

[observability]
enabled = true

[observability.logs]
enabled = true
invocation_logs = true

[env.production]
routes = [{ pattern = "newsfeed-ai.ryo-o.dev", custom_domain = true }]
```

**Step 2: コミット**

```bash
git add apps/web/wrangler.toml
git commit -m "chore(web): update wrangler config for Hono (remove nodejs_compat)"
```

---

## Task 4: 共通レイアウトコンポーネント作成

**Files:**
- Create: `apps/web/src/components/Layout.tsx`

**Step 1: Hono/JSX でレイアウトを作成**

```tsx
import type { FC } from "hono/jsx";
import { html } from "hono/html";

interface LayoutProps {
  title?: string;
  children: any;
}

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
})();
`;

export const Layout: FC<LayoutProps> = ({ title = "Newsfeed AI", children }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content="AI-powered personalized tech news aggregator" />
        <link rel="stylesheet" href="/static/style.css" />
        {html`<script>${themeScript}</script>`}
      </head>
      <body class="min-h-screen flex flex-col bg-bg-primary text-text-primary transition-colors">
        <header class="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-md border-b border-border transition-colors">
          <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <a href="/" class="text-xl font-bold text-text-primary hover:text-accent transition-colors">
              Newsfeed AI
            </a>
            <div class="flex items-center gap-6">
              <nav aria-label="Main navigation" class="flex gap-6">
                <a href="/" class="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                  記事一覧
                </a>
                <a href="/search" class="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                  検索
                </a>
              </nav>
              <div id="theme-toggle-island"></div>
            </div>
          </div>
        </header>

        <main class="flex-1">{children}</main>

        <footer class="bg-bg-secondary border-t border-border transition-colors">
          <div class="max-w-7xl mx-auto px-6 py-6 text-center">
            <p class="text-sm text-text-muted">Newsfeed AI - AI-powered personalized tech news</p>
          </div>
        </footer>

        <script type="module" src="/static/islands.js"></script>
      </body>
    </html>
  );
};
```

**Step 2: コミット**

```bash
git add apps/web/src/components/Layout.tsx
git commit -m "feat(web): add Hono/JSX Layout component"
```

---

## Task 5: ArticleCard コンポーネントを Hono/JSX に変換

**Files:**
- Modify: `apps/web/src/components/ArticleCard.tsx`

**Step 1: React から Hono/JSX に変換（useState 削除）**

```tsx
import type { FC } from "hono/jsx";
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

export const ArticleCard: FC<ArticleCardProps> = ({ article, featured = false }) => {
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
```

**Step 2: コミット**

```bash
git add apps/web/src/components/ArticleCard.tsx
git commit -m "refactor(web): convert ArticleCard to Hono/JSX"
```

---

## Task 6: ページコンポーネント作成（トップページ）

**Files:**
- Create: `apps/web/src/pages/index.tsx`

**Step 1: トップページを作成**

```tsx
import type { FC } from "hono/jsx";
import { Layout } from "../components/Layout";
import { ArticleCard } from "../components/ArticleCard";
import type { Article } from "@newsfeed-ai/core/db";

interface IndexPageProps {
  articles: Article[];
}

export const IndexPage: FC<IndexPageProps> = ({ articles }) => {
  return (
    <Layout title="Newsfeed AI - 記事一覧">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <header class="mb-8">
          <h1 class="text-3xl md:text-4xl font-bold text-text-primary mb-2">記事一覧</h1>
          <p class="text-text-secondary">詳細要旨が生成された記事 ({articles.length}件)</p>
        </header>

        {articles.length === 0 ? (
          <div class="text-center py-16 text-text-muted">
            <p>詳細要旨が生成された記事はまだありません。</p>
          </div>
        ) : (
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children auto-rows-fr">
            {articles.map((article, index) => (
              <ArticleCard key={article.url} article={article} featured={index === 0} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};
```

**Step 2: コミット**

```bash
git add apps/web/src/pages/index.tsx
git commit -m "feat(web): add IndexPage for Hono"
```

---

## Task 7: 記事詳細ページ作成

**Files:**
- Create: `apps/web/src/pages/article.tsx`

**Step 1: 記事詳細ページを作成**

```tsx
import type { FC } from "hono/jsx";
import { Layout } from "../components/Layout";
import { getCategoryColor } from "../lib/category";
import type { Article } from "@newsfeed-ai/core/db";

interface ArticlePageProps {
  article: Article;
}

export const ArticlePage: FC<ArticlePageProps> = ({ article }) => {
  const categoryColor = getCategoryColor(article.category);
  const date = article.created_at
    ? new Date(article.created_at).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  let keyPoints: string[] = [];
  if (article.key_points) {
    try {
      keyPoints = JSON.parse(article.key_points);
    } catch {
      keyPoints = [];
    }
  }

  return (
    <Layout title={`${article.title} - Newsfeed AI`}>
      <div class="max-w-4xl mx-auto px-6 py-8 animate-fade-in-up">
        <nav aria-label="Breadcrumb" class="mb-6">
          <a href="/" class="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors">
            <span class="i-lucide-arrow-left w-4 h-4" aria-hidden="true"></span>
            記事一覧に戻る
          </a>
        </nav>

        <article>
          <header class="mb-8">
            <div class="flex items-center gap-3 mb-4">
              <span
                class="px-3 py-1.5 rounded-full text-sm font-semibold"
                style={{ backgroundColor: categoryColor.bg, color: categoryColor.text }}
              >
                {article.category}
              </span>
              <span class="text-sm text-text-muted">{article.source}</span>
            </div>

            <h1 class="text-2xl md:text-3xl lg:text-4xl font-bold text-text-primary leading-tight mb-4">
              {article.title}
            </h1>

            <div class="flex items-center gap-4 text-sm text-text-muted">
              {date && <time datetime={article.created_at || ""}>{date}</time>}
            </div>
          </header>

          {article.summary && (
            <section class="mb-8 p-6 bg-bg-secondary rounded-xl border-l-4 border-accent">
              <h2 class="text-lg font-semibold text-text-primary mb-3">要約</h2>
              <p class="text-text-secondary leading-relaxed text-lg">{article.summary}</p>
            </section>
          )}

          {article.detailed_summary && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">詳細解説</h2>
              <div class="space-y-4">
                {article.detailed_summary.split("\n").filter(Boolean).map((paragraph, i) => (
                  <p key={i} class="text-text-primary leading-relaxed">{paragraph}</p>
                ))}
              </div>
            </section>
          )}

          {keyPoints.length > 0 && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">ポイント</h2>
              <ul class="space-y-3">
                {keyPoints.map((point, i) => (
                  <li key={i} class="flex items-start gap-3 text-text-primary">
                    <span class="i-lucide-check-circle w-5 h-5 text-success flex-shrink-0 mt-0.5" aria-hidden="true"></span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {article.target_audience && (
            <section class="mb-8">
              <h2 class="text-xl font-semibold text-text-primary mb-4 pb-2 border-b border-border">対象読者</h2>
              <p class="text-text-secondary italic">{article.target_audience}</p>
            </section>
          )}

          <footer class="pt-8 border-t border-border">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
            >
              元の記事を読む
              <span class="i-lucide-external-link w-4 h-4" aria-hidden="true"></span>
            </a>
          </footer>
        </article>
      </div>
    </Layout>
  );
};

export const NotFoundPage: FC = () => {
  return (
    <Layout title="Article Not Found - Newsfeed AI">
      <div class="max-w-4xl mx-auto px-6 py-16 text-center">
        <h1 class="text-6xl font-bold text-text-muted mb-4">404</h1>
        <p class="text-text-secondary mb-8">記事が見つかりませんでした</p>
        <a
          href="/"
          class="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover transition-colors"
        >
          <span class="i-lucide-arrow-left w-4 h-4" aria-hidden="true"></span>
          記事一覧に戻る
        </a>
      </div>
    </Layout>
  );
};
```

**Step 2: コミット**

```bash
git add apps/web/src/pages/article.tsx
git commit -m "feat(web): add ArticlePage for Hono"
```

---

## Task 8: 検索ページ作成（SSR 部分）

**Files:**
- Create: `apps/web/src/pages/search.tsx`

**Step 1: 検索ページを作成（React Island プレースホルダー付き）**

```tsx
import type { FC } from "hono/jsx";
import { Layout } from "../components/Layout";
import { ArticleCard } from "../components/ArticleCard";
import type { SearchResult } from "../lib/search";

interface SearchPageProps {
  results: SearchResult[];
  query: string;
}

export const SearchPage: FC<SearchPageProps> = ({ results, query }) => {
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
```

**Step 2: コミット**

```bash
git add apps/web/src/pages/search.tsx
git commit -m "feat(web): add SearchPage for Hono"
```

---

## Task 9: React Islands 作成

**Files:**
- Create: `apps/web/src/islands/SearchForm.tsx`
- Create: `apps/web/src/islands/ThemeToggle.tsx`
- Create: `apps/web/src/islands/index.tsx`

**Step 1: SearchForm Island を作成**

```tsx
// apps/web/src/islands/SearchForm.tsx
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
```

**Step 2: ThemeToggle Island を作成**

```tsx
// apps/web/src/islands/ThemeToggle.tsx
import { useState, useEffect } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = localStorage.getItem("theme") as "light" | "dark" | null;
    if (stored) {
      setTheme(stored);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
      aria-label={theme === "light" ? "ダークモードに切り替え" : "ライトモードに切り替え"}
    >
      {theme === "light" ? (
        <span className="i-lucide-moon w-5 h-5 text-text-secondary" aria-hidden="true" />
      ) : (
        <span className="i-lucide-sun w-5 h-5 text-text-secondary" aria-hidden="true" />
      )}
    </button>
  );
}
```

**Step 3: Islands エントリーポイントを作成**

```tsx
// apps/web/src/islands/index.tsx
import { hydrateRoot } from "react-dom/client";
import { SearchForm } from "./SearchForm";
import { ThemeToggle } from "./ThemeToggle";

// Hydrate SearchForm
const searchFormEl = document.getElementById("search-form-island");
if (searchFormEl) {
  const initialQuery = searchFormEl.dataset.initialQuery || "";
  hydrateRoot(
    searchFormEl,
    <SearchForm initialQuery={initialQuery} />
  );
}

// Hydrate ThemeToggle
const themeToggleEl = document.getElementById("theme-toggle-island");
if (themeToggleEl) {
  hydrateRoot(themeToggleEl, <ThemeToggle />);
}
```

**Step 4: コミット**

```bash
git add apps/web/src/islands/
git commit -m "feat(web): add React Islands (SearchForm, ThemeToggle)"
```

---

## Task 10: Hono アプリ本体作成

**Files:**
- Create: `apps/web/src/index.tsx`

**Step 1: Hono アプリを作成**

```tsx
import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import { IndexPage } from "./pages/index";
import { ArticlePage, NotFoundPage } from "./pages/article";
import { SearchPage } from "./pages/search";
import { ensureInitialized, getArticlesWithDetailedSummary, getArticleByUrl } from "./lib/db";
import { performSearch, initializeSearchIndex } from "./lib/search";

type Bindings = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Static assets
app.use("/static/*", serveStatic({ root: "./" }));

// Initialize DB before handling requests
app.use("*", async (c, next) => {
  await ensureInitialized();
  await next();
});

// Home page
app.get("/", async (c) => {
  const articles = await getArticlesWithDetailedSummary();
  return c.html(<IndexPage articles={articles} />);
});

// Article detail page
app.get("/article/:url", async (c) => {
  const url = decodeURIComponent(c.req.param("url"));
  const article = await getArticleByUrl(url);
  if (!article) {
    return c.html(<NotFoundPage />, 404);
  }
  return c.html(<ArticlePage article={article} />);
});

// Search page
app.get("/search", async (c) => {
  const query = c.req.query("q") || "";
  let results: Awaited<ReturnType<typeof performSearch>> = [];
  if (query) {
    await initializeSearchIndex();
    results = await performSearch(query);
  }
  return c.html(<SearchPage results={results} query={query} />);
});

export default app;
```

**Step 2: コミット**

```bash
git add apps/web/src/index.tsx
git commit -m "feat(web): add Hono app entry point"
```

---

## Task 11: DB/検索モジュールの調整

**Files:**
- Modify: `apps/web/src/lib/db.ts`
- Modify: `apps/web/src/lib/search.ts`

**Step 1: db.ts をシンプル化（server-fns 経由を削除）**

```typescript
// apps/web/src/lib/db.ts
import "../adapters/db-adapter";
import * as db from "@newsfeed-ai/core/db";

export type { Article } from "@newsfeed-ai/core/db";

export const {
  getArticlesWithDetailedSummary,
  getArticleByUrl,
  getAllArticlesForIndexing: getAllArticles,
} = db;

let initPromise: Promise<void> | null = null;

export async function ensureInitialized() {
  if (!initPromise) {
    initPromise = db.ensureDb().then(() => {});
  }
  await initPromise;
}
```

**Step 2: search.ts を直接呼び出し用に調整**

```typescript
// apps/web/src/lib/search.ts
import { create, search, insertMultiple, type Orama } from "@orama/orama";
import { persist, restore } from "@orama/plugin-data-persistence";
import { tursoFileSystem } from "../adapters/turso-fs";
import { getAllArticles } from "./db";
import type { Article } from "@newsfeed-ai/core/db";

export interface SearchResult {
  article: Article;
  score: number;
}

let searchIndex: Orama<any> | null = null;
let indexInitialized = false;

const schema = {
  title: "string",
  summary: "string",
  detailed_summary: "string",
  category: "string",
  source: "string",
  url: "string",
} as const;

export async function initializeSearchIndex(): Promise<void> {
  if (indexInitialized && searchIndex) return;

  try {
    const restored = await restore("binary", {
      fs: tursoFileSystem,
    });
    if (restored) {
      searchIndex = restored as Orama<any>;
      indexInitialized = true;
      return;
    }
  } catch {
    // No persisted index, create new
  }

  searchIndex = await create({ schema });
  const articles = await getAllArticles();

  if (articles.length > 0) {
    const docs = articles.map((a) => ({
      title: a.title || "",
      summary: a.summary || "",
      detailed_summary: a.detailed_summary || "",
      category: a.category || "",
      source: a.source || "",
      url: a.url,
    }));
    await insertMultiple(searchIndex, docs);

    await persist(searchIndex, "binary", {
      fs: tursoFileSystem,
    });
  }

  indexInitialized = true;
}

export async function performSearch(query: string): Promise<SearchResult[]> {
  if (!searchIndex) {
    await initializeSearchIndex();
  }
  if (!searchIndex) return [];

  const results = await search(searchIndex, {
    term: query,
    limit: 20,
  });

  const articles = await getAllArticles();
  const articleMap = new Map(articles.map((a) => [a.url, a]));

  return results.hits
    .map((hit) => ({
      article: articleMap.get(hit.document.url as string)!,
      score: hit.score,
    }))
    .filter((r) => r.article);
}
```

**Step 3: コミット**

```bash
git add apps/web/src/lib/db.ts apps/web/src/lib/search.ts
git commit -m "refactor(web): simplify db and search modules for Hono"
```

---

## Task 12: 不要ファイルの削除

**Files:**
- Delete: `apps/web/src/routes/` (全体)
- Delete: `apps/web/src/router.tsx`
- Delete: `apps/web/src/routeTree.gen.ts`
- Delete: `apps/web/src/lib/server-fns.ts`
- Delete: `apps/web/src/components/ClientDate.tsx`
- Delete: `apps/web/src/components/DefaultCatchBoundary.tsx`
- Delete: `apps/web/src/components/ThemeToggle.tsx` (Islandsに移動済み)

**Step 1: 不要ファイルを削除**

```bash
rm -rf apps/web/src/routes/
rm -f apps/web/src/router.tsx
rm -f apps/web/src/routeTree.gen.ts
rm -f apps/web/src/lib/server-fns.ts
rm -f apps/web/src/components/ClientDate.tsx
rm -f apps/web/src/components/DefaultCatchBoundary.tsx
rm -f apps/web/src/components/ThemeToggle.tsx
```

**Step 2: コミット**

```bash
git add -A
git commit -m "chore(web): remove TanStack Start related files"
```

---

## Task 13: CSS ビルド設定

**Files:**
- Modify: `apps/web/vite.config.ts`

**Step 1: CSS を別途ビルドする設定を追加**

```typescript
import { defineConfig } from "vite";
import devServer from "@hono/vite-dev-server";
import build from "@hono/vite-build/cloudflare-workers";
import UnoCSS from "unocss/vite";

export default defineConfig(({ mode }) => {
  if (mode === "client") {
    return {
      plugins: [UnoCSS()],
      build: {
        outDir: "dist/assets/static",
        rollupOptions: {
          input: {
            style: "./src/styles/main.css",
            islands: "./src/islands/index.tsx",
          },
          output: {
            entryFileNames: "[name].js",
            assetFileNames: "[name].[ext]",
          },
        },
      },
    };
  }

  return {
    plugins: [
      UnoCSS(),
      build({
        entry: "src/index.tsx",
        output: "dist/index.js",
      }),
      devServer({
        entry: "src/index.tsx",
      }),
    ],
  };
});
```

**Step 2: main.css を作成**

```css
/* apps/web/src/styles/main.css */
@import "virtual:uno.css";
@import "./base.css";
@import "./animations.css";
```

**Step 3: package.json のビルドスクリプトを更新**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && vite build --mode client",
    "deploy": "bun run build && wrangler deploy",
    "deploy:production": "bun run build && wrangler deploy --env production"
  }
}
```

**Step 4: コミット**

```bash
git add apps/web/vite.config.ts apps/web/src/styles/main.css apps/web/package.json
git commit -m "chore(web): configure CSS and Islands build"
```

---

## Task 14: ビルド確認

**Step 1: ビルド実行**

Run: `cd apps/web && bun run build`
Expected: dist/ に index.js と assets/ が生成される

**Step 2: 開発サーバー起動確認**

Run: `cd apps/web && bun run dev`
Expected: http://localhost:5173 でアクセス可能

**Step 3: コミット（もし修正があれば）**

```bash
git add -A
git commit -m "fix(web): build configuration adjustments"
```

---

## Task 15: ローカル動作確認

**Step 1: 開発サーバーで動作確認**

Run: `cd apps/web && bun run dev`

チェック項目:
- [ ] http://localhost:5173/ でトップページ表示
- [ ] 記事カードが正しく表示される
- [ ] 記事詳細ページに遷移できる
- [ ] 検索ページで検索できる
- [ ] テーマ切り替えが動作する

**Step 2: Workers ローカル確認**

Run: `cd apps/web && wrangler dev`

チェック項目:
- [ ] Workers 環境で起動する
- [ ] 各ページが動作する

---

## Task 16: デプロイ確認

**Step 1: Preview デプロイ**

Run: `cd apps/web && bun run deploy`
Expected: Cloudflare Workers にデプロイ成功

**Step 2: Production デプロイ**

Run: `cd apps/web && bun run deploy:production`
Expected: newsfeed-ai.ryo-o.dev でアクセス可能

**Step 3: 最終コミット**

```bash
git add -A
git commit -m "feat(web): complete Hono migration"
```

---

## 決定事項サマリー

- [x] TanStack Start → Hono/JSX
- [x] nodejs_compat フラグ削除
- [x] Vite + @hono/vite-dev-server
- [x] React Islands: SearchForm, ThemeToggle のみ
- [x] Orama 検索維持
- [x] UnoCSS 継続
