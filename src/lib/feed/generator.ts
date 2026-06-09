import { Podcast } from 'podcast';
import { Feed, FeedItem } from '../firestore';

export const generatePodcastRss = (feed: Feed, items: FeedItem[], hostUrl: string): string => {
  const feedUrl = `${hostUrl}/feed/${feed.unguessable_slug}.xml`;

  const description = feed.description.substring(0, 4000);
  const authorName = feed.author || 'article-caster';
  const authorDisplay = `${authorName} via article-caster`;

  const podcast = new Podcast({
    title: feed.title,
    description: description,
    feedUrl: feedUrl,
    siteUrl: 'https://github.com/marcjoha/article-caster',
    imageUrl: feed.cover_image_url || `${hostUrl}/default-cover.png`,
    author: authorDisplay,
    language: 'en-US',
    pubDate: new Date().toUTCString(),
    ttl: 60,
    itunesAuthor: authorDisplay,
    itunesSubtitle: description.substring(0, 255),
    itunesSummary: description,
    itunesImage: feed.cover_image_url || `${hostUrl}/default-cover.png`,
    itunesCategory: [{ text: feed.category || 'Technology' }],
  });

  items.forEach(item => {
    let itemDescription = item.description.substring(0, 4000);
    if (item.type === 'video' && feed.audio_prefix_message) {
      itemDescription = `Intro: ${feed.audio_prefix_message}\n\n` + itemDescription;
    }

    const isWav = item.media_url.toLowerCase().endsWith('.wav');
    const isVideo = item.type === 'video' || item.media_url.toLowerCase().endsWith('.mp4');
    
    const fileExt = isVideo ? 'mp4' : (isWav ? 'wav' : 'mp3');
    const mediaProxyUrl = `${hostUrl}/media/${item.id!}.${fileExt}`;
    
    podcast.addItem({
      title: item.title,
      description: itemDescription,
      url: item.source_url,
      guid: item.id!,
      date: item.created_at,
      enclosure: {
        url: mediaProxyUrl,
        size: item.size_bytes,
        type: isVideo ? 'video/mp4' : (isWav ? 'audio/wav' : 'audio/mpeg'),
      },
      itunesDuration: item.duration_seconds,
      itunesSummary: itemDescription,
    });
  });

  return podcast.buildXml({ indent: '  ' });
};
