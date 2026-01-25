import { test, expect } from "@playwright/test";

test.describe("Search Page", () => {
  test("has search form", async ({ page }) => {
    await page.goto("/search");

    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("shows prompt message when no query", async ({ page }) => {
    await page.goto("/search");

    await expect(page.getByText("キーワードを入力して検索してください")).toBeVisible();
  });

  test("shows results or no-results message with query", async ({ page }) => {
    await page.goto("/search?q=test");

    const results = page.locator("article");
    const noResults = page.getByText("該当する記事が見つかりませんでした");

    const hasResults = (await results.count()) > 0;
    const hasNoResults = await noResults.isVisible().catch(() => false);

    expect(hasResults || hasNoResults).toBe(true);
  });

  test("shows result count with query", async ({ page }) => {
    await page.goto("/search?q=test");

    await expect(page.getByText(/の検索結果:/)).toBeVisible();
  });
});
