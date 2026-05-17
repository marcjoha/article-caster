/**
 * Google Chat webhook notification for new podcast episodes.
 * Sends a rich card message to a Google Chat space when a new episode is ingested.
 * Opt-in: requires a chat_webhook_url to be configured on the feed.
 */

interface EpisodeNotification {
  title: string;
  description: string;
  sourceUrl: string;
  durationSeconds: number;
  origin: string;
  coverImageUrl?: string;
  webhookUrl?: string;
  feedTitle: string;
  feedSlug: string;
  itemId: string;
}

/**
 * Returns the origin-specific emoji and label for the card header.
 */
function getOriginHeader(origin: string): { emoji: string; label: string } {
  switch (origin) {
    case 'rss':
      return { emoji: '📡', label: 'New RSS Episode' };
    case 'youtube':
      return { emoji: '🎬', label: 'New YouTube Episode' };
    default:
      return { emoji: '📰', label: 'New Article Episode' };
  }
}

/**
 * Posts a rich card notification to Google Chat for a newly ingested episode.
 * The card includes an AI-generated summary, quick-listen and subscribe links,
 * and a prompt to encourage discussion in the chat thread.
 *
 * Uses threadKey to group all episodes from the same feed into a single thread.
 *
 * Silently returns if no webhookUrl is provided.
 * Never throws — all errors are caught and logged.
 */
export async function notifyNewEpisode(episode: EpisodeNotification): Promise<void> {
  if (!episode.webhookUrl) return;

  const hostUrl = process.env.PUBLIC_URL || '';
  const minutes = Math.round(episode.durationSeconds / 60);
  const { emoji, label } = getOriginHeader(episode.origin);

  let domain = '';
  try {
    domain = new URL(episode.sourceUrl).hostname.replace(/^www\./, '');
  } catch {
    domain = episode.sourceUrl;
  }

  // --- Card header ---
  const header: Record<string, string> = {
    title: `${emoji} ${label}`,
    subtitle: episode.title,
    imageType: 'SQUARE',
  };
  if (episode.coverImageUrl) {
    header.imageUrl = episode.coverImageUrl;
  }

  // --- Section 1: Summary + metadata ---
  const summaryWidgets: Record<string, unknown>[] = [];

  if (episode.description) {
    summaryWidgets.push({ textParagraph: { text: episode.description } });
  }

  summaryWidgets.push({ divider: {} });

  summaryWidgets.push({
    decoratedText: {
      startIcon: { knownIcon: 'MAP_PIN' },
      text: `Source: <b>${domain}</b>`,
    },
  });

  summaryWidgets.push({
    decoratedText: {
      startIcon: { knownIcon: 'CLOCK' },
      text: `Duration: ${minutes} min`,
    },
  });

  // --- Section 2: Action buttons ---
  const buttons: Record<string, unknown>[] = [];

  if (hostUrl && episode.itemId) {
    buttons.push({
      text: '▶️ Listen Now',
      onClick: { openLink: { url: `${hostUrl}/media/${episode.itemId}.mp3` } },
    });
  }

  if (hostUrl && episode.feedSlug) {
    buttons.push({
      text: '🔔 Subscribe to Feed',
      onClick: { openLink: { url: `${hostUrl}/feed/${episode.feedSlug}.xml` } },
    });
  }

  buttons.push({
    text: '📖 Read Original',
    onClick: { openLink: { url: episode.sourceUrl } },
  });

  const actionWidgets: Record<string, unknown>[] = [
    { buttonList: { buttons } },
  ];

  // --- Section 3: Discussion prompt ---
  const discussionWidgets: Record<string, unknown>[] = [
    { textParagraph: { text: '💬 <i>Thoughts? Reply to this thread to discuss!</i>' } },
  ];

  // --- Build sections ---
  const sections: Record<string, unknown>[] = [
    { widgets: summaryWidgets },
    { widgets: actionWidgets },
    { widgets: discussionWidgets },
  ];

  // --- Thread grouping: append threadKey to webhook URL ---
  let webhookUrlWithThread = episode.webhookUrl;
  if (episode.feedSlug) {
    const separator = episode.webhookUrl.includes('?') ? '&' : '?';
    webhookUrlWithThread = `${episode.webhookUrl}${separator}threadKey=${episode.feedSlug}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`;
  }

  try {
    const response = await fetch(webhookUrlWithThread, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        cardsV2: [{
          cardId: `episode-${Date.now()}`,
          card: {
            header,
            sections,
          },
        }],
      }),
    });

    if (!response.ok) {
      console.error(`Google Chat webhook failed (${response.status}):`, await response.text());
    }
  } catch (error) {
    console.error('Google Chat webhook error:', error);
  }
}
