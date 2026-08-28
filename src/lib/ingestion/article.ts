import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import dns from 'node:dns';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { looksLikeTwitterUrl } from '@/lib/utils';
import { extractTwitterArticle } from '@/lib/ingestion/x';
import { withRetry } from '@/lib/retry';

dns.setDefaultResultOrder('ipv4first');

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'global',
  httpOptions: {
    timeout: 60000, // 60s timeout for article processing requests
  }
});

/** Minimum character count for extracted content to be considered a real article. */
const MIN_ARTICLE_LENGTH = 200;

/**
 * Uses a fast Gemini call to classify whether extracted text is genuine article
 * content or site chrome (login walls, paywalls, cookie banners, error pages, etc.).
 * Fails open: if the LLM call itself errors, content passes through.
 */
async function validateExtractedContent(text: string): Promise<{ isArticle: boolean; reason: string }> {
  const sample = text.substring(0, 2000);

  try {
    const prompt = `You are a content quality gate for a podcast ingestion pipeline.
Analyze the following extracted text and determine if it is genuine article/blog content
that would be suitable for text-to-speech podcast generation.

REJECT (isArticle: false) if the text is any of:
- A login page, sign-in form, or authentication prompt
- A paywall or subscription gate
- A cookie consent or privacy notice page
- A site navigation menu, footer, or sidebar with no article body
- An error page, "page not found", or HTTP error message
- A CAPTCHA or bot-detection challenge
- Mostly boilerplate (terms of service, ads, trending topics lists)

ACCEPT (isArticle: true) if the text contains substantive article, blog, essay, or
informational content with a coherent narrative or structure.

Respond with ONLY valid JSON (no markdown code fences): {"isArticle": boolean, "reason": "brief explanation"}

Text to evaluate:
${sample}`;

    const response = await withRetry(
      () =>
        ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: prompt,
          config: {
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
          }
        }),
      {
        maxRetries: 2,
        initialDelayMs: 1500,
        label: 'Content quality validation',
      }
    );

    const raw = response.text?.trim() || '';
    
    // Robustly extract the JSON object from the response string,
    // ignoring any markdown code fences, leading/trailing explanations, or garbage.
    let jsonString = raw;
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = raw.substring(firstBrace, lastBrace + 1);
    } else {
      // Fallback: strip standard markdown code blocks
      jsonString = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    const verdict = JSON.parse(jsonString) as { isArticle: boolean; reason: string };
    return verdict;
  } catch (error) {
    // Fail open: if the quality gate itself errors, let content through
    // so a Gemini outage doesn't break all ingestion.
    console.warn('Content quality gate failed, passing content through:', error);
    return { isArticle: true, reason: 'Quality gate skipped due to error' };
  }
}

export const extractArticleContent = async (url: string): Promise<{ title: string; textContent: string; textBlocks: string[]; language: string }> => {
  let article: { title: string; content: string; textContent: string; lang?: string } | null = null;
  let language = 'en-US';

  // Stage 0: Dedicated X / Twitter extractor
  if (looksLikeTwitterUrl(url)) {
    try {
      const twitterResult = await extractTwitterArticle(url);
      article = {
        title: twitterResult.title,
        content: twitterResult.content,
        textContent: twitterResult.textContent,
        lang: twitterResult.language,
      };
      language = twitterResult.language;
    } catch (twitterErr) {
      console.warn(`X article extraction failed for ${url}:`, twitterErr);
      throw twitterErr;
    }
  }

  // Stage 1: Try direct fetch + Readability
  if (!article) {
    try {
      const directResponse = await fetch(url, { 
        signal: AbortSignal.timeout(15000),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        }
      });

      if (directResponse.ok) {
        const html = await directResponse.text();
        const doc = new JSDOM(html, { url });
        language = doc.window.document.documentElement.lang || 'en-US';
        const reader = new Readability(doc.window.document);
        const parsed = reader.parse();
        if (parsed && parsed.textContent && parsed.textContent.trim().length >= MIN_ARTICLE_LENGTH) {
          article = {
            title: parsed.title || 'Unknown Title',
            content: parsed.content || '',
            textContent: parsed.textContent,
          };
        } else {
          console.warn(`Readability returned insufficient content for ${url}, falling back to Jina`);
        }
      } else {
        console.warn(`Primary fetch failed (${directResponse.status}) for ${url}, falling back to Jina`);
      }
    } catch (error) {
      console.warn(`Primary fetch threw for ${url}, falling back to Jina:`, error);
    }
  }

  // Stage 2: Jina Reader fallback (markdown mode — handles JS-rendered & Cloudflare-protected sites)
  if (!article) {
    const jinaResponse = await fetch(`https://r.jina.ai/${url}`, {
      signal: AbortSignal.timeout(30000),
    });

    if (!jinaResponse.ok) {
      throw new Error(`Failed to fetch article (Jina status: ${jinaResponse.status})`);
    }

    const markdown = await jinaResponse.text();

    // Jina markdown format: "Title: ...\n\nURL Source: ...\n\nMarkdown Content:\n..."
    const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
    const contentStart = markdown.indexOf('Markdown Content:');
    const markdownContent = contentStart !== -1
      ? markdown.substring(contentStart + 'Markdown Content:'.length).trim()
      : markdown;

    if (!markdownContent || markdownContent.trim().length < MIN_ARTICLE_LENGTH) {
      throw new Error(
        `Failed to extract article content. The page may be behind a paywall, ` +
        `require authentication, or no longer exist. (Jina returned ${markdownContent.trim().length} chars)`
      );
    }

    // Store raw markdown content for downstream speech cleanup and parsing
    const jinaTitle = titleMatch?.[1]?.trim() || 'Unknown Title';
    article = {
      title: jinaTitle,
      content: markdownContent,
      textContent: markdownContent,
    };
  }

  // Content quality gate: reject non-article content before it reaches
  // TTS and podcast subscribers (login walls, paywalls, error pages, etc.)
  const rawText = article.textContent.trim();

  if (rawText.length < MIN_ARTICLE_LENGTH) {
    throw new Error(
      `Extracted content too short (${rawText.length} chars). ` +
      'The page may require authentication or contain no article content.'
    );
  }

  const verdict = await validateExtractedContent(rawText);
  if (!verdict.isArticle) {
    throw new Error(`Content quality check failed: ${verdict.reason}`);
  }

