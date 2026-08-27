import { NextResponse } from 'next/server';
import { getAllSyndications, updateSyndication, createIngestion, getFeedItems, getProcessedUrls } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';
import { logActivity } from '@/lib/logger';
import Parser from 'rss-parser';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const syndications = await getAllSyndications();
    const parser = new Parser();
    let totalAdded = 0;

    for (const syn of syndications) {
      let addedForSyn = 0;
      try {
        logActivity({ feedId: syn.feed_id, level: 'info', category: 'rss', message: `RSS sync checking "${syn.title || syn.url}"`, details: syn.url });
        const feed = await parser.parseURL(syn.url);
        
        // Fetch existing items for this feed to avoid re-ingesting
        const existingItems = await getFeedItems(syn.feed_id);
        const existingUrls = new Set(existingItems.map(item => item.source_url));
        
        // Fetch processed URLs to avoid re-queueing or re-ingesting deleted items
        const processedUrls = await getProcessedUrls(syn.feed_id);

        // Process up to 5 newest items
        const rawItemsToCheck = feed.items.slice(0, 5);
        // Explicitly sort items by original publication date descending (newest first) to ensure chronological order
        const itemsToCheck = [...rawItemsToCheck].sort((a, b) => {
          const dateA = a.isoDate ? new Date(a.isoDate) : (a.pubDate ? new Date(a.pubDate) : new Date(0));
          const dateB = b.isoDate ? new Date(b.isoDate) : (b.pubDate ? new Date(b.pubDate) : new Date(0));
          return dateB.getTime() - dateA.getTime();
        });
        const now = Date.now();

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

          // If it's not already an item and has never been processed
          if (!existingUrls.has(itemUrl) && !processedUrls.has(itemUrl)) {
            const ingestion = await createIngestion({
              feed_id: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
              title: item.title?.trim() || undefined,
            });

            // Use original publication date, with deterministic subtractive index fallback if missing/identical
            const rawItemDate = item.isoDate ? new Date(item.isoDate) : (item.pubDate ? new Date(item.pubDate) : null);
            const baseTime = rawItemDate && !isNaN(rawItemDate.getTime()) ? rawItemDate.getTime() : now;
            const publishedAtStr = new Date(baseTime - i * 1000).toISOString();

            await enqueueIngestion({
              ingestionId: ingestion.id!,
              feedId: syn.feed_id,
              url: itemUrl,
              origin: 'rss',
              title: item.title?.trim() || undefined,
              published_at: publishedAtStr,
              syndication_title: feed.title || syn.title,
            });

            totalAdded++;
            addedForSyn++;
          }
        }

        // Update the syndication record with latest title and last_checked_at
        await updateSyndication(syn.id!, {
          title: feed.title || syn.title,
          last_checked_at: new Date(),
        });

        if (addedForSyn > 0) {
          logActivity({ feedId: syn.feed_id, level: 'info', category: 'rss', message: `RSS sync: queued ${addedForSyn} new episode${addedForSyn > 1 ? 's' : ''} from "${feed.title || syn.url}"`, details: syn.url });
        }

      } catch (feedError) {
        console.error(`Error processing RSS feed ${syn.url}:`, feedError);
        const errorMsg = feedError instanceof Error ? feedError.message : 'Unknown error';
        logActivity({ feedId: syn.feed_id, level: 'error', category: 'rss', message: `RSS sync failed: ${errorMsg}`, details: syn.url });
      }
    }

    return NextResponse.json({ success: true, added: totalAdded });
  } catch (error: unknown) {
    console.error('RSS cron error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
