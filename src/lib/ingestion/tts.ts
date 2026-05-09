import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1' // TTS preview model is only available in us-central1
});

// Fix for lamejs ReferenceError: MPEGMode is not defined
if (typeof global !== 'undefined') {
  /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
  (global as any).MPEGMode = require('lamejs/src/js/MPEGMode.js');
  (global as any).Lame = require('lamejs/src/js/Lame.js');
  (global as any).BitStream = require('lamejs/src/js/BitStream.js');
}
const lamejs = require('lamejs');
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const { Mp3Encoder } = lamejs;

interface SynthesizeOptions {
  textBlocks: string[];
  language: string;
  voicePreference?: string;
}

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

export const synthesizeSpeech = async (options: SynthesizeOptions): Promise<SynthesizeResult> => {
  const voiceName = resolveVoice(options.voicePreference);
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const block of options.textBlocks) {
    if (currentChunk.length + block.length > 7500) {
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

  const CONCURRENCY_LIMIT = 1;
  const audioBuffers: Buffer[] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    const batchPromises = batch.map(async (chunk, batchIndex) => {
      const globalIndex = i + batchIndex;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-tts-preview',
          contents: `Say the following text clearly and naturally for a podcast summary: ${chunk}`,
          config: {
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
            ],
            speechConfig: {
              languageCode: options.language || 'en-US',
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
        audioBuffers[globalIndex] = Buffer.from(audioB64, 'base64');
      } catch (err) {
        console.error(`Error synthesizing chunk ${globalIndex}:`, err);
        throw err;
      }
    });

    await Promise.all(batchPromises);
    
    if (i + CONCURRENCY_LIMIT < chunks.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const combinedPcm = Buffer.concat(audioBuffers);
  const durationSeconds = Math.round(combinedPcm.length / 48000); // 24000Hz * 1 channel * 2 bytes/sample = 48000 bytes/sec

  // Convert Buffer to Int16Array for lamejs
  const samples = new Int16Array(combinedPcm.buffer, combinedPcm.byteOffset, combinedPcm.length / 2);
  const mp3encoder = new Mp3Encoder(1, 24000, 32); // mono, 24000Hz, 32kbps
  
  const mp3Data: Buffer[] = [];
  const sampleBlockSize = 576; // MPEG-2 LSF uses 576 samples per frame
  
  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const encoded = mp3encoder.encodeBuffer(sampleChunk);
    if (encoded.length > 0) {
      mp3Data.push(Buffer.from(encoded));
    }
  }
  
  const flushed = mp3encoder.flush();
  if (flushed.length > 0) {
    mp3Data.push(Buffer.from(flushed));
  }

  const audioBuffer = Buffer.concat(mp3Data);
  return { audioBuffer, durationSeconds };
};