function sanitizeHtmlForLlm(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<template\b[^<]*(?:(?!<\/template>)<[^<]*)*<\/template>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s(style|class|data-[a-z0-9-]+|id|onclick|on[a-z]+)="[^"]*"/gi, '')
    .replace(/\s(style|class|data-[a-z0-9-]+|id|onclick|on[a-z]+)='[^']*'/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<picture\b[^<]*(?:(?!<\/picture>)<[^<]*)*<\/picture>/gi, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

  let cleanedHtml = article.content || '';
  const sanitized = sanitizeHtmlForLlm(article.content || '');

  // For excessively long articles (>40k chars), Readability already extracted the clean body,
  // so passing the massive payload to Gemini causes 504 timeouts.
  if (sanitized.length <= 40000) {
    try {
      const prompt = `You are an expert content editor preparing an article for text-to-speech podcast generation. 
Your task is to extract ONLY the main narrative and clean it up.

You MUST completely REMOVE the following elements:
- Author bios, background information, or author titles
- 'Read time' indicators and publishing dates
- 'Listen to this article' or audio player buttons
- Social media sharing links
- Related articles, 'Read More', or 'See More' sections
- Comment sections, user replies, or discussion threads
- Image captions, image credits, or interactive visual instructions (e.g., 'click on the image to make it bigger')
- Any site navigation, footer, or boilerplate text
- Newsletter signup forms

Output ONLY the clean valid HTML for the main narrative. Do not use markdown code blocks or add any conversational text.

HTML:
${sanitized}`;

      const response = await withRetry(
        () =>
          ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
            config: {
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
              ]
            }
          }),
        {
          maxRetries: 1,
          initialDelayMs: 1000,
          label: 'Article narrative cleanup',
        }
      );

      const responseText = response.text;
      if (responseText) {
        cleanedHtml = responseText.replace(/^```html\n?/i, '').replace(/\n?```$/i, '');
      }
    } catch (error) {
      console.warn("LLM narrative cleanup skipped/failed, falling back to Readability content:", error);
    }
  } else {
    cleanedHtml = sanitized;
  }

  const { textBlocks, textContent: cleanedContent } = parseHtmlToTextBlocks(cleanedHtml);

  return {
    title: article.title || 'Unknown Title',
    textContent: cleanedContent,
    language,
    textBlocks,
  };
};

/**
 * Strips markdown markup and converts it to clean, continuous spoken prose.
 */
