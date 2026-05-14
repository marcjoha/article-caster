import { NextResponse } from 'next/server';
import { createIngestion, getFeedItems, getActiveIngestions } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';

export async function POST(request: Request) {
  try {
    const { feedId, url } = await request.json();
    
    // Deduplication check
    const existingItems = await getFeedItems(feedId);
    if (existingItems.some(item => item.source_url === url)) {
      return NextResponse.json({ error: 'This article already exists in your podcast feed.' }, { status: 400 });
    }

    const activeIngestions = await getActiveIngestions(feedId);
    if (activeIngestions.some(ing => ing.url === url && ing.status !== 'failed')) {
      return NextResponse.json({ error: 'This article is already currently processing.' }, { status: 400 });
    }
    
    // Create pending ingestion record
    const ingestion = await createIngestion({
      feed_id: feedId,
      url,
      origin: 'article',
    });

    await enqueueIngestion({
      ingestionId: ingestion.id!,
      feedId,
      url,
      origin: 'article',
    });

    return NextResponse.json({ success: true, ingestionId: ingestion.id });
  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

