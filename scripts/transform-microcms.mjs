#!/usr/bin/env node
// Usage: node scripts/transform-microcms.mjs <input.json> <output.json>
// Transforms microCMS list JSON into an array of Markdown strings

import fs from 'node:fs';
import path from 'node:path';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('Usage: node scripts/transform-microcms.mjs <input.json> <output.json>');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inPath, 'utf8'));
/**
 * Accept common microCMS shapes:
 * - { contents: [{ content, num, updated_at|updatedAt }], ... }
 * - { contents: [{ title, body, order }], ... }
 * - { contents: [{ title, content, order }], ... }
 * - { items: [...] }
 */
const list = Array.isArray(raw?.contents)
  ? raw.contents
  : Array.isArray(raw?.items)
    ? raw.items
    : [];

let mdArray = [];
if (list.some((it) => typeof it?.num !== 'undefined')) {
  // Prefer explicit page number mapping when 'num' exists.
  // Sort ascending by num to keep a predictable order for non-mapped items too.
  const sorted = list.slice().sort((a, b) => {
    const na = Number.parseInt(a?.num, 10);
    const nb = Number.parseInt(b?.num, 10);
    const aa = Number.isFinite(na) ? na : Number.POSITIVE_INFINITY;
    const bb = Number.isFinite(nb) ? nb : Number.POSITIVE_INFINITY;
    return aa - bb;
  });

  const maxNum = sorted.reduce((m, it) => {
    const n = Number.parseInt(it?.num, 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  mdArray = Array.from({ length: Math.max(0, maxNum) }, () => '');
  for (const it of sorted) {
    const n = Number.parseInt(it?.num, 10);
    const body = it?.content ?? it?.body ?? '';
    if (Number.isFinite(n) && n >= 1 && n <= mdArray.length) {
      mdArray[n - 1] = String(body);
    } else {
      mdArray.push(String(body));
    }
  }
} else {
  // Fallback: order by 'order' if present, otherwise keep as-is
  list.sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  mdArray = list.map((it) => {
    const title = it?.title ?? '';
    const body = it?.body ?? it?.content ?? '';
    const parts = [];
    if (title) parts.push(`# ${title}`);
    if (body) parts.push(String(body));
    return parts.join('\n\n');
  });
}

const outDir = path.dirname(outPath);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(mdArray, null, 2), 'utf8');
console.log(`Wrote ${mdArray.length} entries to ${outPath}`);
