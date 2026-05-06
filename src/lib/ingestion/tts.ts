import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

export interface SynthesizeOptions {
  textBlocks: string[];
  language: string;
  voicePreference?: string;
}

const resolveVoice = (language: string, voicePreference?: string) => {
  if (voicePreference && voicePreference !== 'auto') {
    return { languageCode: voicePreference.slice(0, 5), name: voicePreference };
  }

  // Auto-detect based on language
  const langUpper = language.toUpperCase();
  if (langUpper.startsWith('EN-GB') || langUpper.startsWith('EN-UK')) {
    return { languageCode: 'en-GB', name: 'en-GB-Studio-C' };
  } else if (langUpper.startsWith('ES')) {
    return { languageCode: 'es-ES', name: 'es-ES-Neural2-A' };
  } else if (langUpper.startsWith('FR')) {
    return { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' };
  } else if (langUpper.startsWith('DE')) {
    return { languageCode: 'de-DE', name: 'de-DE-Neural2-A' };
  } else if (langUpper.startsWith('SV')) {
    return { languageCode: 'sv-SE', name: 'sv-SE-Neural2-A' };
  }

  // Default fallback
  return { languageCode: 'en-US', name: 'en-US-Journey-F' };
};

export const synthesizeSpeech = async (options: SynthesizeOptions): Promise<Buffer> => {
  const voiceParams = resolveVoice(options.language, options.voicePreference);
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const block of options.textBlocks) {
    if (currentChunk.length + block.length > 4000) {
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
      
      const request = {
        input: { text: chunk },
        voice: voiceParams,
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
    
    if (i + CONCURRENCY_LIMIT < chunks.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return Buffer.concat(audioBuffers);
};
