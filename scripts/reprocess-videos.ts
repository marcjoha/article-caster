import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Load .env first to ensure environment variables are present before any local library imports
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    });
    console.log('Loaded environment from .env');
  }
} catch (e) {
  console.warn('Could not read .env file:', e);
}

// Hardcoded target video IDs from the database
const DEFAULT_VIDEO_IDS = [
  'qojJ48XDD0TUc1pKjNs7', // How to Become a Builder PM (n8n, Claude Code, OpenClaw)
  'wRGkTcpyHi8wPKGJBBoi'  // Software engineering at the tipping point
];

async function main() {
  console.log('==================================================');
  console.log('    ONE-OFF VIDEO REPROCESSING JOB (CACHE BUST)  ');
  console.log('==================================================');

  // Parse command line arguments or fall back to default video IDs
  const args = process.argv.slice(2);
  const targetIds = args.length > 0 ? args : DEFAULT_VIDEO_IDS;

  console.log(`Targeting Item IDs: ${targetIds.join(', ')}\n`);

  // Dynamically import library files after env config is loaded
  const { getFeedItemById, updateFeedItem, db } = await import('@/lib/firestore');
  const { extractYoutubeAudio } = await import('@/lib/ingestion/youtube');
  const { injectVideoIntro } = await import('@/lib/ingestion/videoIntro');
  const { streamUpload, getFileMetadata, deleteFile } = await import('@/lib/storage');
  const { logActivity } = await import('@/lib/logger');

  for (const itemId of targetIds) {
    console.log(`\n>>> Processing Item ID: ${itemId}`);
    
    // 1. Fetch item from database
    const item = await getFeedItemById(itemId);
    if (!item) {
      console.error(`[-] Error: Item with ID ${itemId} not found in database.`);
      continue;
    }

    if (item.type !== 'video' || item.origin !== 'youtube') {
      console.warn(`[-] Warning: Item "${item.title}" is not a YouTube video episode. Skipping.`);
      continue;
    }

    console.log(`[+] Found video episode: "${item.title}"`);
    console.log(`    Source URL: ${item.source_url}`);
    console.log(`    Original Duration: ${item.duration_seconds}s`);
    console.log(`    Original Size: ${item.size_bytes} bytes`);
    console.log(`    Current Media URL: ${item.media_url}`);

    // 2. Fetch feed details
    const feedSnapshot = await db.collection('feeds').doc(item.feed_id).get();
    if (!feedSnapshot.exists) {
      console.error(`[-] Error: Associated feed ${item.feed_id} not found. Skipping.`);
      continue;
    }
    const feed = feedSnapshot.data();
    console.log(`[+] Associated Feed: "${feed?.title}"`);

    await logActivity({
      feedId: item.feed_id,
      level: 'info',
      category: 'ingestion',
      message: `One-off cache-busting reprocessing started for video: ${item.title}`,
      details: item.source_url
    });

    let downloadedFilePath: string | null = null;
    let finalProcessedPath: string | null = null;

    try {
      // 3. Download the video from YouTube using yt-dlp (will be H.264 due to our youtube.ts patch)
      console.log(`[+] Downloading video via yt-dlp...`);
      const extractResult = await extractYoutubeAudio(item.source_url);
      downloadedFilePath = extractResult.filePath;
      let durationSeconds = extractResult.durationSeconds;
      
      console.log(`[+] Download completed. Temporary file: ${downloadedFilePath}`);

      // 4. Generate video intro card and concatenate
      console.log(`[+] Injecting video intro prefix...`);
      const domain = new URL(item.source_url).hostname.replace(/^www\./, '');
      const videoIntroMessage = feed?.audio_prefix_message
        ? `${feed.audio_prefix_message}\n\nThis is a video titled ${item.title} from ${domain}.`
        : `This is a video titled ${item.title} from ${domain}.`;

      const introResult = await injectVideoIntro(
        downloadedFilePath,
        durationSeconds,
        item.title, // Use original title to prevent any changes
        videoIntroMessage,
        feed?.tts_voice,
        feed?.cover_image_url || undefined
      );

      finalProcessedPath = introResult.filePath;
      durationSeconds = introResult.durationSeconds;
      console.log(`[+] Intro injection complete. Final duration: ${durationSeconds}s`);

      // 5. Upload new MP4 to GCS with a cache-busting suffix "_v5" to force clients to download the fresh stream
      const fileId = crypto.createHash('sha256').update(`${item.feed_id}-${item.source_url}`).digest('hex');
      const destinationPath = `content/${fileId}_v5.mp4`;
      console.log(`[+] Uploading reprocessed video with cache-buster to GCS: ${destinationPath}`);
      
      const { writeStream, uploadPromise } = streamUpload(destinationPath, 'video/mp4');
      const readStream = fs.createReadStream(finalProcessedPath);
      
      readStream.on('error', (err) => {
        console.error(`[-] Read stream error for ${finalProcessedPath}:`, err);
        writeStream.destroy(err);
      });
      
      readStream.pipe(writeStream);
      const mediaUrl = await uploadPromise;
      console.log(`[+] Upload complete. New Media URL: ${mediaUrl}`);

      // 6. Verify public accessibility
      console.log(`[+] Verifying public accessibility of new media URL...`);
      const headResponse = await fetch(mediaUrl, { method: 'HEAD' });
      if (!headResponse.ok) {
        throw new Error(`Media file uploaded but HEAD request returned HTTP ${headResponse.status}`);
      }
      console.log(`[+] Public accessibility verified!`);

      // 7. Get final file size from GCS metadata
      const { size: sizeBytes } = await getFileMetadata(mediaUrl);
      console.log(`[+] New file size: ${sizeBytes} bytes`);

      // 8. Delete the old cached GCS file to keep Cloud Storage clean
      const oldMediaUrl = item.media_url;
      if (oldMediaUrl && oldMediaUrl !== mediaUrl) {
        console.log(`[+] Deleting old cached GCS file: ${oldMediaUrl}`);
        await deleteFile(oldMediaUrl).catch(err => {
          console.error(`[-] Failed to delete old GCS file:`, err);
        });
      }

      // 9. Update Firestore record
      console.log(`[+] Updating Firestore item database entry...`);
      await updateFeedItem(itemId, {
        size_bytes: sizeBytes,
        duration_seconds: durationSeconds,
        media_url: mediaUrl, // Fresh URL with _v5 suffix
      });

      // 10. Log success to Feed Activity Log
      await logActivity({
        feedId: item.feed_id,
        level: 'info',
        category: 'ingestion',
        message: `One-off video reprocessing cache-busted successfully: ${item.title}`,
        details: `New URL: ${mediaUrl}, Duration: ${durationSeconds}s`
      });

      console.log(`[+] SUCCESS: Item "${item.title}" reprocessed and cache-busted successfully!`);
    } catch (error) {
      console.error(`[-] Error reprocessing item "${item.title}":`, error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await logActivity({
        feedId: item.feed_id,
        level: 'error',
        category: 'ingestion',
        message: `One-off cache-busting video reprocessing failed: ${message}`,
        details: item.source_url
      });
    } finally {
      // Clean up temporary local files
      if (downloadedFilePath && fs.existsSync(downloadedFilePath)) {
        try {
          fs.unlinkSync(downloadedFilePath);
          console.log(`[+] Cleaned up temporary download file: ${downloadedFilePath}`);
        } catch (e) {
          console.error(`[-] Failed to clean up temporary download file: ${downloadedFilePath}`, e);
        }
      }
      if (finalProcessedPath && finalProcessedPath !== downloadedFilePath && fs.existsSync(finalProcessedPath)) {
        try {
          fs.unlinkSync(finalProcessedPath);
          console.log(`[+] Cleaned up final processed intro file: ${finalProcessedPath}`);
        } catch (e) {
          console.error(`[-] Failed to clean up final processed intro file: ${finalProcessedPath}`, e);
        }
      }
    }
  }

  console.log('\n==================================================');
  console.log('              REPROCESSING JOB DONE               ');
  console.log('==================================================');
}

main().catch(console.error);
