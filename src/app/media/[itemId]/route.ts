import { NextResponse } from 'next/server';
import { getFeedItemById } from '@/lib/firestore';

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    let { itemId } = await params;
    
    // Remove .mp3, .wav, or .mp4 extension if present
    itemId = itemId.replace(/\.(mp3|wav|mp4)$/, '');
    
    const item = await getFeedItemById(itemId);
    
    if (!item) {
      return new NextResponse('Audio not found', { status: 404 });
    }

    // Redirect to the actual GCS media URL
    return NextResponse.redirect(item.media_url, 302);
  } catch (error) {
    console.error('Media proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
