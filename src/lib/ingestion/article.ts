import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import dns from 'node:dns';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

dns.setDefaultResultOrder('ipv4first');

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1'
});


export const extractArticleContent = async (url: string): Promise<{ title: string; textContent: string; textBlocks: string[]; language: string }> => {
  let response = await fetch(url, { 
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });
  
  if (!response.ok) {
    console.warn(`Primary fetch failed (${response.status}), falling back to Jina API for ${url}`);
    response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'X-Return-Format': 'html'
      },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article (Status: ${response.status}) even with Jina fallback`);
    }
  }
  
  const html = await response.text();
  const doc = new JSDOM(html, { url });
  
  const reader = new Readability(doc.window.document);
  const article = reader.parse();
  
  if (!article || !article.textContent) {
    throw new Error('Failed to extract article content.');
  }

  let cleanedHtml = article.content || '';
  try {
    const prompt = `You are an assistant preparing articles for text-to-speech. 
Please take the following extracted article HTML and remove any boilerplate, metadata, 'read time' indicators, 'listen to this article' buttons, author bios, and site navigation that do not belong to the main narrative. 
Output ONLY the clean valid HTML for the main narrative. Do not use markdown code blocks.

HTML:
${article.content}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash',
      contents: prompt,
      config: {
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    const responseText = response.text;
    if (responseText) {
      cleanedHtml = responseText.replace(/^```html\n?/i, '').replace(/\n?```$/i, '');
    }
  } catch (error) {
    console.error("LLM cleanup failed, falling back to original extracted content:", error);
  }

  const contentDoc = new JSDOM(cleanedHtml);

  const cleanedContent = (contentDoc.window.document.body.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();

  // Extract language
  const language = doc.window.document.documentElement.lang || 'en-US';

  // Generate SSML blocks from HTML content
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

      if (currentChunk.length + sentence.length > 1200) {
        if (currentChunk) {
          textBlocks.push(`${currentChunk.trim()}${pauseStr}`);
          currentChunk = '';
        }

        let remaining = sentence;
        while (remaining.length > 1200) {
          const chars = Array.from(remaining);
          const safeChunk = chars.slice(0, 1200).join('');
          textBlocks.push(`${safeChunk}${pauseStr}`);
          remaining = chars.slice(1200).join('');
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
