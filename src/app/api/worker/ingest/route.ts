import { NextResponse } from 'next/server';
import { extractArticleContent } from '@/lib/ingestion/article';
import { synthesizeSpeech } from '@/lib/ingestion/tts';
import { applyLoudnessNormalization } from '@/lib/audio';
import { uploadFile, deleteFile } from '@/lib/storage';
import { createFeedItem, updateFeedItem, getFeedItemById, updateIngestion, db, Feed } from '@/lib/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  const { ingestionId, feedId, url, origin, itemId } = await request.json();

  if (!ingestionId || !feedId || !url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Mark as processing
    await updateIngestion(ingestionId, { status: '1/4: Extracting article...' });

    // Fetch the Feed to get its tts_voice configuration
    const feedSnapshot = await db.collection('feeds').doc(feedId).get();
    const feed = feedSnapshot.data() as Feed | undefined;
    const voicePreference = feed?.tts_voice;

    const { title, textContent, language, textBlocks } = await extractArticleContent(url);
    
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const originLabel = origin === 'rss' ? 'blog post' : 'article';
    textBlocks.unshift(`This is a ${originLabel} titled ${title} from ${domain}.\n\n`);

    if (feed?.audio_prefix_message) {
      textBlocks.unshift(`${feed.audio_prefix_message}\n\n`);
    }

    await updateIngestion(ingestionId, { status: '2/4: Generating audio...' });

    const { audioBuffer: rawAudioBuffer, durationSeconds } = await synthesizeSpeech({ textBlocks, language, voicePreference });
    
    await updateIngestion(ingestionId, { status: '3/4: Mastering audio...' });
    const masteredAudioBuffer = await applyLoudnessNormalization(rawAudioBuffer);
    
    await updateIngestion(ingestionId, { status: '4/4: Saving episode...' });

    const fileId = uuidv4();
    const mediaUrl = await uploadFile(`article/${fileId}.wav`, masteredAudioBuffer, 'audio/wav');
    
    if (itemId) {
      const existingItem = await getFeedItemById(itemId);
      const oldMediaUrl = existingItem?.media_url;
      
      await updateFeedItem(itemId, {
        title,
        description: textContent.substring(0, 200) + '...',
        media_url: mediaUrl,
        size_bytes: masteredAudioBuffer.length,
        duration_seconds: durationSeconds,
      });

      if (oldMediaUrl && oldMediaUrl !== mediaUrl) {
        deleteFile(oldMediaUrl).catch(e => console.error("Failed to delete old media file:", e));
      }
    } else {
      await createFeedItem({
        feed_id: feedId,
        title,
        description: textContent.substring(0, 200) + '...',
        source_url: url,
        media_url: mediaUrl,
        type: 'audio',
        size_bytes: masteredAudioBuffer.length,
        duration_seconds: durationSeconds,
        origin: origin || 'article', // Default to article if missing
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
    
    // Return 200 so Cloud Tasks doesn't infinitely retry unless we want it to.
    // For now, returning 200 gracefully fails the task in our UI without spamming GCP.
    return NextResponse.json({ error: message }, { status: 200 });
  }
}
