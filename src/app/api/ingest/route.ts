import { NextResponse } from 'next/server';
import { createIngestion } from '@/lib/firestore';
import { CloudTasksClient } from '@google-cloud/tasks';

export async function POST(request: Request) {
  try {
    const { feedId, url } = await request.json();
    
    // Create pending ingestion record
    const ingestion = await createIngestion({
      feed_id: feedId,
      url,
    });

    const isLocal = !process.env.K_SERVICE && process.env.NODE_ENV === 'development';
    
    if (isLocal) {
      // In local dev, just simulate background by calling the worker directly asynchronously
      fetch(`http://localhost:3000/api/worker/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingestionId: ingestion.id, feedId, url }),
      }).catch(console.error);
    } else {
      // Production: Enqueue to Cloud Tasks
      const client = new CloudTasksClient();
      const project = process.env.GOOGLE_CLOUD_PROJECT!;
      const queue = process.env.QUEUE_NAME || 'article-caster-queue';
      const location = process.env.CLOUD_TASKS_REGION || 'europe-west1';
      
      const parent = client.queuePath(project, location, queue);
      const serviceUrl = process.env.PUBLIC_URL;
      
      if (!serviceUrl) {
         throw new Error("PUBLIC_URL environment variable is required for Cloud Tasks");
      }
      
      const task = {
        httpRequest: {
          httpMethod: 'POST' as const,
          url: `${serviceUrl}/api/worker/ingest`,
          body: Buffer.from(JSON.stringify({ ingestionId: ingestion.id, feedId, url })).toString('base64'),
          headers: {
            'Content-Type': 'application/json',
          },
        },
      };

      await client.createTask({ parent, task });
    }

    return NextResponse.json({ success: true, ingestionId: ingestion.id });
  } catch (error: unknown) {
    console.error('Ingestion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
