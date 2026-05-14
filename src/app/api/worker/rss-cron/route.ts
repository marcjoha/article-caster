import { NextResponse } from 'next/server';
import { getAllSyndications, updateSyndication, createIngestion, getFeedItems, getIngestionHistory } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';
import Parser from 'rss-parser';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const syndications = await getAllSyndications();
    const parser = new Parser();
    let totalAdded = 0;

    for (const syn of syndications) {
      try {
        const feed = await parser.parseURL(syn.url);
        
        // Fetch existing items for this feed to avoid re-ingesting
        const existingItems = await getFeedItems(syn.feed_id);
        const existingUrls = new Set(existingItems.map(item => item.source_url));
        
        // Fetch ingestion history to avoid re-queueing or re-ingesting deleted items
        const ingestionHistory = await getIngestionHistory(syn.feed_id);
        const historyUrls = new Set(ingestionHistory.map(ing => ing.url));

        // Process up to 5 newest items
        const itemsToCheck = feed.items.slice(0, 5);

        for (const item of itemsToCheck) {
          const itemUrl = item.link;
          if (!itemUrl) continue;

          // Skip items that were published before we subscribed to the feed
          if (syn.created_at && item.isoDate) {
            const pubDate = new Date(item.isoDate);
            if (pubDate < syn.created_at) {
              continue;
            }
          }

          // If it's not already an item and has never been ingested
          if (!existingUrls.has(itemUrl) && !historyUrls.has(itemUrl)) {
            const ingestion = await createIngestion({
              feed_id: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
            });

            await enqueueIngestion({
              ingestionId: ingestion.id!,
              feedId: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
            });

            totalAdded++;
          }
        }

        // Update the syndication record with latest title and last_checked_at
        await updateSyndication(syn.id!, {
          title: feed.title || syn.title,
          last_checked_at: new Date(),
        });

      } catch (feedError) {
        console.error(`Error processing RSS feed ${syn.url}:`, feedError);
      }
    }

    return NextResponse.json({ success: true, added: totalAdded });
  } catch (error: unknown) {
    console.error('RSS cron error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

