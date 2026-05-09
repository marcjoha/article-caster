import { NextResponse } from 'next/server';
import { createFeed, getFeeds } from '@/lib/firestore';
import { uploadFile } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string | undefined;
    const author = formData.get('author') as string | undefined;
    const tts_voice = formData.get('tts_voice') as string | undefined;
    const audio_prefix_message = formData.get('audio_prefix_message') as string | undefined;
    const coverImageFile = formData.get('cover_image') as File | null;
    
    let cover_image_url = formData.get('cover_image_url') as string | undefined;
    
    if (coverImageFile) {
      const buffer = Buffer.from(await coverImageFile.arrayBuffer());
      const safeName = coverImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      cover_image_url = await uploadFile(`covers/${Date.now()}-${safeName}`, buffer, coverImageFile.type);
    }

    const slug = uuidv4().replace(/-/g, '');
    
    const feed = await createFeed({
      title,
      description,
      category,
      ...(author && { author }),
      unguessable_slug: slug,
      ...(cover_image_url && { cover_image_url }),
      ...(tts_voice && { tts_voice }),
      ...(audio_prefix_message && { audio_prefix_message }),
    });

    return NextResponse.json({ success: true, feed });
  } catch (error: unknown) {
    console.error('Create feed error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const feeds = await getFeeds();
    return NextResponse.json({ feeds });
  } catch (error: unknown) {
    console.error('List feeds error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
