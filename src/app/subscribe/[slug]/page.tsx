import { getFeedBySlug } from '@/lib/firestore';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import SubscribeClientPage from './SubscribeClientPage';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function SubscribePage({ params }: PageProps) {
  let { slug } = await params;
  slug = decodeURIComponent(slug).replace(/\.xml$/, '');
  
  let feed;
  if (slug === 'mock-test-feed') {
    feed = {
      title: 'My Mock Podcast',
      description: 'A mock podcast feed generated for local development testing of Webhook notifications.',
      unguessable_slug: 'mock-test-feed',
      created_at: new Date(),
    };
  } else {
    feed = await getFeedBySlug(slug);
  }

  if (!feed) {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  const hostUrl = `${protocol}://${host}`;

  return (
    <SubscribeClientPage 
      feed={JSON.parse(JSON.stringify(feed))} 
      hostUrl={hostUrl}
    />
  );
}
