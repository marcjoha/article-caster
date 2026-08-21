import { NextResponse } from 'next/server';
import { getFeedItemById, publishFeedItem } from '@/lib/firestore';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await getFeedItemById(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (item.status === 'published') {
      return NextResponse.json({ error: 'Item is already published' }, { status: 400 });
    }

    const updatedItem = await publishFeedItem(id, item.feed_id, { isManual: true });

    return NextResponse.json({ success: true, item: updatedItem });
  } catch (error: unknown) {
    console.error('Failed to publish item manually:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
