import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const extractArticleContent = async (url: string): Promise<{ title: string; textContent: string; textBlocks: string[]; language: string }> => {
  const response = await fetch(url, { 
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch article (Status: ${response.status})`);
  }
  
  const html = await response.text();
  const doc = new JSDOM(html, { url });
  
  const reader = new Readability(doc.window.document);
  const article = reader.parse();
  
  if (!article || !article.textContent) {
    throw new Error('Failed to extract article content.');
  }

  const cleanedContent = article.textContent
    .replace(/[ \t]+/g, ' ')
    .replace(/\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();

  // Extract language
  const language = doc.window.document.documentElement.lang || 'en-US';

  // Generate SSML blocks from HTML content
  const contentDoc = new JSDOM(article.content || '');
  const elements = contentDoc.window.document.body.children;
  const textBlocks: string[] = [];
  
  for (const el of Array.from(elements)) {
    const text = el.textContent?.trim();
    if (!text) continue;
    
    const tagName = el.tagName.toLowerCase();
    const pauseStr = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tagName)
      ? '\n\n'
      : '\n';

    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+|(?=\n)/);

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;

      if (currentChunk.length + sentence.length > 3000) {
        if (currentChunk) {
          textBlocks.push(`${currentChunk.trim()}${pauseStr}`);
          currentChunk = '';
        }

        let remaining = sentence;
        while (remaining.length > 3000) {
          const chars = Array.from(remaining);
          const safeChunk = chars.slice(0, 3000).join('');
          textBlocks.push(`${safeChunk}${pauseStr}`);
          remaining = chars.slice(3000).join('');
        }
        currentChunk = remaining;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      textBlocks.push(`${currentChunk.trim()}${pauseStr}`);
    }
  }

  return {
    title: article.title || 'Unknown Title',
    textContent: cleanedContent,
    language,
    textBlocks,
  };
};
