import type { Child } from "hono/jsx";
import { html } from "hono/html";

interface LayoutProps {
  title?: string;
  children: Child;
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

export const Layout = ({ title = "Newsfeed AI", children }: LayoutProps) => {
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
