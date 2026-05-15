import { NextResponse } from 'next/server';
import { extractArticleContent } from '@/lib/ingestion/article';
import { synthesizeSpeech } from '@/lib/ingestion/tts';
import { extractYoutubeAudio } from '@/lib/ingestion/youtube';
import { applyLoudnessNormalization } from '@/lib/audio';
import { streamUpload, getFileMetadata, deleteFile } from '@/lib/storage';
import { createFeedItem, updateFeedItem, getFeedItemById, updateIngestion, db, Feed } from '@/lib/firestore';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

export async function POST(request: Request) {
  const { ingestionId, feedId, url, origin, itemId, published_at } = await request.json();

  if (!ingestionId || !feedId || !url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let downloadedFilePath: string | null = null;

  try {
    const feedSnapshot = await db.collection('feeds').doc(feedId).get();
    const feed = feedSnapshot.data() as Feed | undefined;

    let title = '';
    let description = '';
    let rawAudioInput: Buffer | string | (Buffer | string)[];
    let durationSeconds = 0;
    
    const fileId = uuidv4();
    let fileExtension = 'wav';
    let contentType = 'audio/wav';

    if (origin === 'youtube') {
      await updateIngestion(ingestionId, { status: '1/4: Downloading YouTube audio...' });
      const result = await extractYoutubeAudio(url);
      title = result.title;
      description = result.description.substring(0, 200) + '...';
      durationSeconds = result.durationSeconds;
      downloadedFilePath = result.filePath;
      
      const inputs: (Buffer | string)[] = [];
      const voicePreference = feed?.tts_voice;

      const domain = new URL(url).hostname.replace(/^www\./, '');
      let prefixText = `This is a YouTube video titled ${title} from ${domain}.\n\n`;
      if (feed?.audio_prefix_message) {
        prefixText = `${feed.audio_prefix_message}\n\n` + prefixText;
      }

      await updateIngestion(ingestionId, { status: '2/4: Generating prefix audio...' });
      const prefixTts = await synthesizeSpeech({ 
        textBlocks: [prefixText], 
        language: 'en', 
        voicePreference 
      });
      inputs.push(prefixTts.audioBuffer);
      durationSeconds += prefixTts.durationSeconds;
      
      inputs.push(result.filePath);
      rawAudioInput = inputs.length === 1 ? inputs[0] : inputs;
      
      fileExtension = 'mp3';
      contentType = 'audio/mpeg';
    } else {
      await updateIngestion(ingestionId, { status: '1/4: Extracting article...' });
      const voicePreference = feed?.tts_voice;

      const extracted = await extractArticleContent(url);
      title = extracted.title;
      description = extracted.textContent.substring(0, 200) + '...';
      
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const originLabel = origin === 'rss' ? 'blog post' : 'article';
      extracted.textBlocks.unshift(`This is a ${originLabel} titled ${title} from ${domain}.\n\n`);

      if (feed?.audio_prefix_message) {
        extracted.textBlocks.unshift(`${feed.audio_prefix_message}\n\n`);
      }

      await updateIngestion(ingestionId, { status: '2/4: Generating audio...' });

      const ttsResult = await synthesizeSpeech({ textBlocks: extracted.textBlocks, language: extracted.language, voicePreference });
      rawAudioInput = ttsResult.audioBuffer;
      durationSeconds = ttsResult.durationSeconds;
    }
    
    await updateIngestion(ingestionId, { status: `3/4: Mastering & Streaming ${fileExtension.toUpperCase()}...` });
    
    const { writeStream, uploadPromise } = streamUpload(`article/${fileId}.${fileExtension}`, contentType);
    
    // Process audio and pipe to write stream
    await applyLoudnessNormalization(rawAudioInput, fileExtension as 'wav' | 'mp3', writeStream);
    
    // Wait for the upload to complete
    const mediaUrl = await uploadPromise;
    
    await updateIngestion(ingestionId, { status: '4/4: Saving episode...' });

    // Get final size from GCS
    const { size: sizeBytes } = await getFileMetadata(mediaUrl);
    
    if (itemId) {
      const existingItem = await getFeedItemById(itemId);
      const oldMediaUrl = existingItem?.media_url;
      
      await updateFeedItem(itemId, {
        title,
        description,
        media_url: mediaUrl,
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds,
      });

      if (oldMediaUrl && oldMediaUrl !== mediaUrl) {
        deleteFile(oldMediaUrl).catch(e => console.error("Failed to delete old media file:", e));
      }
    } else {
      await createFeedItem({
        feed_id: feedId,
        title,
        description,
        source_url: url,
        media_url: mediaUrl,
        type: 'audio',
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds,
        origin: origin || 'article', // Default to article if missing
        created_at: published_at ? new Date(published_at) : new Date(),
      });
    }

    // Mark as completed
    await updateIngestion(ingestionId, { status: 'completed' });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(`Worker error for ingestion ${ingestionId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Mark as failed
    await updateIngestion(ingestionId, { status: 'failed', error: message });
    
    return NextResponse.json({ error: message }, { status: 200 });
  } finally {
    if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
      try {
        fs.unlinkSync(downloadedFilePath);
      } catch (e) {
        console.error("Failed to clean up temporary file:", downloadedFilePath, e);
      }
    }
  }
}
