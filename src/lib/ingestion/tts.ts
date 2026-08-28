import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { createWavHeader } from '@/lib/audio';
import { withRetry } from '@/lib/retry';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1', // TTS preview model is only available in us-central1
  httpOptions: {
    timeout: 120000, // 120s timeout for audio generation requests
  }
});

interface SynthesizeOptions {
  textBlocks: string[];
  language: string;
  voicePreference?: string;
}

/**
 * Normalizes a language code to a full BCP-47 locale required by Gemini TTS.
 * Many websites set bare codes like "en" instead of "en-US", which the API rejects
 * with INVALID_ARGUMENT.
 */
const normalizeLanguageCode = (lang: string): string => {
  const code = lang.trim().toLowerCase();

  // Already a full BCP-47 code (e.g. "en-US", "fr-FR")
  if (code.includes('-')) return code;

  // Map bare language codes to their default region
  const defaults: Record<string, string> = {
    en: 'en-US',
    fr: 'fr-FR',
    de: 'de-DE',
    es: 'es-ES',
    it: 'it-IT',
    pt: 'pt-BR',
    nl: 'nl-NL',
    ja: 'ja-JP',
    ko: 'ko-KR',
    ru: 'ru-RU',
    ar: 'ar-EG',
    hi: 'hi-IN',
    pl: 'pl-PL',
    tr: 'tr-TR',
    vi: 'vi-VN',
    th: 'th-TH',
    ro: 'ro-RO',
    uk: 'uk-UA',
    id: 'id-ID',
    sv: 'sv-SE',
    da: 'da-DK',
    fi: 'fi-FI',
    nb: 'nb-NO',
    no: 'nb-NO',
  };

  return defaults[code] || 'en-US';
};

const resolveVoice = (voicePreference?: string) => {
  const validVoices = ['Puck', 'Kore', 'Aoede', 'Charon', 'Fenrir', 'Leda'];
  if (voicePreference && validVoices.includes(voicePreference)) {
    return voicePreference;
  }
  return 'Puck'; // Default Gemini voice
};

interface SynthesizeResult {
  audioBuffer: Buffer;
  durationSeconds: number;
}

function crossfadeBuffers(buffers: Buffer[], overlapSamples: number = 1200): Buffer {
  const validBuffers = buffers.filter(b => b && b.length > 0);
  if (validBuffers.length === 0) return Buffer.alloc(0);
  if (validBuffers.length === 1) return validBuffers[0];

  let overlapBytes = overlapSamples * 2;
  for (const buf of validBuffers) {
    if (buf.length < overlapBytes * 2) {
      overlapBytes = Math.floor(buf.length / 4) * 2;
    }
  }
  const actualOverlapSamples = overlapBytes / 2;

  const totalLength = validBuffers.reduce((sum, buf) => sum + buf.length, 0) - (overlapBytes * (validBuffers.length - 1));
  const result = Buffer.alloc(totalLength);
  
  let currentOffset = 0;
  
  for (let i = 0; i < validBuffers.length; i++) {
    const currentBuf = validBuffers[i];
    
    if (i === 0) {
      const bytesToCopy = currentBuf.length - overlapBytes;
      currentBuf.copy(result, currentOffset, 0, bytesToCopy);
      currentOffset += bytesToCopy;
    } else {
      const prevBuf = validBuffers[i - 1];
      const prevOverlapStart = prevBuf.length - overlapBytes;
      
      if (actualOverlapSamples > 0) {
        for (let j = 0; j < actualOverlapSamples; j++) {
          const prevSample = prevBuf.readInt16LE(prevOverlapStart + j * 2);
          const currSample = currentBuf.readInt16LE(j * 2);
          const fadeRatio = j / actualOverlapSamples;
          const fadedSample = Math.round((prevSample * (1 - fadeRatio)) + (currSample * fadeRatio));
          const clampedSample = Math.max(-32768, Math.min(32767, fadedSample));
          result.writeInt16LE(clampedSample, currentOffset);
          currentOffset += 2;
        }
      }
      
      if (i < validBuffers.length - 1) {
        const bytesToCopy = currentBuf.length - (overlapBytes * 2);
        currentBuf.copy(result, currentOffset, overlapBytes, currentBuf.length - overlapBytes);
        currentOffset += bytesToCopy;
      } else {
        const bytesToCopy = currentBuf.length - overlapBytes;
        currentBuf.copy(result, currentOffset, overlapBytes);
        currentOffset += bytesToCopy;
      }
    }
  }
  
  return result;
}

export const synthesizeSpeech = async (options: SynthesizeOptions): Promise<SynthesizeResult> => {
  const voiceName = resolveVoice(options.voicePreference);
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const block of options.textBlocks) {
    if (currentChunk.length + block.length > 300) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk);
      }
      currentChunk = block;
    } else {
      currentChunk += block;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  if (chunks.length === 0) {
    return { audioBuffer: Buffer.alloc(0), durationSeconds: 0 };
  }

  const CONCURRENCY_LIMIT = 3;
  const MAX_RETRIES = 3;
  const audioBuffers: Buffer[] = new Array(chunks.length);

  const synthesizeChunk = async (chunk: string, index: number): Promise<void> => {
    await withRetry(
      async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: `Say the following text clearly and naturally for a podcast summary: ${chunk}`,
          config: {
            responseModalities: ["AUDIO"],
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ],
            speechConfig: {
              languageCode: normalizeLanguageCode(options.language || 'en-US'),
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName
                }
              }
            }
          }
        });

        const audioB64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioB64) {
          const finishReason = response.candidates?.[0]?.finishReason;
          const blockReason = response?.promptFeedback?.blockReason;
          
          let errorMessage = 'No audio data returned from Gemini TTS';
          if (finishReason) errorMessage += ` (${finishReason})`;
          if (blockReason) errorMessage += ` (${blockReason})`;
          
          console.error('Gemini TTS missing audio payload. Full response:', JSON.stringify(response, null, 2));
          throw new Error(errorMessage);
        }
        audioBuffers[index] = Buffer.from(audioB64, 'base64');
      },
      {
        maxRetries: MAX_RETRIES,
        initialDelayMs: 2000,
        label: `TTS chunk ${index + 1}/${chunks.length}`,
      }
    );
  };

  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.all(batch.map((chunk, batchIndex) => synthesizeChunk(chunk, i + batchIndex)));
  }

  const combinedPcm = crossfadeBuffers(audioBuffers, 1200); // 50ms overlap at 24kHz
  const durationSeconds = Math.round(combinedPcm.length / 48000); // 24000Hz * 1 channel * 2 bytes/sample = 48000 bytes/sec

  const header = createWavHeader(combinedPcm.length, 24000);
  const audioBuffer = Buffer.concat([header, combinedPcm]);

  return { audioBuffer, durationSeconds };
};
