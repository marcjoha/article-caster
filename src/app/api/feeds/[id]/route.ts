import { NextResponse } from 'next/server';
import { updateFeed, deleteFeed } from '@/lib/firestore';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  
  await updateFeed(id, {
    title: body.title,
    description: body.description,
    cover_image_url: body.cover_image_url,
  });
  
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteFeed(id);
  return NextResponse.json({ success: true });
}
