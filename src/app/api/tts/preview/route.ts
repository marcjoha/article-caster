import { NextResponse } from 'next/server';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { createWavHeader } from '@/lib/audio';
import { withRetry } from '@/lib/retry';

const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1', // TTS preview model is only available in us-central1
  httpOptions: {
    timeout: 30000,
  }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const voice = searchParams.get('voice') || 'Puck';
    
    // Auto resolution for preview
    const voiceName = voice === 'auto' ? 'Puck' : voice;

    const response = await withRetry(
      () =>
        ai.models.generateContent({
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
        }),
      {
        maxRetries: 2,
        initialDelayMs: 1000,
        label: 'TTS voice preview',
      }
    );

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
