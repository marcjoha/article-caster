import { NextResponse } from 'next/server';
import { extractArticleContent, parseHtmlToTextBlocks } from '@/lib/ingestion/article';
import { extractPdfContent } from '@/lib/ingestion/pdf';
import { synthesizeSpeech } from '@/lib/ingestion/tts';
import { extractYoutubeAudio } from '@/lib/ingestion/youtube';
import { injectVideoIntro } from '@/lib/ingestion/videoIntro';
import { summarizeContent } from '@/lib/ingestion/summarize';
import { applyLoudnessNormalization } from '@/lib/audio';
import { streamUpload, getFileMetadata, deleteFile, uploadFile } from '@/lib/storage';
import { createFeedItem, updateFeedItem, updateIngestion, addProcessedUrl, deleteIngestion, db, Feed } from '@/lib/firestore';
import { notifyNewEpisode } from '@/lib/chat';
import { logActivity } from '@/lib/logger';
import fs from 'fs';
import { getProductionUrl } from '@/lib/gcloud';
import crypto from 'crypto';
import { Writable } from 'stream';
// JSDOM import removed as parsing is refactored into shared parseHtmlToTextBlocks helper

export async function POST(request: Request) {
  const { ingestionId, feedId, url, origin, published_at, syndication_title, title: providedTitle } = await request.json();

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
  const ingestionData = ingestionDoc.data();

  let finalUrl = url;
  let finalOrigin = origin || 'article';
  let downloadedFilePath: string | null = null;
  let activeWriteStream: Writable | null = null;

  try {
    const feedSnapshot = await db.collection('feeds').doc(feedId).get();
    const feed = feedSnapshot.data() as Feed | undefined;

    // Stage 0: Auto-detect PDF URLs in standard article ingestion
    if (finalOrigin === 'article') {
      const isPdfUrl = finalUrl.toLowerCase().split('?')[0].endsWith('.pdf');
      let isPdfMime = false;

      try {
        const headRes = await fetch(finalUrl, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        const contentType = headRes.headers.get('content-type') || '';
        if (contentType.toLowerCase().includes('application/pdf')) {
          isPdfMime = true;
        }
      } catch (e) {
        console.warn('HEAD request failed for auto-pdf check, falling back to GET or extension check:', e);
      }

      if (isPdfUrl || isPdfMime) {
        logActivity({
          feedId,
          level: 'info',
          category: 'ingestion',
          message: 'Standard URL identified as PDF, downloading and auto-routing to PDF pipeline',
          details: finalUrl
        });

        // Download the PDF file
        const getRes = await fetch(finalUrl, { signal: AbortSignal.timeout(30000) });
        if (!getRes.ok) {
          throw new Error(`Failed to download PDF from URL (HTTP ${getRes.status})`);
        }
        const pdfArrayBuffer = await getRes.arrayBuffer();
        const pdfBuffer = Buffer.from(pdfArrayBuffer);

        // Generate SHA-256 content-based name
        const contentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
        const destinationPath = `content/pdf/${contentHash}.pdf`;

        // Save PDF to GCS indefinitely with inline disposition
        const gcsPublicUrl = await uploadFile(destinationPath, pdfBuffer, 'application/pdf', 'inline');

        // Update pending ingestion record in Firestore
        await updateIngestion(ingestionId, { url: gcsPublicUrl, origin: 'pdf' });

        finalOrigin = 'pdf';
        finalUrl = gcsPublicUrl;
      }
    }

    const contentType_ = finalOrigin === 'youtube' ? 'YouTube video' : finalOrigin === 'rss' ? 'Blog post' : finalOrigin === 'pdf' ? 'PDF document' : 'Article';
    logActivity({ feedId, level: 'info', category: 'ingestion', message: `${contentType_} ingestion started`, details: finalUrl });

    let title = '';
    let description = '';
    let rawAudioInput: Buffer | string | (Buffer | string)[] | null = null;
    let durationSeconds = 0;
    
    const isVideo = finalOrigin === 'youtube';
    const fileId = crypto.createHash('sha256').update(`${feedId}-${finalUrl}`).digest('hex');
    const fileExtension = isVideo ? 'mp4' : 'mp3';
    const contentType = isVideo ? 'video/mp4' : 'audio/mpeg';

    if (finalOrigin === 'youtube') {
      await updateIngestion(ingestionId, { status: '1/4: Downloading YouTube video...' });
      const result = await extractYoutubeAudio(finalUrl);
      title = result.title;
      durationSeconds = result.durationSeconds;
      downloadedFilePath = result.filePath;
      
      await updateIngestion(ingestionId, { status: '2/4: Generating summary...' });
      description = await summarizeContent(title, result.description);

      await updateIngestion(ingestionId, { status: '2.5/4: Injecting video intro prefix...' });
      const originalPath = downloadedFilePath;
      const domain = new URL(finalUrl).hostname.replace(/^www\./, '');
      const videoIntroMessage = feed?.audio_prefix_message
        ? `${feed.audio_prefix_message}\n\nThis is a video titled ${title} from ${domain}.`
        : `This is a video titled ${title} from ${domain}.`;

      const introResult = await injectVideoIntro(
        downloadedFilePath,
        durationSeconds,
        title,
        videoIntroMessage,
        feed?.tts_voice,
        feed?.cover_image_url || undefined
      );
      downloadedFilePath = introResult.filePath;
      durationSeconds = introResult.durationSeconds;

      // Clean up original downloaded YouTube file if a concatenated one was created
      if (downloadedFilePath !== originalPath) {
        try {
          if (fs.existsSync(originalPath)) {
            fs.unlinkSync(originalPath);
          }
        } catch (e) {
          console.error('Failed to clean up original downloaded YouTube video:', e);
        }
      }
    } else if (finalOrigin === 'pdf') {
      await updateIngestion(ingestionId, { status: '1/4: Parsing PDF with Gemini...' });

      // Download the PDF from finalUrl (which is a GCS URL)
      const res = await fetch(finalUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        throw new Error(`Failed to fetch PDF for parsing (HTTP ${res.status})`);
      }
      const arrayBuffer = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuffer);

      // Parse with Gemini
      const { title: pdfTitle, htmlContent } = await extractPdfContent(pdfBuffer);
      title = pdfTitle;

      const domain = new URL(finalUrl).hostname.replace(/^www\./, '');
      const voicePreference = feed?.tts_voice;

      // Extract blocks using the shared parseHtmlToTextBlocks helper
      const { textBlocks, textContent: cleanedContent } = parseHtmlToTextBlocks(htmlContent);

      // Add speech prefix message
      textBlocks.unshift(`This is a PDF document titled ${title} from ${domain}.\n\n`);
      if (feed?.audio_prefix_message) {
        textBlocks.unshift(`${feed.audio_prefix_message}\n\n`);
      }

      await updateIngestion(ingestionId, { status: '2/4: Generating audio...' });

      // Run summarization concurrently with TTS generation
      const [ttsResult, summary] = await Promise.all([
        synthesizeSpeech({ textBlocks, language: 'en-US', voicePreference }),
        summarizeContent(title, cleanedContent),
      ]);
      description = summary;
      rawAudioInput = ttsResult.audioBuffer;
      durationSeconds = ttsResult.durationSeconds;

    } else {
      await updateIngestion(ingestionId, { status: '1/4: Extracting article...' });
      const voicePreference = feed?.tts_voice;

      const extracted = await extractArticleContent(finalUrl);
      title = (providedTitle && providedTitle.trim()) || (ingestionData?.title && String(ingestionData.title).trim()) || extracted.title;
      
      const domain = new URL(finalUrl).hostname.replace(/^www\./, '');
      const originLabel = finalOrigin === 'rss' ? 'blog post' : 'article';
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
    activeWriteStream = writeStream;
    
    if (isVideo) {
      if (!downloadedFilePath) {
        throw new Error('Downloaded video file path is missing');
      }
      if (!fs.existsSync(downloadedFilePath)) {
        throw new Error(`Downloaded video file not found on disk at: ${downloadedFilePath}`);
      }
      const readStream = fs.createReadStream(downloadedFilePath);
      readStream.on('error', (err) => {
        console.error(`Read stream error for ${downloadedFilePath}:`, err);
        writeStream.destroy(err);
      });
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
    const headResponse = await fetch(mediaUrl, { method: 'HEAD' });
    if (!headResponse.ok) {
      deleteFile(mediaUrl).catch(e => console.error('Cleanup of unreachable media failed:', e));
      throw new Error(`Media file uploaded but not publicly accessible (HTTP ${headResponse.status}). Cleaned up orphan and failing ingestion for retry.`);
    }

    await updateIngestion(ingestionId, { status: '4/4: Saving episode...' });

    const isRateLimited = !!feed?.rate_limit_enabled;

    // Final dedup guard: check if another worker already created this item (published or queued)
    const { getAllFeedItems } = await import('@/lib/firestore');
    const existingItems = await getAllFeedItems(feedId);
    const existingItem = existingItems.find(item => item.source_url === finalUrl);

    if (existingItem) {
      console.warn(`Item for ${finalUrl} already exists (${existingItem.id}). Updating in-place instead of creating duplicate.`);
      logActivity({ feedId, level: 'warn', category: 'ingestion', message: 'Episode updated in-place (dedup)', details: finalUrl });
      const oldMediaUrl = existingItem.media_url;
      await updateFeedItem(existingItem.id!, {
        title,
        description,
        media_url: mediaUrl,
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds,
        ...(syndication_title ? { syndication_title } : {}),
      });
      if (oldMediaUrl && oldMediaUrl !== mediaUrl) {
        deleteFile(oldMediaUrl).catch(e => console.error("Failed to delete old media file:", e));
      }
    } else {
      const now = new Date();
      if (isRateLimited) {
        await createFeedItem({
          feed_id: feedId,
          title,
          description,
          source_url: finalUrl,
          media_url: mediaUrl,
          type: isVideo ? 'video' : 'audio',
          size_bytes: sizeBytes,
          duration_seconds: durationSeconds,
          origin: finalOrigin || 'article',
          status: 'queued',
          queued_at: now,
          created_at: published_at ? new Date(published_at) : now,
          ...(syndication_title ? { syndication_title } : {}),
        });

        logActivity({ feedId, level: 'info', category: 'ingestion', message: `${contentType_} ingested and added to publishing queue`, details: finalUrl });
      } else {
        await createFeedItem({
          feed_id: feedId,
          title,
          description,
          source_url: finalUrl,
          media_url: mediaUrl,
          type: isVideo ? 'video' : 'audio',
          size_bytes: sizeBytes,
          duration_seconds: durationSeconds,
          origin: finalOrigin || 'article',
          status: 'published',
          published_at: published_at ? new Date(published_at) : now,
          created_at: published_at ? new Date(published_at) : now,
          ...(syndication_title ? { syndication_title } : {}),
        });

        logActivity({ feedId, level: 'info', category: 'ingestion', message: `${contentType_} ingested and podcast episode created`, details: finalUrl });

        const publicUrl = getProductionUrl();
        notifyNewEpisode({
          title,
          description,
          sourceUrl: finalUrl,
          durationSeconds,
          origin: finalOrigin || 'article',
          coverImageUrl: feed?.cover_image_url,
          webhookUrl: feed?.chat_webhook_url,
          mediaUrl,
          feedUrl: publicUrl ? `${publicUrl}/feed/${feed?.unguessable_slug}.xml` : '',
          feedTitle: feed?.title || '',
          feedId,
          syndicationTitle: syndication_title,
        }).catch(() => {});
      }
    }

    // Ingestion succeeded: record URL as processed and clean up ingestion record
    await addProcessedUrl(feedId, finalUrl);
    await deleteIngestion(ingestionId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error(`Worker error for ingestion ${ingestionId}:`, error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    logActivity({ feedId, level: 'error', category: 'ingestion', message: `Ingestion failed: ${message}`, details: finalUrl });
    
    if (activeWriteStream && !activeWriteStream.destroyed) {
      try {
        activeWriteStream.destroy(error instanceof Error ? error : new Error(message));
      } catch (destroyError) {
        console.error('Failed to destroy activeWriteStream:', destroyError);
      }
    }
    
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
