import { NextResponse } from 'next/server';
import { getFeedBySlug, getFeedItems } from '@/lib/firestore';
import { generatePodcastRss } from '@/lib/feed/generator';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    let { slug } = await params;
    slug = slug.replace(/\.xml$/, '');
    const feed = await getFeedBySlug(slug);
    
    if (!feed) {
      return new NextResponse('Feed not found', { status: 404 });
    }

    const items = await getFeedItems(feed.id!);
    
    const hostUrl = process.env.NODE_ENV === 'development' 
      ? 'http://localhost:3000' 
      : `https://${request.headers.get('host')}`;

    const rssXml = generatePodcastRss(feed, items, hostUrl);

    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
      },
    });
  } catch (error: unknown) {
    console.error('Feed generation error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
