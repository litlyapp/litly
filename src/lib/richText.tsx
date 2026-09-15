import type { ReactNode } from "react";

// Minimal markdown-style formatting for user-entered text (event descriptions,
// reader bios): **bold** and *italic* only. Deliberately not full markdown and
// not raw HTML — this renders directly to React elements (never
// dangerouslySetInnerHTML), so there's no sanitization surface even though
// the text can come from external orgs or scraped pages.
// Content must not start/end with whitespace (standard markdown flanking
// rule) — otherwise a stray literal asterisk (footnote marker, "2 * 3", a
// disclaimer like "prices vary*") can swallow the rest of a sentence as
// italic. The italic alternative also excludes a leading/trailing "*" so it
// doesn't grab a "**bold**" pair when both patterns are tried in sequence.
const RICH_TEXT_PATTERN = /\*\*([^\s](?:.*?[^\s])?)\*\*|\*([^\s*](?:.*?[^\s*])?)\*/g;

export function renderRichText(text: string | null | undefined): ReactNode {
  if (!text) return text;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const regex = new RegExp(RICH_TEXT_PATTERN);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) nodes.push(<strong key={key++}>{match[1]}</strong>);
    else if (match[2] !== undefined) nodes.push(<em key={key++}>{match[2]}</em>);
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// Plain-text contexts (meta descriptions, JSON-LD, ICS export, etc.) — drop
// the markers rather than showing literal asterisks.
export function stripRichText(text: string): string;
export function stripRichText(text: string | null | undefined): string | null | undefined;
export function stripRichText(text: string | null | undefined): string | null | undefined {
  if (!text) return text;
  // Reuse the same flanking-aware pattern as renderRichText so a stray
  // literal asterisk isn't mistaken for a marker and eaten here either.
  return text.replace(new RegExp(RICH_TEXT_PATTERN), (_m, bold, italic) => bold ?? italic ?? _m);
}
