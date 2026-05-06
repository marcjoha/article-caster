import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export const extractArticleContent = async (url: string): Promise<{ title: string; textContent: string; ssmlBlocks: string[]; language: string }> => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
  const ssmlBlocks: string[] = [];
  
  for (const el of Array.from(elements)) {
    const text = el.textContent?.trim();
    if (!text) continue;
    
    const escapeXml = (str: string) => str
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const tagName = el.tagName.toLowerCase();
    const breakTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)
      ? '<break time="1s"/>'
      : tagName === 'blockquote'
      ? '<break time="800ms"/>'
      : '<break time="500ms"/>';

    let currentChunk = '';
    const sentences = text.split(/(?<=[.!?])\s+|(?=\n)/);

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;

      if (currentChunk.length + sentence.length > 3000) {
        if (currentChunk) {
          ssmlBlocks.push(`${escapeXml(currentChunk.trim())}${breakTag}`);
          currentChunk = '';
        }

        let remaining = sentence;
        while (remaining.length > 3000) {
          const chars = Array.from(remaining);
          const safeChunk = chars.slice(0, 3000).join('');
          ssmlBlocks.push(`${escapeXml(safeChunk)}${breakTag}`);
          remaining = chars.slice(3000).join('');
        }
        currentChunk = remaining;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      ssmlBlocks.push(`${escapeXml(currentChunk.trim())}${breakTag}`);
    }
  }

  return {
    title: article.title || 'Unknown Title',
    textContent: cleanedContent,
    language,
    ssmlBlocks,
  };
};
