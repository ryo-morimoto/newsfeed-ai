export const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  AI: { bg: "#8b5cf6", text: "#ffffff" },
  機械学習: { bg: "#8b5cf6", text: "#ffffff" },
  クラウド: { bg: "#3b82f6", text: "#ffffff" },
  インフラ: { bg: "#3b82f6", text: "#ffffff" },
  セキュリティ: { bg: "#ef4444", text: "#ffffff" },
  プログラミング: { bg: "#10b981", text: "#ffffff" },
  言語: { bg: "#10b981", text: "#ffffff" },
  ツール: { bg: "#f59e0b", text: "#000000" },
  開発: { bg: "#f59e0b", text: "#000000" },
  Web: { bg: "#06b6d4", text: "#ffffff" },
  フロントエンド: { bg: "#06b6d4", text: "#ffffff" },
  バックエンド: { bg: "#0891b2", text: "#ffffff" },
  データベース: { bg: "#6366f1", text: "#ffffff" },
  DevOps: { bg: "#ec4899", text: "#ffffff" },
  OSS: { bg: "#84cc16", text: "#000000" },
  default: { bg: "#6b7280", text: "#ffffff" },
};

export function getCategoryColor(category: string): {
  bg: string;
  text: string;
} {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}
