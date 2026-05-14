import { NextResponse } from 'next/server';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const voice = searchParams.get('voice') || 'Puck';
    
    // Auto resolution for preview
    const voiceName = voice === 'auto' ? 'Puck' : voice;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: `Hello there! This is a preview of my voice.`,
      config: {
        responseModalities: ["AUDIO"],
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
        ],
        speechConfig: {
          languageCode: 'en-US',
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
      throw new Error('No audio data returned');
    }

    const pcmBuffer = Buffer.from(audioB64, 'base64');
    const wavHeader = createWavHeader(pcmBuffer.length, 24000);
    const fullBuffer = Buffer.concat([wavHeader, pcmBuffer]);

    return new NextResponse(fullBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': fullBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  }
}
