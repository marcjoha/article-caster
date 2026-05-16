import { NextResponse } from 'next/server';
import { createIngestion, getFeedItems, getActiveIngestions } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';
import { looksLikeRssFeed } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { feedId, url } = body;
    let { origin = 'article' } = body;
    
    if (url && (url.includes('youtube.com') || url.includes('youtu.be'))) {
      origin = 'youtube';
    }

    // Reject RSS feed URLs — these should go through the RSS Feeds tab
    if (origin !== 'rss' && looksLikeRssFeed(url)) {
      return NextResponse.json({ error: 'This URL looks like an RSS feed. Use the RSS Feeds tab to subscribe to feeds instead.' }, { status: 400 });
    }

    // Restrict YouTube ingestion to local development
    if (origin === 'youtube' && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'YouTube ingestion is restricted to local development environments only due to datacenter IP blocking.' }, { status: 403 });
    }

    // Deduplication check
    const existingItems = await getFeedItems(feedId);
    if (existingItems.some(item => item.source_url === url)) {
      return NextResponse.json({ error: 'This item already exists in your podcast feed.' }, { status: 400 });
    }

    const activeIngestions = await getActiveIngestions(feedId);
    if (activeIngestions.some(ing => ing.url === url && ing.status !== 'failed')) {
      return NextResponse.json({ error: 'This item is already currently processing.' }, { status: 400 });
    }
    
    // Create pending ingestion record
    const ingestion = await createIngestion({
      feed_id: feedId,
      url,
      origin: origin,
    });

    await enqueueIngestion({
      ingestionId: ingestion.id!,
      feedId,
      url,
      origin: origin,
    });

    return NextResponse.json({ success: true, ingestionId: ingestion.id });
  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

