import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("index page returns 200 and has heading", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("記事一覧");
  });

  test("search page returns 200 and has search form", async ({ page }) => {
    const response = await page.goto("/search");
    expect(response?.status()).toBe(200);
    await expect(page.locator('input[type="search"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("non-existent article returns 404", async ({ page }) => {
    const response = await page.goto("/article/https%3A%2F%2Fnon-existent-url.example.com");
    expect(response?.status()).toBe(404);
    await expect(page.locator("h1")).toContainText("404");
  });
});
