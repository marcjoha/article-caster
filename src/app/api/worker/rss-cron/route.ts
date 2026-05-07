import { NextResponse } from 'next/server';
import { getAllSyndications, updateSyndication, createIngestion, getFeedItems, getActiveIngestions } from '@/lib/firestore';
import Parser from 'rss-parser';
import { CloudTasksClient } from '@google-cloud/tasks';

export const dynamic = 'force-dynamic';

export async function GET() {
  const isLocal = !process.env.K_SERVICE && process.env.NODE_ENV === 'development';
  
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
        
        // Fetch active ingestions to avoid re-queueing
        const activeIngestions = await getActiveIngestions(syn.feed_id);
        const activeUrls = new Set(activeIngestions.map(ing => ing.url));

        // Process up to 5 newest items
        const itemsToCheck = feed.items.slice(0, 5);

        for (const item of itemsToCheck) {
          const itemUrl = item.link;
          if (!itemUrl) continue;

          // If it's not already an item and not already queued
          if (!existingUrls.has(itemUrl) && !activeUrls.has(itemUrl)) {
            const ingestion = await createIngestion({
              feed_id: syn.feed_id,
              url: itemUrl,
            });

            if (isLocal) {
              fetch(`http://localhost:3000/api/worker/ingest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ingestionId: ingestion.id, feedId: syn.feed_id, url: itemUrl }),
              }).catch(console.error);
            } else {
              const client = new CloudTasksClient();
              const project = process.env.GOOGLE_CLOUD_PROJECT!;
              const queue = process.env.QUEUE_NAME || 'article-caster-queue';
              const location = process.env.CLOUD_TASKS_REGION || 'europe-west1';
              
              const parent = client.queuePath(project, location, queue);
              const serviceUrl = process.env.PUBLIC_URL;
              
              if (serviceUrl) {
                const task = {
                  httpRequest: {
                    httpMethod: 'POST' as const,
                    url: `${serviceUrl}/api/worker/ingest`,
                    body: Buffer.from(JSON.stringify({ ingestionId: ingestion.id, feedId: syn.feed_id, url: itemUrl })).toString('base64'),
                    headers: {
                      'Content-Type': 'application/json',
                    },
                  },
                };
                await client.createTask({ parent, task });
              }
            }

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
