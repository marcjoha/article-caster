import { NextResponse } from 'next/server';
import { updateFeed, deleteFeed, db } from '@/lib/firestore';
import { uploadFile, deleteFile } from '@/lib/storage';
import { logActivity } from '@/lib/logger';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const feedDoc = await db.collection('feeds').doc(id).get();
    if (!feedDoc.exists) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }
    const feedData = feedDoc.data();
    const slug = feedData?.unguessable_slug || '';
    
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string | undefined;
    const author = formData.get('author') as string | undefined;
    const tts_voice = formData.get('tts_voice') as string | undefined;
    const audio_prefix_message = formData.get('audio_prefix_message') as string | undefined;
    const chat_webhook_url = formData.get('chat_webhook_url') as string | undefined;
    const coverImageFile = formData.get('cover_image') as File | null;
    
    const hasRateLimitField = formData.has('rate_limit_enabled');
    const rate_limit_enabled = formData.get('rate_limit_enabled') === 'true';
    const rate_limit_schedule = formData.get('rate_limit_schedule') as 'weekdays' | 'daily' | 'custom' | null;
    const rawRateLimitDays = formData.get('rate_limit_days') as string | null;
    const rawHour = formData.get('rate_limit_hour_utc') as string | null;
    const rawEpisodes = formData.get('rate_limit_episodes_per_window') as string | null;

    let cover_image_url = formData.get('cover_image_url') as string | undefined;
    
    if (coverImageFile) {
      // Delete the old cover image if it exists
      if (feedData && feedData.cover_image_url) {
        await deleteFile(feedData.cover_image_url);
      }

      const buffer = Buffer.from(await coverImageFile.arrayBuffer());
      const safeName = coverImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      cover_image_url = await uploadFile(`covers/${Date.now()}-${safeName}`, buffer, coverImageFile.type);
    }
    
    const updates: Record<string, unknown> = {
      title,
      description,
      category,
    };
    
    if (author !== null) updates.author = author;
    if (cover_image_url !== undefined && cover_image_url !== null) updates.cover_image_url = cover_image_url;
    if (tts_voice !== null) updates.tts_voice = tts_voice;
    if (audio_prefix_message !== null) updates.audio_prefix_message = audio_prefix_message;
    if (chat_webhook_url !== null) updates.chat_webhook_url = chat_webhook_url;

    if (hasRateLimitField) {
      updates.rate_limit_enabled = rate_limit_enabled;
      if (rate_limit_schedule) updates.rate_limit_schedule = rate_limit_schedule;
      if (rawRateLimitDays) {
        try {
          updates.rate_limit_days = JSON.parse(rawRateLimitDays);
        } catch {}
      }
      if (rawHour !== null) updates.rate_limit_hour_utc = parseInt(rawHour, 10);
      if (rawEpisodes !== null) updates.rate_limit_episodes_per_window = parseInt(rawEpisodes, 10);
    }

    await updateFeed(id, updates);

    // If rate limiting was turned OFF, immediately release all remaining queued items
    if (feedData?.rate_limit_enabled && !rate_limit_enabled) {
      const { publishAllQueuedItems } = await import('@/lib/firestore');
      await publishAllQueuedItems(id);
    }
    
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const hostUrl = `${protocol}://${host}`;
    const feedUrl = `${hostUrl}/feed/${slug}`;

    logActivity({ feedId: id, level: 'info', category: 'feed', message: 'Feed settings updated', details: feedUrl });
    
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Update feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const feedDoc = await db.collection('feeds').doc(id).get();
    const feedData = feedDoc.exists ? feedDoc.data() : null;
    const slug = feedData?.unguessable_slug || '';

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const hostUrl = `${protocol}://${host}`;
    const feedUrl = `${hostUrl}/feed/${slug}`;

    logActivity({ feedId: id, level: 'warn', category: 'feed', message: 'Feed deleted', details: feedUrl });
    await deleteFeed(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
