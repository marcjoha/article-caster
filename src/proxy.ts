import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Public routes
  if (request.nextUrl.pathname.startsWith('/feed/') || request.nextUrl.pathname.startsWith('/media/')) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === '/api/login' || request.nextUrl.pathname === '/login') {
    return NextResponse.next();
  }

  // Allow internal worker routes (Cloud Tasks / Cloud Scheduler callbacks)
  if (request.nextUrl.pathname.startsWith('/api/worker/')) {
    return NextResponse.next();
  }

  // Admin passcode logic
  const cookie = request.cookies.get('admin_session');
  const envPasscode = process.env.ADMIN_PASSCODE;

  if (!cookie || cookie.value !== envPasscode) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
