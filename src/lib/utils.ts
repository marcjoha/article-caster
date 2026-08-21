
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
 * Returns true if the URL looks like a YouTube video.
 */
export function looksLikeYoutubeUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.includes('youtube.com') || hostname.includes('youtu.be');
  } catch {
    return false;
  }
}

/**
 * Returns true if the URL looks like an X or Twitter status/article.
 */
export function looksLikeTwitterUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const isTwitterHost = ['x.com', 'twitter.com', 'mobile.twitter.com', 'fxtwitter.com', 'fixupx.com'].includes(host);
    return isTwitterHost && /\/status(?:es)?\/\d+/i.test(parsed.pathname);
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
    new URL(url); // Validate URL format
    // YouTube URLs are never RSS feeds
    if (looksLikeYoutubeUrl(url)) return true;

    // If it has RSS-like patterns, it's not an article
    if (looksLikeRssFeed(url)) return false;

    // Everything else is assumed to be an article
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves a URL to a friendly "domain / article title" string.
 * Uses the matched episode/item title if available, otherwise falls back
 * to a clean, human-readable representation derived from the URL domain and path.
 */
export function getUrlDisplayString(
  urlStr: string,
  episodes?: { source_url: string; title: string }[]
): string {
  if (!urlStr) return '';
  
  // 1. Try to find a matched episode
  if (episodes) {
    const match = episodes.find(e => e.source_url === urlStr);
    if (match) {
      let domain = '';
      try {
        domain = new URL(urlStr).hostname.replace(/^www\./, '');
      } catch {
        domain = urlStr;
      }
      return `${domain} / ${match.title}`;
    }
  }

  // 2. Fall back to generating a friendly domain / title string from the URL
  try {
    const url = new URL(urlStr);
    const domain = url.hostname.replace(/^www\./, '');
    
    // For YouTube videos
    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      let videoId = '';
      if (url.hostname.includes('youtu.be')) {
        videoId = url.pathname.slice(1);
      } else {
        videoId = url.searchParams.get('v') || '';
      }
      if (videoId) {
        return `${domain} / Video ID: ${videoId}`;
      }
    }

    // For Twitter / X posts
    if (looksLikeTwitterUrl(urlStr)) {
      const match = url.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
      if (match) {
        return `${domain} / @${match[1]} (Post ${match[2]})`;
      }
    }
    
    // Extract last non-empty path segment
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      // Clean up the segment (replace hyphens/underscores with spaces, decode URI, capitalize)
      let cleaned = decodeURIComponent(lastSegment)
        .replace(/[-_]+/g, ' ')
        .trim();
      
      if (cleaned) {
        // Capitalize first letter of each word
        cleaned = cleaned
          .split(/\s+/)
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        // Truncate if extremely long
        if (cleaned.length > 60) {
          cleaned = cleaned.slice(0, 57) + '...';
        }
        return `${domain} / ${cleaned}`;
      }
    }
    
    return `${domain} / Home`;
  } catch {
    return urlStr;
  }
}

/**
 * Returns estimated monthly cost and details for GCS Standard Storage.
 * Standard storage prices vary by region:
 * - Stockholm (europe-north2): $0.020 / GB / month
 * - Iowa (us-central1): $0.020 / GB / month
 * - ...
 */
export function getGcsStorageCost(bytes: number, region: string = 'europe-north2'): {
  cost: number;
  formattedCost: string;
  ratePerGb: number;
} {
  const gb = bytes / (1024 * 1024 * 1024);
  
  // Storage class: Standard Storage list prices by region (per GB per month)
  const regionRates: Record<string, number> = {
    'europe-north2': 0.020, // Stockholm
    'europe-west1': 0.020,  // Belgium
    'europe-west2': 0.023,  // London
    'europe-west3': 0.023,  // Frankfurt
    'europe-west4': 0.020,  // Eemshaven
    'europe-west9': 0.023,  // Paris
    'us-central1': 0.020,   // Iowa
    'us-east1': 0.020,      // South Carolina
    'us-east4': 0.023,      // Northern Virginia
    'us-west1': 0.020,      // Oregon
    'us-west2': 0.023,      // Los Angeles
    'us-west3': 0.023,      // Salt Lake City
    'us-west4': 0.023,      // Las Vegas
  };

  const normalizedRegion = region.toLowerCase();
  const ratePerGb = regionRates[normalizedRegion] ?? 0.020; // Default to $0.020/GB/month if unknown
  
  const cost = gb * ratePerGb;
  const formattedCost = cost.toFixed(2);
  
  return {
    cost,
    formattedCost,
    ratePerGb,
  };
}



