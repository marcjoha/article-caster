/**
 * Formats a date as YYYY-MM-DD
 */
function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a date as YYYY-MM-DD HH:mm
 */
export function formatDateTime(date: Date | string | number): string {
  const d = new Date(date);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)} ${hours}:${minutes}`;
}

/** Common RSS/Atom feed URL patterns */
const RSS_PATH_PATTERNS = [
  /\/feed\/?$/i,
  /\/rss\/?$/i,
  /\/atom\/?$/i,
  /\/feeds?\//i,
  /\/rss\//i,
  /\/atom\//i,
];

const RSS_EXTENSION_PATTERNS = [
  /\.rss$/i,
  /\.xml$/i,
  /\.atom$/i,
];

/**
 * Returns true if the URL looks like an RSS/Atom feed rather than a regular article.
 * Uses heuristics based on common feed URL conventions.
 */
export function looksLikeRssFeed(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Check for RSS-specific file extensions
    if (RSS_EXTENSION_PATTERNS.some(p => p.test(pathname))) return true;

    // Check for common feed path patterns
    if (RSS_PATH_PATTERNS.some(p => p.test(pathname))) return true;

    // Check for feed-related query parameters (e.g., ?format=rss, ?feed=rss)
    const format = parsed.searchParams.get('format');
    const feed = parsed.searchParams.get('feed');
    if (format && /^(rss|atom|xml)$/i.test(format)) return true;
    if (feed && /^(rss|atom|xml)$/i.test(feed)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL looks like a regular article or YouTube video
 * rather than an RSS feed.
 */
export function looksLikeArticleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // YouTube URLs are never RSS feeds
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) return true;

    // If it has RSS-like patterns, it's not an article
    if (looksLikeRssFeed(url)) return false;

    // Everything else is assumed to be an article
    return true;
  } catch {
    return false;
  }
}

