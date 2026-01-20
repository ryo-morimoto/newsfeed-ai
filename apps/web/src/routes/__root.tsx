import {
  createRootRoute,
  Outlet,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Newsfeed AI" },
    ],
    links: [{ rel: "stylesheet", href: "/styles.css" }],
  }),
});

function RootComponent() {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
      </head>
      <body>
        <header className="header">
          <div className="container">
            <a href="/" className="logo">
              Newsfeed AI
            </a>
            <nav>
              <a href="/">記事一覧</a>
              <a href="/search">検索</a>
            </nav>
          </div>
        </header>
        <main className="main">
          <Outlet />
        </main>
        <footer className="footer">
          <div className="container">
            <p>Newsfeed AI - 記事の詳細要旨を表示</p>
          </div>
        </footer>
        <Scripts />
      </body>
    </html>
  );
}
