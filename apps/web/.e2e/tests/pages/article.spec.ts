import { test, expect } from "@playwright/test";

test.describe("Article Page", () => {
  test("shows 404 for non-existent article", async ({ page }) => {
    await page.goto("/article/https%3A%2F%2Fnon-existent.example.com");

    await expect(page.locator("h1")).toContainText("404");
    await expect(page.getByText("記事が見つかりませんでした")).toBeVisible();
  });

  test("has back link on 404 page", async ({ page }) => {
    await page.goto("/article/https%3A%2F%2Fnon-existent.example.com");

    await expect(page.getByRole("link", { name: /記事一覧に戻る/ })).toBeVisible();
  });

  test("article page has required elements when article exists", async ({ page }) => {
    // First, get an article URL from the index page
    await page.goto("/");

    const firstArticleLink = page.locator("article a").first();
    const hasArticle = await firstArticleLink.count() > 0;

    if (!hasArticle) {
      test.skip(true, "No articles in database");
      return;
    }

    await firstArticleLink.click();
    await page.waitForLoadState("networkidle");

    // Check article page elements
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /記事一覧に戻る/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /元の記事を読む/ })).toBeVisible();
  });
});
