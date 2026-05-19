import { NextResponse } from 'next/server';
import { deleteFeedItem, getFeedItemById } from '@/lib/firestore';
import { logActivity } from '@/lib/logger';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Fetch item metadata before deletion for the activity log
    const item = await getFeedItemById(id);

    await deleteFeedItem(id);

    if (item) {
      logActivity({ feedId: item.feed_id, level: 'warn', category: 'episode', message: 'Episode deleted', details: item.source_url });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete item error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
