import { NextResponse } from 'next/server';
import { extractArticleContent } from '@/lib/ingestion/article';
import { synthesizeSpeech } from '@/lib/ingestion/tts';
import { uploadFile } from '@/lib/storage';
import { createFeedItem, updateIngestion } from '@/lib/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  const { ingestionId, feedId, url } = await request.json();

  if (!ingestionId || !feedId || !url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    // Mark as processing
    await updateIngestion(ingestionId, { status: 'processing' });

    const { title, textContent } = await extractArticleContent(url);
    const audioBuffer = await synthesizeSpeech(textContent);
    
    const fileId = uuidv4();
    const mediaUrl = await uploadFile(`article/${fileId}.mp3`, audioBuffer, 'audio/mpeg');
    
    await createFeedItem({
      feed_id: feedId,
      title,
      description: textContent.substring(0, 200) + '...',
      source_url: url,
      media_url: mediaUrl,
      type: 'audio',
      size_bytes: audioBuffer.length,
      duration_seconds: Math.round(audioBuffer.length / 32000), // rough estimate for MP3
    });

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
