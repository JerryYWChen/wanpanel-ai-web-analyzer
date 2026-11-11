import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { JSDOM } from "jsdom";
import { normalizeExtractedText } from "./text-normalizer.js";

export interface ReadableContent {
  title: string | null;
  text: string;
}

const clutterSelector = [
  "script",
  "style",
  "noscript",
  "template",
  "nav",
  "footer",
  "header",
  "aside",
  "form",
  "iframe",
  "svg",
  "canvas",
  "[hidden]",
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  ".cookie-banner",
  ".cookie-consent",
  ".advertisement",
  ".ads",
  ".social-share",
].join(",");

export function extractReadableContent(
  html: Buffer,
  sourceUrl: string,
): ReadableContent {
  const $ = cheerio.loadBuffer(html);
  const metadataTitle =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    null;

  $(clutterSelector).remove();

  const dom = new JSDOM($.html(), { url: sourceUrl });
  const article = new Readability(dom.window.document).parse();
  const readableText = normalizeExtractedText(article?.textContent ?? "");
  const fallbackText = normalizeExtractedText(
    $("main").first().text() || $("article").first().text() || $("body").text(),
  );
  const text =
    readableText.length >= fallbackText.length * 0.35
      ? readableText
      : fallbackText;
  const title = normalizeExtractedText(article?.title ?? metadataTitle ?? "") || null;

  dom.window.close();
  return { title, text };
}
