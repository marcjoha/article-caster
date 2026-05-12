import { NextResponse } from 'next/server';
import { getListensByFeed, getFeedItems } from '@/lib/firestore';

export async function GET(request: Request, { params }: { params: Promise<{ feedId: string }> }) {
  try {
    const { feedId } = await params;
    
    // Fetch listens and items in parallel
    const [listens, items] = await Promise.all([
      getListensByFeed(feedId),
      getFeedItems(feedId),
    ]);

    // Create a map of items for easy lookup
    const itemMap = new Map(items.map(item => [item.id!, item]));

    // Aggregate stats
    const totalListens = listens.length;
    
    const listensByItem: Record<string, { title: string; count: number }> = {};
    const listensByUserAgent: Record<string, number> = {};

    for (const listen of listens) {
      // By Item
      const itemTitle = itemMap.get(listen.item_id)?.title || 'Unknown Item';
      if (!listensByItem[listen.item_id]) {
        listensByItem[listen.item_id] = { title: itemTitle, count: 0 };
      }
      listensByItem[listen.item_id].count++;

      // By User Agent (simplified)
      const rawUa = listen.user_agent.toLowerCase();
      let uaGroup = 'Other';
      if (rawUa.includes('applecoremedia') || rawUa.includes('apple podcasts')) uaGroup = 'Apple Podcasts';
      else if (rawUa.includes('spotify')) uaGroup = 'Spotify';
      else if (rawUa.includes('overcast')) uaGroup = 'Overcast';
      else if (rawUa.includes('pocketcasts') || rawUa.includes('pocket casts')) uaGroup = 'Pocket Casts';
      else if (rawUa.includes('antennapod')) uaGroup = 'AntennaPod';
      else if (rawUa.includes('castbox')) uaGroup = 'Castbox';

      listensByUserAgent[uaGroup] = (listensByUserAgent[uaGroup] || 0) + 1;
    }

    // Sort item stats by count descending
    const itemStatsArray = Object.values(listensByItem).sort((a, b) => b.count - a.count);
    
    // Sort UA stats by count descending
    const uaStatsArray = Object.entries(listensByUserAgent)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      totalListens,
      listensByItem: itemStatsArray,
      listensByUserAgent: uaStatsArray,
    });
  } catch (error) {
    console.error('Stats error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
