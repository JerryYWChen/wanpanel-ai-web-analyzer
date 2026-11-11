import { describe, expect, it } from "vitest";
import { extractReadableContent } from "./readable-extractor.js";
import { normalizeExtractedText } from "./text-normalizer.js";

describe("readable extraction", () => {
  it("removes page chrome and preserves normalized main content", () => {
    const paragraphs = Array.from(
      { length: 8 },
      (_, index) =>
        `<p>Paragraph ${index + 1} explains a concrete part of the public article with enough detail for analysis.</p>`,
    ).join("");
    const html = Buffer.from(`
      <!doctype html>
      <html>
        <head><title>Useful Article</title><script>secretNavigation()</script></head>
        <body>
          <header>Site header clutter</header>
          <nav>Menu should disappear</nav>
          <main><article><h1>Useful Article</h1>${paragraphs}</article></main>
          <aside>Advertisement should disappear</aside>
          <footer>Footer should disappear</footer>
        </body>
      </html>
    `);

    const result = extractReadableContent(html, "https://example.com/article");

    expect(result.title).toBe("Useful Article");
    expect(result.text).toContain("Paragraph 1 explains");
    expect(result.text).toContain("Paragraph 8 explains");
    expect(result.text).not.toContain("Menu should disappear");
    expect(result.text).not.toContain("Advertisement should disappear");
    expect(result.text).not.toContain("secretNavigation");
  });

  it("normalizes whitespace and invisible characters", () => {
    expect(normalizeExtractedText(" One\u00a0  line \r\n\r\n\r\n Two\u200b line ")).toBe(
      "One line\n\nTwo line",
    );
  });
});
