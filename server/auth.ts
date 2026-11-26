import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || EPHEMERAL_SECRET;
}

export const SESSION_COOKIE_NAME = 'janconnect_session';

export interface SessionUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location_id: string | null;
  account_status: 'active' | 'restricted' | 'suspended';
  phone_verified: boolean;
  identity_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
  roles: Array<'citizen' | 'moderator' | 'administrator' | 'government_authority' | 'financial_admin'>;
  created_at: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

export function signSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }),
    'utf8'
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sub?: string; exp?: number };
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${7 * 24 * 60 * 60}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'Max-Age=0',
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function loadSessionUser(userId: string): SessionUser | null {
  const profile = db
    .prepare(`
      SELECT id, username, display_name, avatar_url, bio, location_id, account_status, phone_verified, identity_status, created_at
      FROM profiles WHERE id = ?
    `)
    .get(userId) as
    | {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string | null;
        location_id: string | null;
        account_status: 'active' | 'restricted' | 'suspended';
        phone_verified: number;
        identity_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
        created_at: string;
      }
    | undefined;

  if (!profile) return null;

  const roleRows = db
    .prepare(`SELECT role FROM user_roles WHERE user_id = ?`)
    .all(userId) as Array<{ role: 'citizen' | 'moderator' | 'administrator' | 'government_authority' | 'financial_admin' }>;

  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
    location_id: profile.location_id,
    account_status: profile.account_status,
    phone_verified: Boolean(profile.phone_verified),
    identity_status: profile.identity_status,
    roles: roleRows.map((r) => r.role),
    created_at: profile.created_at,
  };
}

export interface AuthedRequest extends Request {
  user?: SessionUser | null;
}

export function extractAuthUser(req: AuthedRequest, _res: Response, next: NextFunction): void {
  let token: string | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookieHeader(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
    }
  }

  if (token) {
    const userId = verifySessionToken(token);
    if (userId) {
      req.user = loadSessionUser(userId);
    }
  }
  next();
}

export function verifyCsrfForCookieMutations(req: Request, res: Response, next: NextFunction): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }
  // If relying on cookie auth for state-changing requests, verify custom header or matching origin
  const requestedWith = req.headers['x-requested-with'];
  if (requestedWith === 'JanConnect') {
    return next();
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return next();
    } catch {
      // fall through
    }
  }
  res.status(403).json({ error: 'Cross-origin request validation failed.' });
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (req.user.account_status === 'suspended') {
    res.status(403).json({ error: 'This account is suspended. Contact JanConnect Safety Support for review.' });
    return;
  }
  next();
}

export function requireModerator(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Moderator authentication required.' });
    return;
  }
  if (!req.user.roles.includes('moderator') && !req.user.roles.includes('administrator')) {
    res.status(403).json({ error: 'Forbidden: Moderator privileges verified server-side are required.' });
    return;
  }
  next();
}

export function requireAdministrator(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Administrator authentication required.' });
    return;
  }
  if (!req.user.roles.includes('administrator')) {
    res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
    return;
  }
  next();
}

export function requireGovernmentAuthority(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Government authority authentication required.' });
    return;
  }
  if (!req.user.roles.includes('government_authority')) {
    res.status(403).json({
      error:
        'Forbidden: Authorised government official privileges are required. JanConnect administrators cannot approve projects or manipulate tenders.',
    });
    return;
  }
  next();
}

export function requireFinancialAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Financial administrator authentication required.' });
    return;
  }
  if (!req.user.roles.includes('financial_admin') && !req.user.roles.includes('administrator')) {
    res.status(403).json({
      error: 'Forbidden: JanConnect financial administrator privileges are required.',
    });
    return;
  }
  next();
}

export function requireAuthorityOrAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const hasRole =
    req.user.roles.includes('government_authority') ||
    req.user.roles.includes('administrator') ||
    req.user.roles.includes('financial_admin');
  if (!hasRole) {
    res.status(403).json({
      error: 'Forbidden: Authorised government authority or administrator privileges are required to transfer payments.',
    });
    return;
  }
  next();
}

// Simple sliding-window in-memory rate limiter
const rateBuckets = new Map<string, number[]>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}
