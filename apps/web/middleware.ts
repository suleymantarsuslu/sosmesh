import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { SESSION_COOKIE } from './lib/config';

const PUBLIC_OPERATOR_PATHS = ['/operator/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/operator')) {
    return NextResponse.next();
  }
  if (PUBLIC_OPERATOR_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    const loginUrl = new URL('/operator/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/operator/:path*'],
};
