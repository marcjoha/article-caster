import { NextResponse } from 'next/server';
import { createIngestion } from '@/lib/firestore';
import { enqueueIngestion } from '@/lib/tasks';
import { uploadFile } from '@/lib/storage';
import { logActivity } from '@/lib/logger';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const feedId = formData.get('feedId') as string | null;

    if (!file || !feedId) {
      return NextResponse.json({ error: 'Missing file or feedId' }, { status: 400 });
    }

    // Validate mime-type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are supported.' }, { status: 400 });
    }

    // Validate size (20MB)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'PDF file exceeds the 20MB limit.' }, { status: 400 });
    }

    // Convert file to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate SHA-256 hash for content-based deduplication
    const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const destinationPath = `content/pdf/${contentHash}.pdf`;

    // Upload to GCS indefinitely as public and inline-viewable
    const gcsPublicUrl = await uploadFile(destinationPath, buffer, 'application/pdf', 'inline');

    // Create a pending ingestion record
    const ingestion = await createIngestion({
      feed_id: feedId,
      url: gcsPublicUrl,
      origin: 'pdf',
    });

    // Enqueue the ingestion task
    await enqueueIngestion({
      ingestionId: ingestion.id!,
      feedId,
      url: gcsPublicUrl,
      origin: 'pdf',
    });

    logActivity({
      feedId,
      level: 'info',
      category: 'ingestion',
      message: `PDF file "${file.name}" uploaded successfully`,
      details: `Saved to ${gcsPublicUrl} (${(file.size / 1024 / 1024).toFixed(2)} MB)`
    });

    logActivity({
      feedId,
      level: 'info',
      category: 'ingestion',
      message: 'PDF queued for ingestion',
      details: gcsPublicUrl
    });

    return NextResponse.json({ success: true, ingestionId: ingestion.id });
  } catch (error: unknown) {
    console.error('PDF upload ingestion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
