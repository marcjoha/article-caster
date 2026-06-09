import { NextResponse } from 'next/server';
import { notifyNewEpisode } from '@/lib/chat';

export async function POST(request: Request) {
  try {
    const { webhookUrl, feedTitle, coverImageUrl } = await request.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: 'No webhook URL provided' }, { status: 400 });
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
    const hostUrl = `${protocol}://${host}`;

    // Use the real notifyNewEpisode function with mock episode data
    // so the test card matches the exact design of actual notifications.
    await notifyNewEpisode({
      title: 'The Future of AI-Powered Development Tools',
      description: 'An exploration of how AI coding assistants are reshaping software engineering workflows, from automated code review to intelligent debugging.',
      sourceUrl: 'https://example.com/blog/future-of-ai-dev-tools',
      durationSeconds: 480,
      origin: 'article',
      coverImageUrl: coverImageUrl || undefined,
      webhookUrl,
      mediaUrl: 'https://example.com/sample.mp3',
      feedUrl: `${hostUrl}/feed/mock-test-feed.xml`,
      feedTitle: feedTitle || 'My Podcast',
      feedId: '',
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Webhook test error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

