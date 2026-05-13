import { NextResponse } from 'next/server';
import { getFeedItemById, createListen } from '@/lib/firestore';
import crypto from 'crypto';

export async function GET(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    let { itemId } = await params;
    
    // Remove .mp3 or .wav extension if present
    itemId = itemId.replace(/\.(mp3|wav)$/, '');
    
    const item = await getFeedItemById(itemId);
    
    if (!item) {
      return new NextResponse('Audio not found', { status: 404 });
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown';
    // Cloud Run uses x-forwarded-for
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    
    // Create daily IP hash for privacy-preserving unique listener tracking
    const today = new Date().toISOString().split('T')[0];
    const ipHash = crypto.createHash('sha256').update(`${ip}-${today}`).digest('hex');

    // Asynchronously log the listen event (don't block the redirect)
    createListen({
      item_id: item.id!,
      feed_id: item.feed_id,
      user_agent: userAgent,
      ip_hash: ipHash,
    }).catch(err => console.error('Failed to log listen:', err));

    // Redirect to the actual GCS media URL
    return NextResponse.redirect(item.media_url, 302);
  } catch (error) {
    console.error('Media proxy error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
