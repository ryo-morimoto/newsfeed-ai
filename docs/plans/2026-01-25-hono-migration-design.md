# Hono/JSX + React Islands への移行設計

## 背景

TanStack Start + Cloudflare Workers の組み合わせで以下の問題が発生:

1. TanStack Start は `nodejs_compat` フラグが必須（`node:async_hooks` 使用）
2. `nodejs_compat` 有効時、`@libsql/client` が Node の HTTP 実装を掴んで `headers.has` エラー
3. 両者が衝突し、Workers 上で動作不能

## 解決策

Hono/JSX に全面移行。Hono は Cloudflare Workers ネイティブ設計で `nodejs_compat` 不要。

## アーキテクチャ

```
Cloudflare Workers
├── Hono (ルーティング + SSR)
│   ├── hono/jsx (HTML生成)
│   └── @libsql/client/web (Turso接続)
├── Vite (開発 + ビルド)
│   ├── @hono/vite-dev-server
│   └── UnoCSS (継続)
└── React Islands (必要箇所のみ)
    └── 検索フォーム、テーマトグル
```

## ページ構成

| ルート | 方式 | 理由 |
|--------|------|------|
| `/` | 純粋SSR | 記事一覧は静的表示 |
| `/article/:url` | 純粋SSR | 詳細も静的表示 |
| `/search` | SSR + React Island | 検索入力にstate必要 |

## React Islands 対象

1. **SearchForm** - 検索入力の状態管理
2. **ThemeToggle** - localStorage連携（VanillaJSでも可）

## 削除対象

- `@tanstack/react-router`
- `@tanstack/react-start`
- `routeTree.gen.ts`
- `nodejs_compat` フラグ
- TanStack 関連の Vite プラグイン

## ファイル構成（移行後）

```
apps/web/
├── src/
│   ├── index.tsx           # Hono アプリ本体
│   ├── pages/
│   │   ├── index.tsx       # 記事一覧
│   │   ├── article.tsx     # 記事詳細
│   │   └── search.tsx      # 検索
│   ├── components/
│   │   ├── Layout.tsx      # 共通レイアウト (hono/jsx)
│   │   ├── ArticleCard.tsx # 記事カード (hono/jsx)
│   │   └── islands/
│   │       ├── SearchForm.tsx   # React Island
│   │       └── ThemeToggle.tsx  # React Island
│   ├── lib/
│   │   ├── db.ts           # DB接続（変更なし）
│   │   ├── search.ts       # Orama検索（変更なし）
│   │   └── category.ts     # カテゴリ色（変更なし）
│   └── styles/             # CSS（変更なし）
├── vite.config.ts          # Hono用に更新
├── wrangler.toml           # nodejs_compat削除
└── package.json            # 依存関係更新
```

## 依存関係の変更

### 追加
- `hono`
- `@hono/vite-dev-server`

### 削除
- `@tanstack/react-router`
- `@tanstack/react-start`

### 継続
- `react`, `react-dom` (Islands用)
- `@libsql/client`
- `@orama/orama`
- `unocss`

## Islands ハイドレーション方式

```html
<!-- SSR時に生成 -->
<div id="search-form-island" data-props='{"initialQuery":""}'>
  <!-- SSR済みHTML -->
</div>
<script type="module" src="/islands/search-form.js"></script>
```

```tsx
// islands/search-form.js
import { hydrateRoot } from 'react-dom/client';
import { SearchForm } from './SearchForm';

const el = document.getElementById('search-form-island');
const props = JSON.parse(el.dataset.props);
hydrateRoot(el, <SearchForm {...props} />);
```

## wrangler.toml 変更

```toml
# Before
compatibility_flags = ["nodejs_compat"]

# After
# フラグ削除（nodejs_compat不要）
```

## 決定事項

- [x] Hono/JSX に移行
- [x] Vite + プラグイン継続
- [x] Orama検索維持
- [x] React Islandsは検索・テーマのみ
