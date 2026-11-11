export function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function truncateAtParagraph(
  value: string,
  maxCharacters: number,
): { text: string; wasTruncated: boolean } {
  if (value.length <= maxCharacters) {
    return { text: value, wasTruncated: false };
  }

  const candidate = value.slice(0, maxCharacters);
  const paragraphBreak = candidate.lastIndexOf("\n\n");
  const cutAt =
    paragraphBreak >= Math.floor(maxCharacters * 0.8)
      ? paragraphBreak
      : maxCharacters;

  return { text: candidate.slice(0, cutAt).trim(), wasTruncated: true };
}
