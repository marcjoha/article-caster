import { NextResponse } from 'next/server';
import { createSyndication, deleteSyndication } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';

export async function POST(request: Request) {
  try {
    const { feedId, url, initialAction = 'recent' } = await request.json();
    
    if (!feedId || !url) {
      return NextResponse.json({ error: 'feedId and url are required' }, { status: 400 });
    }

    const syndication = await createSyndication({
      feed_id: feedId,
      url,
    });

    try {
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser();
      const feed = await parser.parseURL(url);
      
      if (feed.items && feed.items.length > 0 && initialAction !== 'future') {
        const { createIngestion } = await import('@/lib/firestore');

        const itemsToProcess = initialAction === 'all' ? feed.items : [feed.items[0]];

        for (const item of itemsToProcess) {
          const itemUrl = item.link;
          if (itemUrl) {
            const ingestion = await createIngestion({
              feed_id: feedId,
              url: itemUrl,
              origin: 'rss',
            });

            await enqueueIngestion({
              ingestionId: ingestion.id!,
              feedId,
              url: itemUrl,
              origin: 'rss',
            });
          }
        }
      }

      const { updateSyndication } = await import('@/lib/firestore');
      await updateSyndication(syndication.id!, {
        title: feed.title || syndication.title,
        last_checked_at: new Date(),
      });
    } catch (autoIngestError) {
      console.error('Failed to auto-ingest newest item from feed:', autoIngestError);
    }

    return NextResponse.json({ success: true, syndication });
  } catch (error: unknown) {
    console.error('Add RSS feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await deleteSyndication(id);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete RSS feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

