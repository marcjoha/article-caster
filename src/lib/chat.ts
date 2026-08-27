/**
 * Google Chat webhook notification for new podcast episodes.
 * Sends a rich card message to a Google Chat space when a new episode is ingested.
 * Opt-in: requires a chat_webhook_url to be configured on the feed.
 */
import { logActivity } from './logger';

interface EpisodeNotification {
  title: string;
  description: string;
  sourceUrl: string;
  durationSeconds: number;
  origin: string;
  coverImageUrl?: string;
  webhookUrl?: string;
  mediaUrl: string;
  feedUrl: string;
  feedTitle: string;
  feedId: string;
  syndicationTitle?: string;
}



/**
 * Posts a rich card notification to Google Chat for a newly ingested episode.
 * The card includes an AI-generated summary, quick-listen and subscribe links,
 * and a prompt to encourage discussion.
 *
 * Each episode is posted as a top-level message.
 *
 * Silently returns if no webhookUrl is provided.
 * Never throws — all errors are caught and logged.
 */
export async function notifyNewEpisode(episode: EpisodeNotification): Promise<void> {
  if (!episode.webhookUrl) return;

  const minutes = Math.round(episode.durationSeconds / 60);

  let domain = '';
  try {
    domain = new URL(episode.sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = episode.sourceUrl;
  }

  // --- Card header ---
  const header: Record<string, string> = {
    title: episode.feedTitle,
    imageType: 'SQUARE',
  };
  if (episode.coverImageUrl) {
    header.imageUrl = episode.coverImageUrl;
  }
  // --- Section 1: Title + Summary + metadata ---
  const summaryWidgets: Record<string, unknown>[] = [];

  summaryWidgets.push({ textParagraph: { text: `<b>${episode.title}</b>` } });

  if (episode.description) {
    summaryWidgets.push({ textParagraph: { text: episode.description } });
  }

  summaryWidgets.push({ divider: {} });

  let sourceLabel: string;
  switch (episode.origin) {
    case 'rss':
      sourceLabel = episode.syndicationTitle
        ? `Blog from <b>${episode.syndicationTitle}</b> at <b>${domain}</b>`
        : `Blog from <b>${domain}</b>`;
      break;
    case 'youtube':
      sourceLabel = 'Video from <b>YouTube</b>';
      break;
    case 'pdf':
      sourceLabel = `PDF from <b>${domain}</b>`;
      break;
    default:
      sourceLabel = `Article from <b>${domain}</b>`;
  }

  summaryWidgets.push({
    decoratedText: {
      startIcon: { materialIcon: { name: 'language' } },
      text: sourceLabel,
    },
  });

  summaryWidgets.push({
    decoratedText: {
      startIcon: { materialIcon: { name: 'schedule' } },
      text: `${minutes} min`,
    },
  });

  // --- Section 2: Action buttons ---
  const buttons: Record<string, unknown>[] = [];
  const isVideo = episode.origin === 'youtube' || episode.mediaUrl.toLowerCase().endsWith('.mp4');
  const isPdf = episode.origin === 'pdf';

  if (episode.mediaUrl) {
    buttons.push({
      text: isVideo ? 'Watch' : 'Listen',
      icon: { materialIcon: { name: isVideo ? 'play_circle' : 'headphones' } },
      onClick: { openLink: { url: episode.mediaUrl } },
    });
  }

  buttons.push({
    text: 'Source',
    icon: { materialIcon: { name: isVideo ? 'smart_display' : isPdf ? 'picture_as_pdf' : 'article' } },
    onClick: { openLink: { url: episode.sourceUrl } },
  });

  if (episode.feedUrl) {
    let subscribeUrl = episode.feedUrl;
    try {
      const parsedFeedUrl = new URL(episode.feedUrl);
      const pathParts = parsedFeedUrl.pathname.split('/');
      const slug = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
      if (slug) {
        subscribeUrl = `${parsedFeedUrl.origin}/subscribe/${slug}`;
      }
    } catch (e) {
      console.error('Failed to parse feedUrl for subscription landing page:', e);
    }

    buttons.push({
      text: 'Subscribe',
      icon: { materialIcon: { name: 'podcasts' } },
      onClick: { openLink: { url: subscribeUrl } },
    });
  }

  const actionWidgets: Record<string, unknown>[] = [
    { buttonList: { buttons } },
  ];

  // --- Section 3: Discussion prompt ---
  const discussionWidgets: Record<string, unknown>[] = [
    {
      decoratedText: {
        startIcon: { materialIcon: { name: 'chat_bubble' } },
        text: '<i>Thoughts? Reply to this thread!</i>',
      },
    },
  ];

  // --- Build sections ---
  const sections: Record<string, unknown>[] = [
    { widgets: summaryWidgets },
    { widgets: actionWidgets },
    { widgets: discussionWidgets },
  ];

  const payload: Record<string, unknown> = {
    cardsV2: [{
      cardId: `episode-${Date.now()}`,
      card: {
        header,
        sections,
      },
    }],
  };

  const body = JSON.stringify(payload);
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(episode.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body,
      });

      if (response.ok) {
        logActivity({ feedId: episode.feedId, level: 'info', category: 'chat', message: 'Chat notification sent', details: episode.sourceUrl });
        return;
      }

      const responseBody = await response.text();
      let reason = responseBody.slice(0, 200);
      try {
        const parsed = JSON.parse(responseBody);
        if (parsed?.error?.message) reason = parsed.error.message;
      } catch { /* use raw body */ }

      // 4xx = permanent failure, don't retry
      if (response.status < 500) {
        console.error(`Google Chat webhook failed (${response.status}):`, responseBody);
        logActivity({ feedId: episode.feedId, level: 'error', category: 'chat', message: `Chat webhook failed (${response.status}): ${reason}`, details: episode.sourceUrl });
        return;
      }

      // 5xx = transient, retry if attempts remain
      if (attempt === maxAttempts) {
        console.error(`Google Chat webhook failed after ${maxAttempts} attempts (${response.status}):`, responseBody);
        logActivity({ feedId: episode.feedId, level: 'error', category: 'chat', message: `Chat webhook failed after ${maxAttempts} retries (${response.status}): ${reason}`, details: episode.sourceUrl });
        return;
      }

      // Exponential backoff: 2s, 4s, 8s
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));

    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('Google Chat webhook error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logActivity({ feedId: episode.feedId, level: 'error', category: 'chat', message: `Chat webhook error after ${maxAttempts} retries: ${msg}`, details: episode.sourceUrl });
        return;
      }

      // Network error — retry with backoff
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
    }
  }
}
