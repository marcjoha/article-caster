import { NextResponse } from 'next/server';
import { extractArticleContent } from '@/lib/ingestion/article';
import { synthesizeSpeech } from '@/lib/ingestion/tts';
import { extractYoutubeAudio } from '@/lib/ingestion/youtube';
import { summarizeContent } from '@/lib/ingestion/summarize';
import { applyLoudnessNormalization } from '@/lib/audio';
import { streamUpload, getFileMetadata, deleteFile } from '@/lib/storage';
import { createFeedItem, updateFeedItem, getFeedItems, updateIngestion, addProcessedUrl, deleteIngestion, db, Feed } from '@/lib/firestore';
import { notifyNewEpisode } from '@/lib/chat';
import { logActivity } from '@/lib/logger';
import fs from 'fs';
import { getProductionUrl } from '@/lib/gcloud';
import crypto from 'crypto';

export async function POST(request: Request) {
  const { ingestionId, feedId, url, origin, published_at, syndication_title } = await request.json();

  if (!ingestionId || !feedId || !url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Guard: verify ingestion still exists before doing expensive work.
  // If it was deleted (e.g. by "Clear failed"), skip silently and return 200
  // so Cloud Tasks stops retrying.
  const ingestionDoc = await db.collection('ingestions').doc(ingestionId).get();
  if (!ingestionDoc.exists) {
    console.warn(`Ingestion ${ingestionId} no longer exists (likely cleared). Skipping.`);
    logActivity({ feedId, level: 'warn', category: 'ingestion', message: 'Ingestion skipped — record was cleared', details: url });
    return NextResponse.json({ skipped: true });
  }

  let downloadedFilePath: string | null = null;

  try {
    const feedSnapshot = await db.collection('feeds').doc(feedId).get();
    const feed = feedSnapshot.data() as Feed | undefined;

    const contentType_ = origin === 'youtube' ? 'YouTube video' : origin === 'rss' ? 'Blog post' : 'Article';
    logActivity({ feedId, level: 'info', category: 'ingestion', message: `${contentType_} ingestion started`, details: url });

    let title = '';
    let description = '';
    let rawAudioInput: Buffer | string | (Buffer | string)[] | null = null;
    let durationSeconds = 0;
    
    const isVideo = origin === 'youtube';
    const fileId = crypto.createHash('sha256').update(`${feedId}-${url}`).digest('hex');
    const fileExtension = isVideo ? 'mp4' : 'mp3';
    const contentType = isVideo ? 'video/mp4' : 'audio/mpeg';

    if (origin === 'youtube') {
      await updateIngestion(ingestionId, { status: '1/4: Downloading YouTube video...' });
      const result = await extractYoutubeAudio(url);
      title = result.title;
      durationSeconds = result.durationSeconds;
      downloadedFilePath = result.filePath;
      
      await updateIngestion(ingestionId, { status: '2/4: Generating summary...' });
      description = await summarizeContent(title, result.description);
    } else {
      await updateIngestion(ingestionId, { status: '1/4: Extracting article...' });
      const voicePreference = feed?.tts_voice;

      const extracted = await extractArticleContent(url);
      title = extracted.title;
      
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const originLabel = origin === 'rss' ? 'blog post' : 'article';
      extracted.textBlocks.unshift(`This is a ${originLabel} titled ${title} from ${domain}.\n\n`);

      if (feed?.audio_prefix_message) {
        extracted.textBlocks.unshift(`${feed.audio_prefix_message}\n\n`);
      }

      await updateIngestion(ingestionId, { status: '2/4: Generating audio...' });

      // Run summarization concurrently with TTS generation
      const [ttsResult, summary] = await Promise.all([
        synthesizeSpeech({ textBlocks: extracted.textBlocks, language: extracted.language, voicePreference }),
        summarizeContent(title, extracted.textContent),
      ]);
      description = summary;
      rawAudioInput = ttsResult.audioBuffer;
      durationSeconds = ttsResult.durationSeconds;
    }
    
    await updateIngestion(ingestionId, { status: isVideo ? `3/4: Streaming ${fileExtension.toUpperCase()}...` : `3/4: Mastering & Streaming ${fileExtension.toUpperCase()}...` });
    
    const { writeStream, uploadPromise } = streamUpload(`content/${fileId}.${fileExtension}`, contentType);
    
    if (isVideo) {
      if (!downloadedFilePath) {
        throw new Error('Downloaded video file path is missing');
      }
      const readStream = fs.createReadStream(downloadedFilePath);
      readStream.pipe(writeStream);
    } else {
      // Process audio and pipe to write stream
      await applyLoudnessNormalization(rawAudioInput!, fileExtension as 'wav' | 'mp3', writeStream);
    }
    
    // Wait for the upload to complete
    const mediaUrl = await uploadPromise;
    
    // Get final size from GCS
    const { size: sizeBytes } = await getFileMetadata(mediaUrl);

    // Availability gate: verify the audio file is publicly accessible before
    // committing it to the podcast feed or notifying subscribers.
    // This prevents broken episodes from reaching listeners.
    const headResponse = await fetch(mediaUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      // Upload appeared to succeed but file is not publicly reachable — clean up
      // the orphaned GCS object and fail the ingestion so it can be retried.
      deleteFile(mediaUrl).catch(e => console.error('Cleanup of unreachable media failed:', e));
      throw new Error(`Media file uploaded but not publicly accessible (HTTP ${headResponse.status}). Cleaned up orphan and failing ingestion for retry.`);
    }

    await updateIngestion(ingestionId, { status: '4/4: Saving episode...' });

    // Final dedup guard: check if another worker already created this item
    // while we were processing. This prevents duplicates from concurrent ingestions.
    const existingItems = await getFeedItems(feedId);
    const existingItem = existingItems.find(item => item.source_url === url);

    if (existingItem) {
      // Another worker already created this item — update it silently instead
      console.warn(`Item for ${url} already exists (${existingItem.id}). Updating in-place instead of creating duplicate.`);
      logActivity({ feedId, level: 'warn', category: 'ingestion', message: 'Episode updated in-place (dedup)', details: url });
      const oldMediaUrl = existingItem.media_url;
      await updateFeedItem(existingItem.id!, {
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
        type: isVideo ? 'video' : 'audio',
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds,
        origin: origin || 'article',
        created_at: published_at ? new Date(published_at) : new Date(),
      });

      const contentType = origin === 'youtube' ? 'YouTube video' : origin === 'rss' ? 'Blog post' : 'Article';
      logActivity({ feedId, level: 'info', category: 'ingestion', message: `${contentType} ingested and podcast episode created`, details: url });

      const publicUrl = getProductionUrl();
      notifyNewEpisode({
        title,
        description,
        sourceUrl: url,
        durationSeconds,
        origin: origin || 'article',
        coverImageUrl: feed?.cover_image_url,
        webhookUrl: feed?.chat_webhook_url,
        mediaUrl,
        feedUrl: publicUrl ? `${publicUrl}/feed/${feed?.unguessable_slug}.xml` : '',
        feedTitle: feed?.title || '',
        feedId,
        syndicationTitle: syndication_title,
      }).catch(() => {}); // errors already logged inside notifyNewEpisode
    }

    // Ingestion succeeded: record the URL as processed (permanent, survives item deletion)
    // and delete the ephemeral ingestion record to keep the collection clean.
    await addProcessedUrl(feedId, url);
    await deleteIngestion(ingestionId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(`Worker error for ingestion ${ingestionId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logActivity({ feedId, level: 'error', category: 'ingestion', message: `Ingestion failed: ${message}`, details: url });
    
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
