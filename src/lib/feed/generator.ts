import { Podcast } from 'podcast';
import { Feed, FeedItem } from '../firestore';

export const generatePodcastRss = (feed: Feed, items: FeedItem[], hostUrl: string): string => {
  const feedUrl = `${hostUrl}/feed/${feed.unguessable_slug}.xml`;

  const podcast = new Podcast({
    title: feed.title,
    description: feed.description,
    feedUrl: feedUrl,
    siteUrl: hostUrl,
    imageUrl: feed.cover_image_url || `${hostUrl}/default-cover.png`,
    author: 'article-caster',
    language: 'en-US',
    pubDate: new Date().toUTCString(),
    ttl: 60,
    itunesAuthor: 'article-caster',
    itunesSubtitle: feed.description,
    itunesSummary: feed.description,
    itunesOwner: { name: 'article-caster', email: 'admin@article-caster.com' },
    itunesImage: feed.cover_image_url || `${hostUrl}/default-cover.png`,
    itunesCategory: [{ text: feed.category || 'Technology' }],
  });

  items.forEach(item => {
    podcast.addItem({
      title: item.title,
      description: item.description,
      url: item.source_url,
      guid: item.id!,
      date: item.created_at,
      enclosure: {
        url: item.media_url,
        size: item.size_bytes,
        type: 'audio/mpeg',
      },
      itunesDuration: item.duration_seconds,
      itunesSummary: item.description,
    });
  });

  return podcast.buildXml({ indent: '  ' });
};
