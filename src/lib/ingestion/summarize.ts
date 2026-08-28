import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { withRetry } from '@/lib/retry';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'global',
  httpOptions: {
    timeout: 60000, // 60s timeout for summarization requests
  }
});

/**
 * Generates a concise podcast episode summary using Gemini.
 * Returns a 1–3 sentence plain-text description suitable for
 * RSS <description> and <itunes:summary> elements.
 *
 * On failure, falls back to a truncated version of the source text
 * so ingestion is never blocked by a summarization error.
 */
export async function summarizeContent(title: string, textContent: string): Promise<string> {
  const fallback = textContent.substring(0, 200).trim() + '...';

  if (!textContent || textContent.trim().length === 0) {
    return fallback;
  }

  // Cap the input to avoid excessive token usage — 8000 chars is plenty for summarization
  const truncatedContent = textContent.substring(0, 8000);

  try {
    const prompt = `You are writing a podcast episode description for a listening app. 
The episode is a spoken-word reading of the following content.

Title: ${title}

Content:
${truncatedContent}

Write a concise, engaging summary of this content in 1–3 sentences. 
The summary should help a listener decide whether to play the episode.

Rules:
- Plain text only, no markdown, no HTML, no hashtags, no links
- Do not mention that it is a podcast episode or that it was converted from text
- Do not include any calls to action
- Maximum 500 characters
- Write in the same language as the content`;

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
        label: 'Episode summarization',
      }
    );

    const summary = response.text?.trim();
    if (summary && summary.length > 0) {
      // Enforce the 500-char cap in case the model is verbose
      return summary.substring(0, 500);
    }

    return fallback;
  } catch (error) {
    console.error('Episode summarization failed, using fallback:', error);
    return fallback;
  }
}