export function cleanMarkdownForSpeech(markdown: string): string {
  let text = markdown;

  // Remove markdown comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Strip fenced code blocks
  text = text.replace(/```[\s\S]*?```/g, ' ');

  // Strip inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');

  // Strip images
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

  // Convert markdown links [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Convert reference links [text][ref] -> text
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // Strip bare link references [ref]: url
  text = text.replace(/^\[[^\]]+\]:\s*https?:\/\/\S+/gm, '');

  // Convert headings to regular sentences with period if missing punctuation
  text = text.replace(/^#{1,6}\s*(.+)$/gm, (_, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return '';
    return /[.!?:]$/.test(trimmed) ? `${trimmed}\n\n` : `${trimmed}.\n\n`;
  });

  // Bullet / unordered list items: ensure trailing punctuation
  text = text.replace(/^[\s]*[-*+]\s+(.+)$/gm, (_, item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return '';
    return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  });

  // Numbered list items: ensure trailing punctuation
  text = text.replace(/^[\s]*\d+\.\s+(.+)$/gm, (_, item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return '';
    return /[.!?:]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  });

  // Blockquotes
  text = text.replace(/^>\s*(.+)$/gm, '$1');

  // Bold / Italics / Strikethrough
  text = text.replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1');

  // Markdown tables: replace pipe dividers with spaces
  text = text.replace(/\|/g, ' ');
  text = text.replace(/^[\s-:]+$/gm, '');

  // Horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  return text;
}

/**
 * Splits an array of clean paragraphs into cohesive speech chunks (targeting ~500 to 800 chars).
 * Splits along paragraph boundaries first, then sentence boundaries, then clause boundaries,
 * and finally word boundaries. It NEVER splits across a word.
 */
export function chunkParagraphsForSpeech(paragraphs: string[], maxChars: number = 750): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const cleanPara = para.replace(/[ \t]+/g, ' ').trim();
    if (!cleanPara) continue;

    // Check if adding this entire paragraph fits within maxChars
    if (currentChunk && (currentChunk.length + cleanPara.length + 2 > maxChars)) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }

    if (cleanPara.length <= maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanPara;
    } else {
      // Paragraph itself is larger than maxChars: split by sentences
      const sentences = cleanPara.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleanPara];
      for (const sentence of sentences) {
        const s = sentence.trim();
        if (!s) continue;

        if (currentChunk && (currentChunk.length + s.length + 1 > maxChars)) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }

        if (s.length <= maxChars) {
          currentChunk += (currentChunk ? ' ' : '') + s;
        } else {
          // Sentence itself is larger than maxChars: split by clauses
          const clauses = s.match(/[^,;:—]+[,;:—]+(?:\s+|$)|[^,;:—]+$/g) || [s];
          for (const clause of clauses) {
            const cl = clause.trim();
            if (!cl) continue;

            if (currentChunk && (currentChunk.length + cl.length + 1 > maxChars)) {
              chunks.push(currentChunk.trim());
              currentChunk = '';
            }

            if (cl.length <= maxChars) {
              currentChunk += (currentChunk ? ' ' : '') + cl;
            } else {
              // Clause itself is larger than maxChars: split by words
              const words = cl.split(/\s+/);
              for (const word of words) {
                if (currentChunk && (currentChunk.length + word.length + 1 > maxChars)) {
                  chunks.push(currentChunk.trim());
                  currentChunk = '';
                }
                currentChunk += (currentChunk ? ' ' : '') + word;
              }
            }
          }
        }
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Parses HTML or markdown content into spoken-word-optimized text blocks
 * suitable for text-to-speech generation, as well as a plain text string.
 */
export function parseHtmlToTextBlocks(htmlContent: string): { textBlocks: string[]; textContent: string } {
  const cleanedMarkdown = cleanMarkdownForSpeech(htmlContent);
  const dom = new JSDOM(cleanedMarkdown);
  const doc = dom.window.document;

  const removeSelectors = ['script', 'style', 'svg', 'canvas', 'noscript', 'template', 'button', 'nav', 'footer', 'form', 'iframe'];
  removeSelectors.forEach(sel => {
    doc.querySelectorAll(sel).forEach(el => el.remove());
  });

  const blockElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, dt, dd');
  const rawParagraphs: string[] = [];

  if (blockElements.length > 0) {
    blockElements.forEach(el => {
      let t = (el.textContent || '').replace(/[ \t]+/g, ' ').trim();
      if (!t) return;
      const isHeading = /^h[1-6]$/i.test(el.tagName);
      if (isHeading && !/[.!?:]$/.test(t)) {
        t += '.';
      }
      rawParagraphs.push(t);
    });
  } else {
    const text = doc.body.textContent || '';
    text.split(/\n\s*\n/).forEach(p => {
      const t = p.replace(/[ \t]+/g, ' ').trim();
      if (t) rawParagraphs.push(t);
    });
  }

  const textBlocks = chunkParagraphsForSpeech(rawParagraphs, 750);
  const textContent = rawParagraphs.join('\n\n');

  return { textBlocks, textContent };
}
