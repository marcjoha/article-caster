import { NextResponse } from 'next/server';
import { getFeedItemById, createIngestion } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const item = await getFeedItemById(id);

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (!item.source_url) {
      return NextResponse.json({ error: 'Item has no source_url to reprocess' }, { status: 400 });
    }

    // Create pending ingestion record linked to this item
    const ingestion = await createIngestion({
      feed_id: item.feed_id,
      url: item.source_url,
      origin: item.origin || 'article',
      item_id: item.id,
    });

    await enqueueIngestion({
      ingestionId: ingestion.id!,
      feedId: item.feed_id,
      url: item.source_url,
      origin: item.origin || 'article',
      itemId: item.id,
    });

    return NextResponse.json({ success: true, ingestionId: ingestion.id });
  } catch (error: unknown) {
    console.error('Reprocess error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

