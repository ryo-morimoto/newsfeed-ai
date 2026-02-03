import { test, expect } from "@playwright/test";

test.describe("Index Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Newsfeed AI/);
  });

  test("has header navigation", async ({ page }) => {
    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: "記事一覧" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "検索" })).toBeVisible();
  });

  test("has article cards or empty message", async ({ page }) => {
    const articles = page.locator("article");
    const emptyMessage = page.getByText("詳細要旨が生成された記事はまだありません");

    const hasArticles = await articles.count() > 0;
    const hasEmptyMessage = await emptyMessage.isVisible().catch(() => false);

    expect(hasArticles || hasEmptyMessage).toBe(true);
  });

  test("has footer", async ({ page }) => {
    await expect(page.locator("footer")).toBeVisible();
    await expect(page.locator("footer")).toContainText("Newsfeed AI");
  });
});
