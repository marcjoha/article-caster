import { CloudTasksClient } from '@google-cloud/tasks';

interface IngestionPayload {
  ingestionId: string;
  feedId: string;
  url: string;
  origin: 'article' | 'rss' | 'youtube';
  itemId?: string;
  published_at?: string;
}

const isLocal = () => !process.env.K_SERVICE && process.env.NODE_ENV === 'development';

/**
 * Enqueues an ingestion task. In local dev, fires a direct fetch to the worker.
 * In production, creates a Cloud Tasks job.
 */
export async function enqueueIngestion(payload: IngestionPayload): Promise<void> {
  const body = JSON.stringify(payload);

  if (isLocal()) {
    fetch('http://localhost:3000/api/worker/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(console.error);
    return;
  }

  const client = new CloudTasksClient();
  const project = process.env.GOOGLE_CLOUD_PROJECT!;
  const queue = process.env.QUEUE_NAME || 'article-caster-queue';
  const location = process.env.CLOUD_TASKS_REGION || 'europe-west1';
  const serviceUrl = process.env.PUBLIC_URL;

  if (!serviceUrl) {
    throw new Error('PUBLIC_URL environment variable is required for Cloud Tasks');
  }

  const parent = client.queuePath(project, location, queue);

  await client.createTask({
    parent,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${serviceUrl}/api/worker/ingest`,
        body: Buffer.from(body).toString('base64'),
        headers: { 'Content-Type': 'application/json' },
      },
    },
  });
}
