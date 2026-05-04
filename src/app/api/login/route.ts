import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { passcode } = await request.json();
  const envPasscode = process.env.ADMIN_PASSCODE;

  if (passcode === envPasscode) {
    const response = NextResponse.json({ success: true });
    response.cookies.set('admin_session', passcode, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });
    return response;
  }

  return NextResponse.json({ success: false }, { status: 401 });
}
