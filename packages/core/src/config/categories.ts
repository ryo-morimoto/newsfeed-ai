import type { CategoryConfig } from "./types";

/**
 * Unified category definitions with both emoji (for Discord) and colors (for Web)
 */
export const CATEGORIES: Record<string, CategoryConfig> = {
  AI: {
    key: "AI",
    emoji: "🤖",
    displayName: "AI/LLM",
    colors: { bg: "#8b5cf6", text: "#ffffff" },
  },
  機械学習: {
    key: "機械学習",
    emoji: "🧠",
    displayName: "機械学習",
    colors: { bg: "#8b5cf6", text: "#ffffff" },
  },
  クラウド: {
    key: "クラウド",
    emoji: "☁️",
    displayName: "クラウド",
    colors: { bg: "#3b82f6", text: "#ffffff" },
  },
  インフラ: {
    key: "インフラ",
    emoji: "🏗️",
    displayName: "インフラ",
    colors: { bg: "#3b82f6", text: "#ffffff" },
  },
  セキュリティ: {
    key: "セキュリティ",
    emoji: "🔒",
    displayName: "セキュリティ",
    colors: { bg: "#ef4444", text: "#ffffff" },
  },
  プログラミング: {
    key: "プログラミング",
    emoji: "💻",
    displayName: "プログラミング",
    colors: { bg: "#10b981", text: "#ffffff" },
  },
  言語: {
    key: "言語",
    emoji: "📝",
    displayName: "プログラミング言語",
    colors: { bg: "#10b981", text: "#ffffff" },
  },
  ツール: {
    key: "ツール",
    emoji: "🛠️",
    displayName: "開発ツール",
    colors: { bg: "#f59e0b", text: "#000000" },
  },
  開発: {
    key: "開発",
    emoji: "⚙️",
    displayName: "開発",
    colors: { bg: "#f59e0b", text: "#000000" },
  },
  Web: {
    key: "Web",
    emoji: "🌐",
    displayName: "Web開発",
    colors: { bg: "#06b6d4", text: "#ffffff" },
  },
  フロントエンド: {
    key: "フロントエンド",
    emoji: "🎨",
    displayName: "フロントエンド",
    colors: { bg: "#06b6d4", text: "#ffffff" },
  },
  バックエンド: {
    key: "バックエンド",
    emoji: "⚡",
    displayName: "バックエンド",
    colors: { bg: "#0891b2", text: "#ffffff" },
  },
  データベース: {
    key: "データベース",
    emoji: "🗄️",
    displayName: "データベース",
    colors: { bg: "#6366f1", text: "#ffffff" },
  },
  DevOps: {
    key: "DevOps",
    emoji: "🚀",
    displayName: "DevOps",
    colors: { bg: "#ec4899", text: "#ffffff" },
  },
  OSS: {
    key: "OSS",
    emoji: "📦",
    displayName: "オープンソース",
    colors: { bg: "#84cc16", text: "#000000" },
  },
};

const DEFAULT_CATEGORY: CategoryConfig = {
  key: "default",
  emoji: "📌",
  displayName: "その他",
  colors: { bg: "#6b7280", text: "#ffffff" },
};

/**
 * Get emoji string for a category (for Discord)
 */
export function getCategoryEmoji(category: string): string {
  const cat = CATEGORIES[category];
  return cat ? `${cat.emoji} ${cat.displayName}` : `${DEFAULT_CATEGORY.emoji} ${category}`;
}

/**
 * Get color scheme for a category (for Web UI)
 */
export function getCategoryColor(category: string): { bg: string; text: string } {
  return CATEGORIES[category]?.colors || DEFAULT_CATEGORY.colors;
}

/**
 * Get full category config
 */
export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORIES[category] || { ...DEFAULT_CATEGORY, key: category, displayName: category };
}
