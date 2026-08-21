import { NextResponse } from 'next/server';
import { getFeeds, getPublishedFeedItems, getQueuedFeedItems, publishFeedItem, updateFeed } from '@/lib/firestore';
import { logActivity } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST() {
  return handlePublishCron();
}

export async function GET() {
  return handlePublishCron();
}

async function handlePublishCron() {
  try {
    const feeds = await getFeeds();
    const now = new Date();
    const currentUtcDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentUtcHour = now.getUTCHours();
    const todayUtcStr = now.toISOString().split('T')[0];
    const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));

    let totalPublished = 0;
    const results: Array<{ feedId: string; feedTitle: string; publishedCount: number; message: string }> = [];

    for (const feed of feeds) {
      if (!feed.id || !feed.rate_limit_enabled) {
        continue;
      }

      try {
        // Resolve active schedule days
        let activeDays: number[] = [1, 2, 3, 4, 5]; // Default weekdays
        if (feed.rate_limit_schedule === 'daily') {
          activeDays = [0, 1, 2, 3, 4, 5, 6];
        } else if (feed.rate_limit_schedule === 'custom' && Array.isArray(feed.rate_limit_days)) {
          activeDays = feed.rate_limit_days;
        } else if (Array.isArray(feed.rate_limit_days) && feed.rate_limit_days.length > 0) {
          activeDays = feed.rate_limit_days;
        }

        const scheduledHour = typeof feed.rate_limit_hour_utc === 'number' ? feed.rate_limit_hour_utc : 8;
        const maxEpisodesPerWindow = feed.rate_limit_episodes_per_window || 1;

        // Check if today is an active publishing day
        if (!activeDays.includes(currentUtcDay)) {
          results.push({ feedId: feed.id, feedTitle: feed.title, publishedCount: 0, message: `Today (${currentUtcDay}) is not an active scheduled day` });
          continue;
        }

        // Check if the scheduled hour has arrived
        if (currentUtcHour < scheduledHour) {
          results.push({ feedId: feed.id, feedTitle: feed.title, publishedCount: 0, message: `Scheduled hour (${scheduledHour}:00 UTC) not yet reached (currently ${currentUtcHour}:00 UTC)` });
          continue;
        }

        // Count how many episodes have already been published today
        const publishedItems = await getPublishedFeedItems(feed.id);
        const publishedTodayCount = publishedItems.filter(item => {
          const pubDate = item.published_at || item.created_at;
          return pubDate && pubDate.getTime() >= startOfTodayUtc.getTime();
        }).length;

        const remainingQuota = Math.max(0, maxEpisodesPerWindow - publishedTodayCount);

        if (remainingQuota <= 0) {
          results.push({ feedId: feed.id, feedTitle: feed.title, publishedCount: 0, message: `Daily quota fulfilled (${publishedTodayCount}/${maxEpisodesPerWindow} already published today)` });
          continue;
        }

        // Fetch queued items in FIFO order
        const queuedItems = await getQueuedFeedItems(feed.id);
        if (queuedItems.length === 0) {
          results.push({ feedId: feed.id, feedTitle: feed.title, publishedCount: 0, message: 'Queue is empty' });
          continue;
        }

        const itemsToPublish = queuedItems.slice(0, remainingQuota);
        let feedPublishedCount = 0;

        for (const item of itemsToPublish) {
          if (item.id) {
            await publishFeedItem(item.id, feed.id, { isManual: false });
            feedPublishedCount++;
            totalPublished++;
          }
        }

        await updateFeed(feed.id, {
          last_rate_limit_published_date: todayUtcStr,
        });

        logActivity({
          feedId: feed.id,
          level: 'info',
          category: 'episode',
          message: `Scheduled release: published ${feedPublishedCount} episode${feedPublishedCount > 1 ? 's' : ''} from queue (${queuedItems.length - feedPublishedCount} remaining)`,
          details: feed.cover_image_url || `https://article-caster/feed/${feed.unguessable_slug}`,
        });

        results.push({ feedId: feed.id, feedTitle: feed.title, publishedCount: feedPublishedCount, message: `Published ${feedPublishedCount} episodes from queue` });
      } catch (feedErr) {
        console.error(`Error executing publish schedule for feed ${feed.id}:`, feedErr);
        const errorMsg = feedErr instanceof Error ? feedErr.message : 'Unknown error';
        logActivity({
          feedId: feed.id,
          level: 'error',
          category: 'episode',
          message: `Publish schedule error: ${errorMsg}`,
          details: feed.cover_image_url || `https://article-caster/feed/${feed.unguessable_slug}`,
        });
      }
    }

    return NextResponse.json({ success: true, totalPublished, results });
  } catch (error: unknown) {
    console.error('Publish cron unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
