import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1' // TTS preview model is only available in us-central1
});

function createWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);

  return header;
}

export interface SynthesizeOptions {
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

export const synthesizeSpeech = async (options: SynthesizeOptions): Promise<Buffer> => {
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
    return Buffer.alloc(0);
  }

  const CONCURRENCY_LIMIT = 3;
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
          throw new Error('No audio data returned from Gemini TTS');
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
  const wavHeader = createWavHeader(combinedPcm.length, 24000);
  return Buffer.concat([wavHeader, combinedPcm]);
};
