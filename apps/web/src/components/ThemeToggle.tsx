import { useEffect, useState, useCallback } from 'react'

type Theme = 'light' | 'dark' | 'system'

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // localStorage not available (private browsing, etc.)
  }
  return 'system'
}

function setStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // localStorage not available
  }
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') {
    root.removeAttribute('data-theme')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  // Handle system theme changes when in system mode
  const handleSystemThemeChange = useCallback((e: MediaQueryListEvent) => {
    if (theme === 'system') {
      // Force re-render to update icon
      setTheme('system')
    }
  }, [theme])

  useEffect(() => {
    setMounted(true)
    const stored = getStoredTheme()
    setTheme(stored)
    applyTheme(stored)

    // Listen to system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange)
    }
  }, [handleSystemThemeChange])

  const toggleTheme = () => {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
    setTheme(next)
    setStoredTheme(next)
    applyTheme(next)
  }

  // Get current effective theme (for icon display)
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (theme !== 'system') return theme
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return 'light'
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="p-2 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
      >
        <span className="i-lucide-sun w-5 h-5 block" aria-hidden="true" />
      </button>
    )
  }

  const effectiveTheme = getEffectiveTheme()
  const icon = theme === 'system'
    ? 'i-lucide-monitor'
    : theme === 'light'
    ? 'i-lucide-sun'
    : 'i-lucide-moon'

  const label = theme === 'light'
    ? 'Light mode, click for dark'
    : theme === 'dark'
    ? 'Dark mode, click for system'
    : `System mode (${effectiveTheme}), click for light`

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className="p-2 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
    >
      <span className={`${icon} w-5 h-5 block`} aria-hidden="true" />
    </button>
  )
}
