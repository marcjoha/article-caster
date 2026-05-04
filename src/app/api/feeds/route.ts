import { NextResponse } from 'next/server';
import { createFeed, getFeeds } from '@/lib/firestore';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  const { title, description, cover_image_url } = await request.json();
  const slug = uuidv4().replace(/-/g, '');
  
  const feed = await createFeed({
    title,
    description,
    unguessable_slug: slug,
    ...(cover_image_url && { cover_image_url }),
  });

  return NextResponse.json({ success: true, feed });
}

export async function GET() {
  const feeds = await getFeeds();
  return NextResponse.json({ feeds });
}
