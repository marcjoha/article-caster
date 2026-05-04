import { NextResponse } from 'next/server';
import { deleteFeedItem } from '@/lib/firestore';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteFeedItem(id);
  return NextResponse.json({ success: true });
}
