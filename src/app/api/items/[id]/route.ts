import { NextResponse } from 'next/server';
import { deleteFeedItem } from '@/lib/firestore';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await deleteFeedItem(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Delete item error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
