import { test, expect, describe } from "bun:test";
import { parseTrendingHtml } from "./github-trending";

const article = (opts: {
  sponsorHref?: string;
  repoHref: string;
  repoName: string;
  description?: string;
  starsToday?: string;
}) => `
<article class="Box-row">
  <span class="d-inline-block float-sm-right">
    <svg aria-label="star" class="octicon octicon-star" viewBox="0 0 16 16" width="16" height="16"></svg>
    ${opts.starsToday ?? "100 stars today"}
  </span>
  <h2 class="h3 lh-condensed">
    ${opts.sponsorHref ? `<a href="${opts.sponsorHref}" data-ga-click="Sponsor">Sponsor</a>` : ""}
    <a href="${opts.repoHref}">
      ${opts.repoName}
    </a>
  </h2>
  ${opts.description !== undefined ? `<p class="col-9 color-fg-muted my-1 pr-4">${opts.description}</p>` : ""}
</article>`;

const wrap = (body: string) =>
  `<html><body><div class="explore-content">${body}</div></body></html>`;

describe("parseTrendingHtml", () => {
  test("skips sponsor link and extracts repo URL", async () => {
    const html = wrap(
      article({
        sponsorHref: "/sponsors/octocat",
        repoHref: "/octocat/hello-world",
        repoName: "octocat / hello-world",
        description: "A test repo",
      })
    );

    const repos = await parseTrendingHtml(html, "typescript");
    expect(repos).toHaveLength(1);
    expect(repos[0].url).toBe("https://github.com/octocat/hello-world");
    expect(repos[0].title).toBe("octocat/hello-world");
  });

  test("extracts description", async () => {
    const html = wrap(
      article({
        repoHref: "/user/repo",
        repoName: "user / repo",
        description: "  A cool library for doing things  ",
      })
    );

    const repos = await parseTrendingHtml(html, "go");
    expect(repos[0].description).toBe("A cool library for doing things");
  });

  test("falls back to 'No description' when missing", async () => {
    const html = wrap(
      article({
        repoHref: "/user/repo",
        repoName: "user / repo",
      })
    );

    const repos = await parseTrendingHtml(html, "rust");
    expect(repos[0].description).toBe("No description");
  });

  test("parses comma-separated star count", async () => {
    const html = wrap(
      article({
        repoHref: "/user/repo",
        repoName: "user / repo",
        starsToday: "1,234 stars today",
      })
    );

    const repos = await parseTrendingHtml(html, "typescript");
    expect(repos[0].stars).toBe(1234);
  });

  test("passes language parameter through", async () => {
    const html = wrap(
      article({
        repoHref: "/user/repo",
        repoName: "user / repo",
      })
    );

    const repos = await parseTrendingHtml(html, "python");
    expect(repos[0].language).toBe("python");
  });

  test("returns empty array for empty HTML", async () => {
    const repos = await parseTrendingHtml("<html><body></body></html>", "go");
    expect(repos).toEqual([]);
  });

  test("parses multiple articles", async () => {
    const html = wrap(
      article({
        sponsorHref: "/sponsors/alice",
        repoHref: "/alice/foo",
        repoName: "alice / foo",
        description: "First repo",
        starsToday: "500 stars today",
      }) +
        article({
          repoHref: "/bob/bar",
          repoName: "bob / bar",
          description: "Second repo",
          starsToday: "42 stars today",
        })
    );

    const repos = await parseTrendingHtml(html, "typescript");
    expect(repos).toHaveLength(2);
    expect(repos[0].url).toBe("https://github.com/alice/foo");
    expect(repos[0].stars).toBe(500);
    expect(repos[1].url).toBe("https://github.com/bob/bar");
    expect(repos[1].stars).toBe(42);
  });

  test("skips /login links", async () => {
    const html = wrap(`
      <article class="Box-row">
        <span class="d-inline-block float-sm-right">50 stars today</span>
        <h2 class="h3 lh-condensed">
          <a href="/login?return_to=/user/repo">Sign in</a>
          <a href="/user/repo">user / repo</a>
        </h2>
        <p class="col-9 color-fg-muted my-1 pr-4">Some description</p>
      </article>
    `);

    const repos = await parseTrendingHtml(html, "go");
    expect(repos).toHaveLength(1);
    expect(repos[0].url).toBe("https://github.com/user/repo");
  });
});
