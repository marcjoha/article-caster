/**
 * Google Chat webhook notification for new podcast episodes.
 * Sends a rich card message to a Google Chat space when a new episode is ingested.
 * Opt-in: requires GOOGLE_CHAT_WEBHOOK_URL environment variable to be set.
 */

interface EpisodeNotification {
  title: string;
  description: string;
  sourceUrl: string;
  durationSeconds: number;
  origin: string;
  coverImageUrl?: string;
  webhookUrl?: string;
}

/**
 * Posts a rich card notification to Google Chat for a newly ingested episode.
 * Silently returns if no webhookUrl is provided.
 * Never throws — all errors are caught and logged.
 */
export async function notifyNewEpisode(episode: EpisodeNotification): Promise<void> {
  if (!episode.webhookUrl) return;

  const minutes = Math.round(episode.durationSeconds / 60);
  const originLabel = episode.origin === 'rss' ? 'RSS' : episode.origin === 'youtube' ? 'YouTube' : 'Article';

  const header: Record<string, string> = {
    title: '🎙️ New Episode',
    subtitle: episode.title,
    imageType: 'SQUARE',
  };
  if (episode.coverImageUrl) {
    header.imageUrl = episode.coverImageUrl;
  }

  const widgets: Record<string, unknown>[] = [];

  if (episode.description) {
    widgets.push({ textParagraph: { text: episode.description } });
  }

  widgets.push({
    decoratedText: {
      startIcon: { knownIcon: 'CLOCK' },
      text: `Duration: ${minutes} min`,
    },
  });

  widgets.push({
    decoratedText: {
      startIcon: { knownIcon: 'BOOKMARK' },
      text: `Source: ${originLabel}`,
    },
  });

  widgets.push({
    buttonList: {
      buttons: [{
        text: '🔗 Read Source',
        onClick: { openLink: { url: episode.sourceUrl } },
      }],
    },
  });

  try {
    const response = await fetch(episode.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        cardsV2: [{
          cardId: `episode-${Date.now()}`,
          card: {
            header,
            sections: [{ widgets }],
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
