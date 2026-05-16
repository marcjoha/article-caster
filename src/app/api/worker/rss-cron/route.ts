import { NextResponse } from 'next/server';
import { getAllSyndications, updateSyndication, createIngestion, getFeedItems, getProcessedUrls } from '@/lib/firestore';
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
        
        // Fetch processed URLs to avoid re-queueing or re-ingesting deleted items
        const processedUrls = await getProcessedUrls(syn.feed_id);

        // Process up to 5 newest items
        const itemsToCheck = feed.items.slice(0, 5);
        const now = Date.now();

        for (let i = 0; i < itemsToCheck.length; i++) {
          const item = itemsToCheck[i];
          const itemUrl = item.link;
          if (!itemUrl) continue;

          // If it's not already an item and has never been processed
          if (!existingUrls.has(itemUrl) && !processedUrls.has(itemUrl)) {
            const ingestion = await createIngestion({
              feed_id: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
            });

            // Artificial timestamp: now minus `i` seconds.
            // i=0 (newest in RSS) gets the newest timestamp (now)
            // i=4 (oldest in RSS batch) gets now - 4s
            // This guarantees they sit at the top of the podcast feed as "new" episodes, 
            // but are chronologically ordered amongst themselves.
            const artificialDate = new Date(now - i * 1000).toISOString();

            await enqueueIngestion({
              ingestionId: ingestion.id!,
              feedId: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
              published_at: artificialDate,
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
