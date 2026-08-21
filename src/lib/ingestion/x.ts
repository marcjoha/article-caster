/**
 * Extractor for X / Twitter longform articles and posts via the FxTwitter API proxy.
 */

interface DraftJsBlock {
  key?: string;
  text?: string;
  type?: string;
  data?: Record<string, unknown>;
  inlineStyleRanges?: Array<{ offset: number; length: number; style: string }>;
  entityRanges?: Array<{ offset: number; length: number; key: number }>;
}

interface FxTwitterResponse {
  code?: number;
  message?: string;
  tweet?: {
    id?: string;
    url?: string;
    text?: string;
    lang?: string;
    author?: {
      name?: string;
      screen_name?: string;
    };
    article?: {
      id?: string;
      title?: string;
      preview_text?: string;
      content?: {
        blocks?: DraftJsBlock[];
      };
      cover_media?: {
        media_info?: {
          original_img_url?: string;
        };
      };
    };
  };
}

/**
 * Parses screen name and status ID from a Twitter / X URL.
 */
export function parseTwitterUrl(url: string): { screenName: string; statusId: string } | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!['x.com', 'twitter.com', 'mobile.twitter.com', 'fxtwitter.com', 'fixupx.com'].includes(host)) {
      return null;
    }

    // Match patterns like /<screenName>/status/<statusId>
    const match = parsed.pathname.match(/^\/([^/]+)\/status(?:es)?\/(\d+)/i);
    if (match) {
      return {
        screenName: match[1],
        statusId: match[2],
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Converts Draft.js content blocks into clean, semantic HTML.
 */
function draftBlocksToHtml(blocks: DraftJsBlock[]): string {
  const htmlParts: string[] = [];
  let inOrderedList = false;
  let inUnorderedList = false;

  const closeLists = () => {
    if (inOrderedList) {
      htmlParts.push('</ol>');
      inOrderedList = false;
    }
    if (inUnorderedList) {
      htmlParts.push('</ul>');
      inUnorderedList = false;
    }
  };

  for (const block of blocks) {
    const text = block.text?.trim();
    if (!text) continue;

    const blockType = block.type || 'unstyled';

    // Handle lists
    if (blockType === 'ordered-list-item') {
      if (inUnorderedList) {
        htmlParts.push('</ul>');
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        htmlParts.push('<ol>');
        inOrderedList = true;
      }
      htmlParts.push(`<li>${escapeHtml(text)}</li>`);
      continue;
    } else if (blockType === 'unordered-list-item') {
      if (inOrderedList) {
        htmlParts.push('</ol>');
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        htmlParts.push('<ul>');
        inUnorderedList = true;
      }
      htmlParts.push(`<li>${escapeHtml(text)}</li>`);
      continue;
    }

    // If not in a list item, close any open list
    closeLists();

    switch (blockType) {
      case 'header-one':
        htmlParts.push(`<h1>${escapeHtml(text)}</h1>`);
        break;
      case 'header-two':
        htmlParts.push(`<h2>${escapeHtml(text)}</h2>`);
        break;
      case 'header-three':
        htmlParts.push(`<h3>${escapeHtml(text)}</h3>`);
        break;
      case 'blockquote':
        htmlParts.push(`<blockquote>${escapeHtml(text)}</blockquote>`);
        break;
      case 'code-block':
        htmlParts.push(`<pre><code>${escapeHtml(text)}</code></pre>`);
        break;
      case 'unstyled':
      default:
        htmlParts.push(`<p>${escapeHtml(text)}</p>`);
        break;
    }
  }

  closeLists();

  return `<article>${htmlParts.join('\n')}</article>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Extracts longform article or post content from an X / Twitter URL using the FxTwitter API proxy.
 */
export async function extractTwitterArticle(url: string): Promise<{
  title: string;
  content: string;
  textContent: string;
  language: string;
}> {
  const parsed = parseTwitterUrl(url);
  if (!parsed) {
    throw new Error(`Invalid or unsupported X / Twitter URL format: ${url}`);
  }

  const { screenName, statusId } = parsed;
  const apiUrl = `https://api.fxtwitter.com/${screenName}/status/${statusId}`;

  const response = await fetch(apiUrl, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`X post not found or account is private (${url}).`);
    }
    if (response.status === 429) {
      throw new Error('Rate limit exceeded on X article proxy. Please try again later.');
    }
    throw new Error(`Failed to fetch X article from proxy (HTTP ${response.status})`);
  }

  const data = (await response.json()) as FxTwitterResponse;
  const tweet = data.tweet;

  if (!tweet) {
    throw new Error('No post data returned from X proxy.');
  }

  const authorName = tweet.author?.name ? `${tweet.author.name} (@${tweet.author.screen_name})` : `@${screenName}`;
  const language = tweet.lang || 'en-US';

  // Case 1: X Article (Draft.js blocks)
  if (tweet.article && tweet.article.content?.blocks && tweet.article.content.blocks.length > 0) {
    const articleTitle = tweet.article.title || `Article by ${authorName}`;
    const htmlContent = draftBlocksToHtml(tweet.article.content.blocks);
    const plainText = tweet.article.content.blocks
      .map(b => b.text?.trim())
      .filter(Boolean)
      .join('\n\n');

    return {
      title: articleTitle,
      content: htmlContent,
      textContent: plainText,
      language,
    };
  }

  // Case 2: Standard Post / Long Post (text only)
  const postText = tweet.text?.trim() || '';
  if (!postText) {
    throw new Error('The X post does not contain any text content.');
  }

  const postTitle = `Post by ${authorName}`;
  const htmlContent = `<article><p>${escapeHtml(postText)}</p></article>`;

  return {
    title: postTitle,
    content: htmlContent,
    textContent: postText,
    language,
  };
}
