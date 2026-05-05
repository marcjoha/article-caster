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
    
    // Escape XML characters for valid SSML
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const tagName = el.tagName.toLowerCase();
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      ssmlBlocks.push(`${escapedText}<break time="1s"/>`);
    } else if (tagName === 'blockquote') {
      ssmlBlocks.push(`${escapedText}<break time="800ms"/>`);
    } else {
      ssmlBlocks.push(`${escapedText}<break time="500ms"/>`);
    }
  }

  return {
    title: article.title || 'Unknown Title',
    textContent: cleanedContent,
    language,
    ssmlBlocks,
  };
};
