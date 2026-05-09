import { NextResponse } from 'next/server';
import { getActiveIngestions, clearFailedIngestions, deleteIngestion } from '@/lib/firestore';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');

  if (!feedId) {
    return NextResponse.json({ error: 'feedId is required' }, { status: 400 });
  }

  try {
    const ingestions = await getActiveIngestions(feedId);
    return NextResponse.json({ ingestions });
  } catch (error: unknown) {
    console.error('Failed to fetch ingestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feedId');
  const ingestionId = searchParams.get('ingestionId');

  try {
    if (ingestionId) {
      await deleteIngestion(ingestionId);
      return NextResponse.json({ success: true });
    } else if (feedId) {
      await clearFailedIngestions(feedId);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'feedId or ingestionId is required' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Failed to clear ingestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
