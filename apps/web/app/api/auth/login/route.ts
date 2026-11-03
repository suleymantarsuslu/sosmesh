import { sign } from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE, isE2eMock } from '../../../../lib/config';

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as LoginBody;
  const email = body.email?.trim() ?? '';
  const password = body.password ?? '';

  if (isE2eMock()) {
    const secret = process.env.JWT_SECRET;
    const expectedPass = process.env.OPERATOR_E2E_PASSWORD;
    if (!secret || !expectedPass) {
      return NextResponse.json({ code: 'CONFIG_ERROR' }, { status: 500 });
    }
    let payload: { sub: string; role: 'OPERATOR' | 'ADMIN' };
    if (email === 'e2e-operator@sosmesh.example' && password === expectedPass) {
      payload = { sub: 'e2e-operator', role: 'OPERATOR' };
    } else if (email === 'e2e-admin@sosmesh.example' && password === expectedPass) {
      payload = { sub: 'e2e-admin', role: 'ADMIN' };
    } else if (email === 'e2e-viewer@sosmesh.example' && password === expectedPass) {
      payload = { sub: 'e2e-viewer', role: 'OPERATOR' };
    } else {
      return NextResponse.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 });
    }
    const token = sign(payload, secret, { expiresIn: '1h', algorithm: 'HS256' });
    const response = NextResponse.json({
      user: {
        id: payload.sub,
        email,
        displayName: email.split('@')[0],
        role: payload.role,
        teamId: null,
      },
    });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
    return response;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const origin = request.headers.get('origin') ?? request.nextUrl.origin;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: origin,
  };
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    headers['X-Forwarded-For'] = xForwardedFor;
  }
  const apiRes = await fetch(`${apiUrl}/v1/auth/login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password }),
  });
  const data = await apiRes.json();
  if (!apiRes.ok) {
    return NextResponse.json(data, { status: apiRes.status });
  }
  const response = NextResponse.json({ user: data.user });
  response.cookies.set(SESSION_COOKIE, data.token as string, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
  return response;
}
