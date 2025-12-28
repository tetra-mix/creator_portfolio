export async function loadBookContent(): Promise<string[]> {
  try {
    // Build an absolute URL based on current origin and Vite base path
    const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin);
    const url = new URL('content.json', base).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    // Fallback to bundled content when not available
    const mod = await import('./bookContent');
    return mod.bookContent ?? [];
  }
}
