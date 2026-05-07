import { NextResponse } from 'next/server';
import { updateFeed, deleteFeed } from '@/lib/firestore';
import { uploadFile } from '@/lib/storage';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const formData = await request.formData();
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const category = formData.get('category') as string | undefined;
  const author = formData.get('author') as string | undefined;
  const tts_voice = formData.get('tts_voice') as string | undefined;
  const audio_prefix_message = formData.get('audio_prefix_message') as string | undefined;
  const coverImageFile = formData.get('cover_image') as File | null;
  
  let cover_image_url = formData.get('cover_image_url') as string | undefined;
  
  if (coverImageFile) {
    const buffer = Buffer.from(await coverImageFile.arrayBuffer());
    const safeName = coverImageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    cover_image_url = await uploadFile(`covers/${Date.now()}-${safeName}`, buffer, coverImageFile.type);
  }
  
  const updates: Record<string, unknown> = {
    title,
    description,
    category,
  };
  
  if (author !== null) updates.author = author;
  if (cover_image_url !== undefined && cover_image_url !== null) updates.cover_image_url = cover_image_url;
  if (tts_voice !== null) updates.tts_voice = tts_voice;
  if (audio_prefix_message !== null) updates.audio_prefix_message = audio_prefix_message;

  await updateFeed(id, updates);
  
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteFeed(id);
  return NextResponse.json({ success: true });
}
