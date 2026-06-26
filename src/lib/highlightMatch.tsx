import React from "react";

/**
 * Highlight occurrences of `query` characters within `text`.
 * Uses a simple case-insensitive substring match; falls back to char-by-char if no contiguous match.
 */
export function highlightMatch(text: string, query: string): React.ReactNode {
  if (!text) return text;
  const q = (query || "").trim();
  if (!q) return text;
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  const idx = lower.indexOf(needle);
  if (idx >= 0) {
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-primary/15 text-primary font-semibold rounded px-0.5">
          {text.slice(idx, idx + needle.length)}
        </mark>
        {text.slice(idx + needle.length)}
      </>
    );
  }
  // fuzzy: highlight matching chars in order
  const chars = needle.split("");
  let ci = 0;
  return (
    <>
      {text.split("").map((ch, i) => {
        if (ci < chars.length && ch.toLowerCase() === chars[ci]) {
          ci++;
          return (
            <mark key={i} className="bg-primary/15 text-primary font-semibold rounded">
              {ch}
            </mark>
          );
        }
        return <span key={i}>{ch}</span>;
      })}
    </>
  );
}