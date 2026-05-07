import { NextResponse } from 'next/server';
import { createSyndication, deleteSyndication } from '@/lib/firestore';

export async function POST(request: Request) {
  try {
    const { feedId, url } = await request.json();
    
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
      
      if (feed.items && feed.items.length > 0) {
        const itemUrl = feed.items[0].link;
        if (itemUrl) {
          const { createIngestion } = await import('@/lib/firestore');
          const ingestion = await createIngestion({
            feed_id: feedId,
            url: itemUrl,
          });

          const isLocal = !process.env.K_SERVICE && process.env.NODE_ENV === 'development';
          if (isLocal) {
            fetch(`http://localhost:3000/api/worker/ingest`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ingestionId: ingestion.id, feedId, url: itemUrl }),
            }).catch(console.error);
          } else {
            const { CloudTasksClient } = await import('@google-cloud/tasks');
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
                  body: Buffer.from(JSON.stringify({ ingestionId: ingestion.id, feedId, url: itemUrl })).toString('base64'),
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
              };
              await client.createTask({ parent, task });
            }
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
