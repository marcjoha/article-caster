import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'airy-rock-454920-i5',
});

// Using a Journey voice as requested for highly expressive audio
const VOICE_NAME = 'en-US-Journey-F';

export const synthesizeSpeech = async (text: string): Promise<Buffer> => {
  // TTS has a limit of ~5000 characters per request.
  // We chunk by 4000 characters and concatenate the resulting MP3 buffers.
  
  const chunks = text.match(/.{1,4000}(\s|$)/g) || [text];
  
  const CONCURRENCY_LIMIT = 3;
  const audioBuffers: Buffer[] = new Array(chunks.length);

  for (let i = 0; i < chunks.length; i += CONCURRENCY_LIMIT) {
    const batch = chunks.slice(i, i + CONCURRENCY_LIMIT);
    const batchPromises = batch.map(async (chunk, batchIndex) => {
      const globalIndex = i + batchIndex;
      if (!chunk.trim()) {
        audioBuffers[globalIndex] = Buffer.alloc(0);
        return;
      }
      
      const request = {
        input: { text: chunk },
        voice: { languageCode: 'en-US', name: VOICE_NAME },
        audioConfig: { audioEncoding: 'MP3' as const },
      };

      try {
        const [response] = await client.synthesizeSpeech(request);
        audioBuffers[globalIndex] = response.audioContent ? Buffer.from(response.audioContent) : Buffer.alloc(0);
      } catch (err) {
        console.error(`Error synthesizing chunk ${globalIndex}:`, err);
        throw err;
      }
    });

    await Promise.all(batchPromises);
    
    // Add a small delay between batches to respect characters-per-minute quotas
    if (i + CONCURRENCY_LIMIT < chunks.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return Buffer.concat(audioBuffers);
};
