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
        const { createIngestion, getFeedItems, getActiveIngestions } = await import('@/lib/firestore');

        // Dedup: skip URLs that already exist as items or are currently in-flight
        const existingItems = await getFeedItems(feedId);
        const existingUrls = new Set(existingItems.map(item => item.source_url));
        const activeIngestions = await getActiveIngestions(feedId);
        const activeUrls = new Set(activeIngestions.map(ing => ing.url));

        const rawItems = initialAction === 'all' ? feed.items : [feed.items[0]];
        // Sort items by original publication date descending (newest first) to ensure chronological order within the batch
        const itemsToProcess = [...rawItems].sort((a, b) => {
          const dateA = a.isoDate ? new Date(a.isoDate) : (a.pubDate ? new Date(a.pubDate) : new Date(0));
          const dateB = b.isoDate ? new Date(b.isoDate) : (b.pubDate ? new Date(b.pubDate) : new Date(0));
          return dateB.getTime() - dateA.getTime();
        });
        const now = Date.now();
        let skipped = 0;

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const itemUrl = item.link;
          if (!itemUrl) continue;

          // Skip if already an item or currently in-flight
          if (existingUrls.has(itemUrl) || activeUrls.has(itemUrl)) {
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

          // Group the batch at "now" (the global ingestion moment) so they remain in-place,
          // but subtract i seconds to preserve internal chronological descending order (newest first).
          const publishedAtStr = new Date(now - i * 1000).toISOString();

          await enqueueIngestion({
            ingestionId: ingestion.id!,
            feedId,
            url: itemUrl,
            origin: 'rss',
            published_at: publishedAtStr,
            syndication_title: feed.title || syndication.title,
          });
        }

        if (skipped > 0) {
          console.log(`RSS bulk-load: skipped ${skipped} already-existing/in-flight URLs from ${url}`);
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

export async function PUT(request: Request) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const syn = await getSyndicationById(id);
    if (!syn) {
      return NextResponse.json({ error: 'Syndication not found' }, { status: 404 });
    }

    const Parser = (await import('rss-parser')).default;
    const parser = new Parser();
    const feed = await parser.parseURL(syn.url);

    const { updateSyndication, createIngestion, getFeedItems, getProcessedUrls } = await import('@/lib/firestore');
    
    // Fetch existing items to avoid duplicates
    const existingItems = await getFeedItems(syn.feed_id);
    const existingUrls = new Set(existingItems.map(item => item.source_url));
    const processedUrls = await getProcessedUrls(syn.feed_id);

    // Process up to 5 newest items
    const rawItemsToCheck = feed.items.slice(0, 5);
    const itemsToCheck = [...rawItemsToCheck].sort((a, b) => {
      const dateA = a.isoDate ? new Date(a.isoDate) : (a.pubDate ? new Date(a.pubDate) : new Date(0));
      const dateB = b.isoDate ? new Date(b.isoDate) : (b.pubDate ? new Date(b.pubDate) : new Date(0));
      return dateB.getTime() - dateA.getTime();
    });

    const now = Date.now();
    let addedForSyn = 0;

    for (let i = 0; i < itemsToCheck.length; i++) {
      const item = itemsToCheck[i];
      const itemUrl = item.link;
      if (!itemUrl) continue;

      // Skip historical items published before the syndication was subscribed to
      const itemDate = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
      const thresholdTime = syn.created_at ? syn.created_at.getTime() - 60000 : 0;
      if (itemDate && itemDate.getTime() <= thresholdTime) {
        continue;
      }

      if (!existingUrls.has(itemUrl) && !processedUrls.has(itemUrl)) {
        const ingestion = await createIngestion({
          feed_id: syn.feed_id,
          url: itemUrl,
          origin: 'rss',
        });

        const publishedAtStr = new Date(now - i * 1000).toISOString();

        await enqueueIngestion({
          ingestionId: ingestion.id!,
          feedId: syn.feed_id,
          url: itemUrl,
          origin: 'rss',
          published_at: publishedAtStr,
          syndication_title: feed.title || syn.title,
        });

        addedForSyn++;
      }
    }

    await updateSyndication(syn.id!, {
      title: feed.title || syn.title,
      last_checked_at: new Date(),
    });

    logActivity({
      feedId: syn.feed_id,
      level: 'info',
      category: 'rss',
      message: `Manual RSS sync triggered: ${addedForSyn} new episode${addedForSyn === 1 ? '' : 's'} queued from "${feed.title || syn.url}"`,
      details: syn.url
    });

    return NextResponse.json({ success: true, added: addedForSyn });
  } catch (error: unknown) {
    console.error('Sync RSS feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
