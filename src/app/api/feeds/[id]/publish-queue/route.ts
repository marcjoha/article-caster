import { NextResponse } from 'next/server';
import { getFeedById, publishAllQueuedItems } from '@/lib/firestore';
import { logActivity } from '@/lib/logger';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const feed = await getFeedById(id);
    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    const publishedCount = await publishAllQueuedItems(id);

    if (publishedCount > 0) {
      logActivity({
        feedId: id,
        level: 'info',
        category: 'episode',
        message: `Manual batch release: published ${publishedCount} queued episode${publishedCount > 1 ? 's' : ''}`,
        details: feed.cover_image_url || `https://article-caster/feed/${feed.unguessable_slug}`,
      });
    }

    return NextResponse.json({ success: true, publishedCount });
  } catch (error: unknown) {
    console.error('Publish all queued items error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
