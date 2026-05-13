import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1' // TTS preview model is only available in us-central1
});

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

function getWavHeader(dataLength: number, sampleRate: number = 24000, numChannels: number = 1, bitsPerSample: number = 16) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40); // Subchunk2Size
  return header;
}

export const synthesizeSpeech = async (options: SynthesizeOptions): Promise<SynthesizeResult> => {
  const voiceName = resolveVoice(options.voicePreference);
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const block of options.textBlocks) {
    if (currentChunk.length + block.length > 1500) {
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

  const header = getWavHeader(combinedPcm.length, 24000);
  const audioBuffer = Buffer.concat([header, combinedPcm]);

  return { audioBuffer, durationSeconds };
};
