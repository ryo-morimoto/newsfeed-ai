import 'virtual:uno.css'
import '~/styles/base.css'
import '~/styles/animations.css'
import {
  createRootRoute,
  Outlet,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { ThemeToggle } from '~/components/ThemeToggle'

// Inline script to prevent theme flash on load
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  } catch (e) {}
})();
`

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Newsfeed AI' },
      { name: 'description', content: 'AI-powered personalized tech news aggregator' },
    ],
  }),
})

function RootComponent() {
  return (
    <html lang="ja">
      <head>
        <HeadContent />
        {/* Inline script to prevent theme flash */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen flex flex-col bg-bg-primary text-text-primary transition-colors">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-md border-b border-border transition-colors">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <a
              href="/"
              className="text-xl font-bold text-text-primary hover:text-accent transition-colors"
            >
              Newsfeed AI
            </a>
            <div className="flex items-center gap-6">
              <nav aria-label="Main navigation" className="flex gap-6">
                <a
                  href="/"
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  記事一覧
                </a>
                <a
                  href="/search"
                  className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  検索
                </a>
              </nav>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-bg-secondary border-t border-border transition-colors">
          <div className="max-w-7xl mx-auto px-6 py-6 text-center">
            <p className="text-sm text-text-muted">
              Newsfeed AI - AI-powered personalized tech news
            </p>
          </div>
        </footer>

        <Scripts />
      </body>
    </html>
  )
}
