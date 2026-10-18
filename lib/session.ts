import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'crypto';
import prisma from './prisma';

const COOKIE_NAME = 'session';
const SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

function sign(value: string): string {
  return createHmac('sha256', SECRET).update(value).digest('hex');
}

function buildToken(userId: string): string {
  const encoded = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

function parseToken(token: string): { userId: string } | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    return typeof payload.userId === 'string' ? { userId: payload.userId } : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, buildToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return parseToken(token)?.userId ?? null;
}

export async function getCurrentUser() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
