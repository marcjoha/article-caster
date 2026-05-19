import { NextResponse } from 'next/server';
import { getLogEntries, deleteLogsByFeedId } from '@/lib/firestore';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');

  if (!feedId) {
    return NextResponse.json({ error: 'feedId is required' }, { status: 400 });
  }

  try {
    const entries = await getLogEntries(feedId);
    const errorCount = entries.filter(e => e.level === 'error').length;
    return NextResponse.json({ entries, errorCount });
  } catch (error) {
    console.error('Failed to fetch log entries:', error);
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');
  const details = searchParams.get('details');

  if (!feedId) {
    return NextResponse.json({ error: 'feedId is required' }, { status: 400 });
  }

  try {
    await deleteLogsByFeedId(feedId, details || undefined);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    return NextResponse.json({ error: 'Failed to clear logs' }, { status: 500 });
  }
}
