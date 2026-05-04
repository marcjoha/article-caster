import { NextResponse } from 'next/server';
import { getActiveIngestions } from '@/lib/firestore';

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
