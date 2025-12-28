#!/usr/bin/env node
// Fetch microCMS contents at local time and transform to public/content.json
// Usage: pnpm fetch:content

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const domain = process.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = process.env.MICROCMS_API_KEY;
const explicitEndpoint = process.env.MICROCMS_API_ENDPOINT;

if (!domain || !apiKey) {
  console.error('[fetch-content] MICROCMS_SERVICE_DOMAIN or MICROCMS_API_KEY is not set');
  process.exit(1);
}

function resolveBaseEndpoint(domain, explicit) {
  if (explicit && explicit.trim()) {
    const e = explicit.trim();
    // Full URL
    if (/^https?:\/\//i.test(e)) return e;
    // Path starting with '/'
    if (e.startsWith('/')) {
      if (!domain)
        throw new Error('MICROCMS_SERVICE_DOMAIN is required when MICROCMS_API_ENDPOINT is a path');
      return `https://${domain}.microcms.io${e}`;
    }
    // Resource name or path fragment
    if (!domain)
      throw new Error(
        'MICROCMS_SERVICE_DOMAIN is required when MICROCMS_API_ENDPOINT is not a full URL',
      );
    // If includes '/', treat as relative path under host
    if (e.includes('/')) return `https://${domain}.microcms.io/${e}`;
    // Else treat as API resource under /api/v1/{name}
    return `https://${domain}.microcms.io/api/v1/${e}`;
  }
  if (domain) return `https://${domain}.microcms.io/api/v1/pages`;
  throw new Error('MICROCMS_API_ENDPOINT or MICROCMS_SERVICE_DOMAIN must be set');
}

let baseEndpoint;
try {
  baseEndpoint = resolveBaseEndpoint(domain, explicitEndpoint);
} catch (e) {
  console.error(`[fetch-content] ${e.message}`);
  process.exit(1);
}

// Ensure query params (limit, orders) are present
const u = new URL(baseEndpoint);
if (!u.searchParams.has('limit')) u.searchParams.set('limit', '100');
if (!u.searchParams.has('orders')) u.searchParams.set('orders', 'order');
const endpoint = u.toString();

async function main() {
  console.log(`[fetch-content] Fetching: ${endpoint}`);
  const res = await fetch(endpoint, { headers: { 'X-MICROCMS-API-KEY': apiKey } });
  if (!res.ok) {
    console.error(`[fetch-content] Failed: ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const json = await res.json();

  const pubDir = path.join(process.cwd(), 'public');
  fs.mkdirSync(pubDir, { recursive: true });
  const rawPath = path.join(pubDir, 'microcms.raw.json');
  const outPath = path.join(pubDir, 'content.json');
  fs.writeFileSync(rawPath, JSON.stringify(json, null, 2), 'utf8');
  console.log(`[fetch-content] Wrote raw: ${rawPath}`);

  const r = spawnSync(process.execPath, ['scripts/transform-microcms.mjs', rawPath, outPath], {
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[fetch-content] transform-microcms failed');
    process.exit(r.status ?? 1);
  }
  console.log(`[fetch-content] Done: ${outPath}`);
}

main().catch((err) => {
  console.error('[fetch-content] Error', err);
  process.exit(1);
});
