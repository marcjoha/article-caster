import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'global'
});

interface PdfExtractionResult {
  title: string;
  htmlContent: string;
}

/**
 * Uses Gemini 3.5 Flash to natively parse PDF content (even multi-column papers or books),
 * extracting the title and clean semantic HTML narrative suitable for TTS processing.
 */
export async function extractPdfContent(pdfBuffer: Buffer): Promise<{ title: string; htmlContent: string }> {
  try {
    const base64Data = pdfBuffer.toString('base64');

    const prompt = `You are an expert content editor preparing a PDF document (which may be a multi-column academic paper, standard report, newsletter, or book) for text-to-speech podcast generation.

Your task is to analyze the document, extract the main title, and extract the full body/narrative of the text.

You MUST adhere to these formatting and editing rules strictly:
1. Identify the primary title of the document or research paper.
2. Extract the main substantive content (e.g. Abstract, Introduction, main sections) and structure it using clean, semantic, valid HTML (e.g. <h1>, <h2>, <p>, <blockquote>). Do not use markdown code fences in your output, respond only with raw JSON.
3. Prepare the text for high-quality text-to-speech:
   - Completely strip all academic/inline citations (e.g., "[1]", "[2-5]", parenthetical citations like "(Smith et al., 2018)").
   - Strip page headers, footers, page numbers, journal watermark branding, and publishing metadata.
   - Strip lists of authors, affiliations, and copyright declarations.
   - Do NOT include any "References", "Bibliography", or "Works Cited" sections from the end of the document.
   - Read/extract the text in its natural, continuous reading order even if the layout is multi-column or contains sidebar panels/callouts.
   - If there are math formulas, transcribe them into simple, spoken English text equivalents (e.g., "E = mc^2" becomes "E equals m c squared").
   - Strip captions of tables or figures.
4. Ensure the extracted text feels cohesive, reads naturally, and transitions beautifully between pages and sections.

Respond with ONLY valid JSON matching this schema:
{
  "title": "The exact main title of the document",
  "htmlContent": "The clean, semantic HTML of the extracted main body text"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'application/pdf',
          },
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            htmlContent: { type: 'STRING' }
          },
          required: ['title', 'htmlContent']
        },
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ]
      }
    });

    const text = response.text?.trim() || '';
    
    // Robustly extract the JSON object from the response string,
    // ignoring any markdown code fences, leading/trailing explanations, or garbage.
    let jsonString = text;
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = text.substring(firstBrace, lastBrace + 1);
    } else {
      // Fallback: strip standard markdown code blocks
      jsonString = text.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim();
    }

    const data = JSON.parse(jsonString) as PdfExtractionResult;

    if (!data.title || !data.htmlContent) {
      throw new Error('Gemini failed to return title or htmlContent in the expected schema');
    }

    return {
      title: data.title.trim(),
      htmlContent: data.htmlContent.trim(),
    };
  } catch (error) {
    console.error('Gemini PDF extraction failed:', error);
    throw new Error(`PDF content extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
