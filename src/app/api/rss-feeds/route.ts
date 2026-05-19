import { NextResponse } from 'next/server';
import { createSyndication, deleteSyndication, getSyndicationById } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';
import { looksLikeArticleUrl } from '@/lib/utils';
import { logActivity } from '@/lib/logger';

export async function POST(request: Request) {
  try {
    const { feedId, url, initialAction = 'recent' } = await request.json();
    
    if (!feedId || !url) {
      return NextResponse.json({ error: 'feedId and url are required' }, { status: 400 });
    }

    // Reject URLs that clearly look like regular articles, not RSS feeds
    if (looksLikeArticleUrl(url)) {
      return NextResponse.json({ error: 'This URL looks like a regular article, not an RSS feed. Use the Article tab to ingest individual articles.' }, { status: 400 });
    }

    const syndication = await createSyndication({
      feed_id: feedId,
      url,
    });

    logActivity({ feedId, level: 'info', category: 'rss', message: 'RSS subscription added', details: url });

    try {
      const Parser = (await import('rss-parser')).default;
      const parser = new Parser();
      const feed = await parser.parseURL(url);
      
      if (feed.items && feed.items.length > 0 && initialAction !== 'future') {
        const { createIngestion, getFeedItems, getProcessedUrls, getActiveIngestions } = await import('@/lib/firestore');

        // Dedup: skip URLs that already exist as items, were previously processed, or are currently in-flight
        const existingItems = await getFeedItems(feedId);
        const existingUrls = new Set(existingItems.map(item => item.source_url));
        const processedUrls = await getProcessedUrls(feedId);
        const activeIngestions = await getActiveIngestions(feedId);
        const activeUrls = new Set(activeIngestions.map(ing => ing.url));

        const itemsToProcess = initialAction === 'all' ? feed.items : [feed.items[0]];
        const now = Date.now();
        let skipped = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const itemUrl = item.link;
          if (!itemUrl) continue;

          // Skip if already an item, previously processed, or currently in-flight
          if (existingUrls.has(itemUrl) || processedUrls.has(itemUrl) || activeUrls.has(itemUrl)) {
            skipped++;
            continue;
          }

          // Track this URL so subsequent iterations in the same loop won't re-queue it
          activeUrls.add(itemUrl);

          const ingestion = await createIngestion({
            feed_id: feedId,
            url: itemUrl,
            origin: 'rss',
          });

          // Artificial timestamp: now minus `i` seconds.
          // i=0 (newest in RSS) gets the newest timestamp (now)
          // i=N (oldest in RSS batch) gets now - Ns
          // This guarantees they sit at the top of the podcast feed as "new" episodes,
          // but are chronologically ordered amongst themselves.
          const artificialDate = new Date(now - i * 1000).toISOString();

          await enqueueIngestion({
            ingestionId: ingestion.id!,
            feedId,
            url: itemUrl,
            origin: 'rss',
            published_at: artificialDate,
            syndication_title: feed.title,
          });
        }

        if (skipped > 0) {
          console.log(`RSS bulk-load: skipped ${skipped} already-processed URLs from ${url}`);
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

    const syn = await getSyndicationById(id);
    await deleteSyndication(id);

    if (syn) {
      logActivity({ feedId: syn.feed_id, level: 'warn', category: 'rss', message: 'RSS subscription removed', details: syn.url });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete RSS feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
