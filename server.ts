import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { db, initDatabase, writeAuditLog } from './server/db';
import {
  type AuthedRequest,
  checkRateLimit,
  clearSessionCookie,
  extractAuthUser,
  hashPassword,
  loadSessionUser,
  requireAdministrator,
  requireAuth,
  requireModerator,
  setSessionCookie,
  signSessionToken,
  verifyCsrfForCookieMutations,
  verifyPassword,
} from './server/auth';
import {
  promotePendingToPublished,
  resolveRestrictedKycPath,
  resolveSafeMediaPath,
  savePendingMedia,
} from './server/media';
import {
  completeTestVerificationSession,
  DuplicateNationalIdError,
  getUserVerificationSummary,
  isProductionVerificationConfigured,
  reviewNationalIdVerification,
  startVerificationSession,
  submitNationalIdVerification,
} from './server/verification';
import type { NationalIdType } from './src/utils/nationalId';
import { runModeratorAiAssist } from './server/ai';
import {
  canModeratorTransition,
  formatGeneralizedLocation,
  type ModerationActionType,
  MAX_ATTACHMENT_BYTES,
  type PlatformStatus,
  validateCommentContent,
  validateReportDraft,
  validateUsername,
} from './src/utils/civicRules';

initDatabase();

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(extractAuthUser);
app.use('/api', verifyCsrfForCookieMutations);

const reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 3,
  },
});

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
});

function hasSupabaseServerConfig(): boolean {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && anon && url.startsWith('https://') && !url.includes('YOUR_'));
}

// Health & runtime configuration status
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    backendMode: hasSupabaseServerConfig() ? 'supabase-configured' : 'local-sqlite-v01',
    supabaseConfigured: hasSupabaseServerConfig(),
    mapsConfigured: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_MAPBOX_ACCESS_TOKEN),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    identityProviderConfigured: isProductionVerificationConfigured(),
    ageConsentGateMode: process.env.VITE_AGE_CONSENT_GATE_MODE || 'gated',
  });
});

// Hierarchical Locations (India -> State -> District -> Block -> Locality)
app.get('/api/locations', (req, res) => {
  const { type, parent_id, state_code } = req.query;
  let sql = `SELECT id, parent_id, name, type, state_code, latitude, longitude FROM locations WHERE 1=1`;
  const params: unknown[] = [];
  if (typeof type === 'string' && type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  if (typeof parent_id === 'string' && parent_id) {
    sql += ` AND parent_id = ?`;
    params.push(parent_id);
  }
  if (typeof state_code === 'string' && state_code) {
    sql += ` AND state_code = ?`;
    params.push(state_code);
  }
  sql += ` ORDER BY name ASC`;
  const rows = db.prepare(sql).all(...params);
  res.json({ locations: rows });
});

function buildLocationPath(locationId: string): {
  locality: string | null;
  block: string | null;
  district: string | null;
  state: string | null;
  districtId: string | null;
} {
  const map = new Map<string, { id: string; parent_id: string | null; name: string; type: string }>();
  const rows = db.prepare(`SELECT id, parent_id, name, type FROM locations`).all() as Array<{
    id: string;
    parent_id: string | null;
    name: string;
    type: string;
  }>;
  for (const r of rows) map.set(r.id, r);

  let curr = map.get(locationId);
  let locality: string | null = null;
  let block: string | null = null;
  let district: string | null = null;
  let districtId: string | null = null;
  let state: string | null = null;

  while (curr) {
    if (curr.type === 'locality') locality = curr.name;
    if (curr.type === 'block') block = curr.name;
    if (curr.type === 'district') {
      district = curr.name;
      districtId = curr.id;
    }
    if (curr.type === 'state') state = curr.name;
    curr = curr.parent_id ? map.get(curr.parent_id) : undefined;
  }
  return { locality, block, district, state, districtId };
}

// =========================================================================
// AUTHENTICATION & PROFILES
// =========================================================================

app.post('/api/auth/signup', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`signup:${ip}`, 12, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many registration attempts. Please try again shortly.' });
    return;
  }

  const { email, phone, password, username, displayName, ageConsentAcknowledged } = req.body as {
    email?: string;
    phone?: string;
    password?: string;
    username?: string;
    displayName?: string;
    ageConsentAcknowledged?: boolean;
  };

  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanPhone = (phone || '').trim();
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanDisplay = (displayName || '').trim();

  if (!cleanEmail && !cleanPhone) {
    res.status(400).json({ error: 'Please provide an email address or mobile number.' });
    return;
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (cleanPhone && !/^(?:\+91)?[6-9]\d{9}$/.test(cleanPhone.replace(/[\s-]/g, ''))) {
    res.status(400).json({ error: 'Please enter a valid 10-digit Indian mobile number.' });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  const usernameErr = validateUsername(cleanUsername);
  if (usernameErr) {
    res.status(400).json({ error: usernameErr });
    return;
  }
  if (cleanDisplay.length < 2 || cleanDisplay.length > 60) {
    res.status(400).json({ error: 'Display name must be between 2 and 60 characters.' });
    return;
  }
  if (!ageConsentAcknowledged) {
    res.status(400).json({
      error: 'Please acknowledge the age, guardian-guidance, and safety terms notice before registering.',
    });
    return;
  }

  const normalizedPhone = cleanPhone
    ? cleanPhone.replace(/[\s-]/g, '').startsWith('+91')
      ? cleanPhone.replace(/[\s-]/g, '')
      : `+91${cleanPhone.replace(/[\s-]/g, '')}`
    : null;

  const existingUsername = db.prepare(`SELECT id FROM profiles WHERE username = ?`).get(cleanUsername);
  if (existingUsername) {
    res.status(409).json({ error: 'That username is already taken.' });
    return;
  }
  if (cleanEmail) {
    const existingEmail = db.prepare(`SELECT id FROM auth_accounts WHERE email = ?`).get(cleanEmail);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
  }
  if (normalizedPhone) {
    const existingPhone = db.prepare(`SELECT id FROM auth_accounts WHERE phone_e164 = ?`).get(normalizedPhone);
    if (existingPhone) {
      res.status(409).json({ error: 'An account with this mobile number already exists.' });
      return;
    }
  }

  const userId = crypto.randomUUID();
  const pwHash = hashPassword(password);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO auth_accounts (id, email, phone_e164, password_hash) VALUES (?, ?, ?, ?)`).run(
      userId,
      cleanEmail || null,
      normalizedPhone,
      pwHash
    );
    db.prepare(`
      INSERT INTO profiles (id, username, display_name, account_status, phone_verified, identity_status, age_consent_acknowledged)
      VALUES (?, ?, ?, 'active', 0, 'unverified', 1)
    `).run(userId, cleanUsername, cleanDisplay);
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'citizen')`).run(crypto.randomUUID(), userId);
  });
  tx();

  writeAuditLog({ actorId: userId, action: 'citizen_registered', targetType: 'profile', targetId: userId });

  const token = signSessionToken(userId);
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user: loadSessionUser(userId) });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many sign-in attempts. Please wait a few minutes.' });
    return;
  }

  const { identifier, password } = req.body as { identifier?: string; password?: string };
  const cleanId = (identifier || '').trim().toLowerCase();
  if (!cleanId || !password) {
    res.status(400).json({ error: 'Email/mobile/username and password are required.' });
    return;
  }

  const normalizedPhone = /^[6-9]\d{9}$/.test(cleanId.replace(/[\s-]/g, ''))
    ? `+91${cleanId.replace(/[\s-]/g, '')}`
    : cleanId;

  const account = db
    .prepare(`
      SELECT a.id, a.password_hash
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR a.phone_e164 = ? OR p.username = ?
      LIMIT 1
    `)
    .get(cleanId, normalizedPhone, cleanId) as { id: string; password_hash: string } | undefined;

  if (!account || !verifyPassword(password, account.password_hash)) {
    res.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const user = loadSessionUser(account.id);
  if (!user) {
    res.status(401).json({ error: 'Account not found.' });
    return;
  }
  if (user.account_status === 'suspended') {
    res.status(403).json({ error: 'Account suspended. Please review Safety Centre guidance.' });
    return;
  }

  const token = signSessionToken(user.id);
  setSessionCookie(req, res, token);
  res.json({ token, user });
});

app.post('/api/auth/logout', (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req: AuthedRequest, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});

function findAccountByIdentifier(rawIdentifier: string): { id: string; account_status: string } | undefined {
  const cleanId = rawIdentifier.trim().toLowerCase();
  if (!cleanId) return undefined;
  const digits = cleanId.replace(/[\s-]/g, '');
  const normalizedPhone = /^(?:\+91)?[6-9]\d{9}$/.test(digits)
    ? digits.startsWith('+91')
      ? digits
      : `+91${digits}`
    : cleanId;

  return db
    .prepare(`
      SELECT a.id, p.account_status
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR a.phone_e164 = ? OR p.username = ?
      LIMIT 1
    `)
    .get(cleanId, normalizedPhone, cleanId) as { id: string; account_status: string } | undefined;
}

app.post('/api/auth/reset-password', (req, res) => {
  const ipKey = req.ip || 'unknown';
  if (!checkRateLimit(`pw-reset-req:${ipKey}`, 5, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many password reset requests. Please wait 15 minutes and try again.' });
    return;
  }

  const { identifier } = req.body as { identifier?: string };
  if (!identifier || identifier.trim().length < 3) {
    res.status(400).json({ error: 'Please enter your registered email, mobile number, or username.' });
    return;
  }

  const account = findAccountByIdentifier(identifier);
  let previewResetCode: string | undefined;

  if (account && account.account_status !== 'suspended') {
    const code = String(crypto.randomInt(100000, 999999));
    const codeHash = hashPassword(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const tx = db.transaction(() => {
      db.prepare(`UPDATE password_reset_challenges SET consumed = 1 WHERE user_id = ? AND consumed = 0`).run(account.id);
      db.prepare(`
        INSERT INTO password_reset_challenges (id, user_id, code_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(crypto.randomUUID(), account.id, codeHash, expiresAt);
      writeAuditLog({ actorId: account.id, action: 'password_reset_requested', targetType: 'profile', targetId: account.id });
    });
    tx();

    const isDevPreview = process.env.NODE_ENV !== 'production' && !hasSupabaseServerConfig();
    if (isDevPreview) {
      previewResetCode = code;
    }
  }

  res.json({
    ok: true,
    message:
      'If an active account matches that email, mobile number, or username, a 6-digit password reset code is ready for the next step.',
    previewResetCode,
  });
});

app.post('/api/auth/reset-password/confirm', (req, res) => {
  const ipKey = req.ip || 'unknown';
  if (!checkRateLimit(`pw-reset-confirm:${ipKey}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many reset confirmation attempts. Please wait and request a new code.' });
    return;
  }

  const { identifier, code, newPassword } = req.body as {
    identifier?: string;
    code?: string;
    newPassword?: string;
  };

  if (!identifier || !code || !newPassword) {
    res.status(400).json({ error: 'Account identifier, 6-digit reset code, and new password are required.' });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
    return;
  }

  const account = findAccountByIdentifier(identifier);
  if (!account) {
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }
  if (account.account_status === 'suspended') {
    res.status(403).json({ error: 'This account is suspended. Contact safety support.' });
    return;
  }

  const challenge = db
    .prepare(`
      SELECT id, code_hash, attempts, expires_at
      FROM password_reset_challenges
      WHERE user_id = ? AND consumed = 0
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(account.id) as { id: string; code_hash: string; attempts: number; expires_at: string } | undefined;

  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Reset code expired or not found. Please request a new code.' });
    return;
  }
  if (challenge.attempts >= 5) {
    res.status(429).json({ error: 'Maximum reset code attempts exceeded. Please request a new reset code.' });
    return;
  }

  if (!verifyPassword(code.trim(), challenge.code_hash)) {
    db.prepare(`UPDATE password_reset_challenges SET attempts = attempts + 1 WHERE id = ?`).run(challenge.id);
    res.status(400).json({ error: 'Invalid or expired reset code.' });
    return;
  }

  const nextHash = hashPassword(newPassword);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE password_reset_challenges SET consumed = 1 WHERE id = ?`).run(challenge.id);
    db.prepare(`UPDATE auth_accounts SET password_hash = ? WHERE id = ?`).run(nextHash, account.id);
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, message)
      VALUES (?, ?, 'security_notice', 'Your JanConnect account password was recently reset.')
    `).run(crypto.randomUUID(), account.id);
    writeAuditLog({ actorId: account.id, action: 'password_reset_completed', targetType: 'profile', targetId: account.id });
  });
  tx();

  res.json({ ok: true, message: 'Password updated successfully. You can now sign in with your new password.' });
});

app.post('/api/auth/change-password', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required.' });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: 'New password must be between 8 and 128 characters.' });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: 'New password must be different from your current password.' });
    return;
  }

  const account = db
    .prepare(`SELECT password_hash FROM auth_accounts WHERE id = ?`)
    .get(userId) as { password_hash: string } | undefined;

  if (!account || !verifyPassword(currentPassword, account.password_hash)) {
    res.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  db.prepare(`UPDATE auth_accounts SET password_hash = ? WHERE id = ?`).run(hashPassword(newPassword), userId);
  writeAuditLog({ actorId: userId, action: 'password_changed', targetType: 'profile', targetId: userId });

  res.json({ ok: true, message: 'Password changed successfully.' });
});

// Phone OTP verification (verifies phone control ONLY — never proof of identity or age)
app.post('/api/auth/verify-phone/request', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`otp-req:${userId}`, 5, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'OTP rate limit reached. Please wait before requesting another code.' });
    return;
  }
  const { phone } = req.body as { phone?: string };
  const cleaned = (phone || '').replace(/[\s-]/g, '');
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleaned)) {
    res.status(400).json({ error: 'Enter a valid 10-digit Indian mobile number.' });
    return;
  }
  const e164 = cleaned.startsWith('+91') ? cleaned : `+91${cleaned}`;
  const code = String(crypto.randomInt(100000, 999999));
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(`INSERT INTO otp_challenges (id, user_id, phone_e164, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    userId,
    e164,
    codeHash,
    expiresAt
  );

  writeAuditLog({ actorId: userId, action: 'phone_otp_requested', targetType: 'profile', targetId: userId });

  const isDevPreview = process.env.NODE_ENV !== 'production' && !hasSupabaseServerConfig();
  res.json({
    ok: true,
    note: 'Phone OTP verifies control of your phone number only; it is not proof of identity or age.',
    previewOtp: isDevPreview ? code : undefined,
    smsConfigured: hasSupabaseServerConfig(),
  });
});

app.post('/api/auth/verify-phone/confirm', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`otp-confirm:${userId}`, 10, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many OTP verification attempts.' });
    return;
  }
  const { code } = req.body as { code?: string };
  if (!code || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ error: 'Enter the 6-digit verification code.' });
    return;
  }

  const challenge = db
    .prepare(`
      SELECT id, phone_e164, code_hash, attempts, expires_at
      FROM otp_challenges
      WHERE user_id = ? AND consumed = 0
      ORDER BY created_at DESC LIMIT 1
    `)
    .get(userId) as
    | { id: string; phone_e164: string; code_hash: string; attempts: number; expires_at: string }
    | undefined;

  if (!challenge) {
    res.status(400).json({ error: 'No active OTP challenge found. Request a new code.' });
    return;
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'OTP expired. Request a new code.' });
    return;
  }
  if (challenge.attempts >= 5) {
    res.status(429).json({ error: 'Maximum OTP attempts exceeded for this code.' });
    return;
  }

  if (!verifyPassword(code.trim(), challenge.code_hash)) {
    db.prepare(`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?`).run(challenge.id);
    res.status(400).json({ error: 'Incorrect OTP code.' });
    return;
  }

  db.prepare(`UPDATE otp_challenges SET consumed = 1 WHERE id = ?`).run(challenge.id);
  db.prepare(`UPDATE auth_accounts SET phone_e164 = ? WHERE id = ?`).run(challenge.phone_e164, userId);
  db.prepare(`UPDATE profiles SET phone_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(userId);
  writeAuditLog({ actorId: userId, action: 'phone_control_verified', targetType: 'profile', targetId: userId });

  res.json({ ok: true, user: loadSessionUser(userId) });
});

// Identity & National ID Verification Endpoints
app.get('/api/verification/status', requireAuth, (req: AuthedRequest, res) => {
  const verification = getUserVerificationSummary(req.user!.id);
  res.json({ verification, user: loadSessionUser(req.user!.id) });
});

app.post('/api/verification/national-id', requireAuth, kycUpload.single('idDocument'), (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`national-id:${userId}`, 5, 60 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many National ID verification attempts. Please wait before trying again.' });
    return;
  }

  const { idType, legalName, idNumber } = req.body as {
    idType?: string;
    legalName?: string;
    idNumber?: string;
  };

  if (!idType || !legalName || !idNumber) {
    res.status(400).json({ error: 'National ID type, legal name, and ID number are required.' });
    return;
  }

  try {
    const verification = submitNationalIdVerification({
      userId,
      idType: idType as NationalIdType,
      legalName,
      idNumber,
      documentBuffer: req.file?.buffer ?? null,
    });
    res.status(201).json({ ok: true, verification, user: loadSessionUser(userId) });
  } catch (err) {
    if (err instanceof DuplicateNationalIdError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/verification/session', requireAuth, (req: AuthedRequest, res) => {
  try {
    const result = startVerificationSession(req.user!.id);
    res.json({ session: result, user: loadSessionUser(req.user!.id) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/verification/complete-test', requireAuth, (req: AuthedRequest, res) => {
  const { sessionToken } = (req.body || {}) as { sessionToken?: string };
  try {
    completeTestVerificationSession(req.user!.id, sessionToken);
    res.json({ ok: true, verification: getUserVerificationSummary(req.user!.id), user: loadSessionUser(req.user!.id) });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

// Profile Update & Minimal Public Profile
app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  const { displayName, bio, locationId, avatarUrl } = req.body as {
    displayName?: string;
    bio?: string;
    locationId?: string;
    avatarUrl?: string | null;
  };

  if (displayName !== undefined && (displayName.trim().length < 2 || displayName.trim().length > 60)) {
    res.status(400).json({ error: 'Display name must be between 2 and 60 characters.' });
    return;
  }
  if (bio !== undefined && bio.trim().length > 240) {
    res.status(400).json({ error: 'Bio must be 240 characters or fewer.' });
    return;
  }
  if (locationId) {
    const loc = db.prepare(`SELECT id FROM locations WHERE id = ?`).get(locationId);
    if (!loc) {
      res.status(400).json({ error: 'Selected location does not exist.' });
      return;
    }
  }
  if (avatarUrl && !avatarUrl.startsWith('https://') && !avatarUrl.startsWith('/src/assets/')) {
    res.status(400).json({ error: 'Invalid avatar URL.' });
    return;
  }

  db.prepare(`
    UPDATE profiles
    SET
      display_name = COALESCE(?, display_name),
      bio = COALESCE(?, bio),
      location_id = COALESCE(?, location_id),
      avatar_url = COALESCE(?, avatar_url),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    displayName !== undefined ? displayName.trim() : null,
    bio !== undefined ? bio.trim() : null,
    locationId ?? null,
    avatarUrl ?? null,
    userId
  );

  res.json({ user: loadSessionUser(userId) });
});

app.get('/api/profiles/:username', (req, res) => {
  const username = req.params.username.toLowerCase();
  const profile = db
    .prepare(`
      SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.location_id, p.identity_status, p.created_at
      FROM profiles p
      WHERE p.username = ? AND p.account_status = 'active'
    `)
    .get(username) as
    | {
        id: string;
        username: string;
        display_name: string;
        avatar_url: string | null;
        bio: string | null;
        location_id: string | null;
        identity_status: string;
        created_at: string;
      }
    | undefined;

  if (!profile) {
    res.status(404).json({ error: 'Citizen profile not found.' });
    return;
  }

  const locParts = profile.location_id ? buildLocationPath(profile.location_id) : null;
  const generalArea = locParts
    ? formatGeneralizedLocation({
        locality: locParts.locality,
        block: locParts.block,
        district: locParts.district,
        state: locParts.state,
      })
    : null;

  const publishedReports = db
    .prepare(`
      SELECT id, title, category, generalized_location, platform_status, published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = complaints.id) AS support_count
      FROM complaints
      WHERE user_id = ? AND platform_status = 'published' AND visibility = 'public'
      ORDER BY published_at DESC
    `)
    .all(profile.id);

  // Strictly minimal public profile: NEVER phone, email, DOB, or exact location
  res.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      general_area: generalArea,
      created_at: profile.created_at,
    },
    publishedReports,
  });
});

// =========================================================================
// PUBLIC REPORTS, DISCOVERY, SUPPORT & COMMENTS
// =========================================================================

app.get('/api/reports/public', (req: AuthedRequest, res) => {
  const { q, category, state_id, district_id, block_id, locality_id, sort, page, limit } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(30, Math.max(1, Number(limit) || 12));
  const offset = (pageNum - 1) * pageSize;

  let where = `WHERE c.platform_status = 'published' AND c.visibility = 'public'`;
  const params: unknown[] = [];

  if (typeof q === 'string' && q.trim()) {
    const term = `%${q.trim()}%`;
    where += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.generalized_location LIKE ?)`;
    params.push(term, term, term);
  }
  if (typeof category === 'string' && category && category !== 'all') {
    where += ` AND c.category = ?`;
    params.push(category);
  }

  // Hierarchical location filter
  const targetLocId =
    (typeof locality_id === 'string' && locality_id) ||
    (typeof block_id === 'string' && block_id) ||
    (typeof district_id === 'string' && district_id) ||
    (typeof state_id === 'string' && state_id) ||
    '';

  if (targetLocId) {
    where += ` AND c.location_id IN (
      WITH RECURSIVE tree(id) AS (
        SELECT id FROM locations WHERE id = ?
        UNION ALL
        SELECT l.id FROM locations l JOIN tree t ON l.parent_id = t.id
      )
      SELECT id FROM tree
    )`;
    params.push(targetLocId);
  }

  const orderBy =
    sort === 'most_supported'
      ? `ORDER BY support_count DESC, c.published_at DESC`
      : `ORDER BY c.published_at DESC, c.created_at DESC`;

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS count FROM complaints c ${where}`)
    .get(...params) as { count: number };

  const rows = db
    .prepare(`
      SELECT
        c.id,
        c.title,
        c.description,
        c.category,
        c.location_id,
        c.generalized_location,
        c.platform_status,
        c.created_at,
        c.published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = c.id) AS support_count,
        (SELECT COUNT(*) FROM complaint_comments cm WHERE cm.complaint_id = c.id AND cm.moderation_status = 'approved') AS comment_count,
        (SELECT m.id FROM complaint_media m WHERE m.complaint_id = c.id AND m.review_status = 'approved' LIMIT 1) AS preview_media_id,
        (SELECT m.media_type FROM complaint_media m WHERE m.complaint_id = c.id AND m.review_status = 'approved' LIMIT 1) AS preview_media_type
      FROM complaints c
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `)
    .all(...params, pageSize, offset) as Array<Record<string, unknown>>;

  const enriched = rows.map((r) => {
    const locPath = buildLocationPath(r.location_id as string);
    return {
      ...r,
      district_id: locPath.districtId,
      district_name: locPath.district,
      preview_media_url: r.preview_media_id ? `/api/media/published/${r.preview_media_id}` : null,
      user_has_supported: req.user
        ? Boolean(
            db
              .prepare(`SELECT 1 FROM complaint_support WHERE complaint_id = ? AND user_id = ?`)
              .get(r.id, req.user.id)
          )
        : false,
    };
  });

  res.json({
    reports: enriched,
    total: totalRow.count,
    page: pageNum,
    pageSize,
  });
});

app.get('/api/reports/public/:id', (req: AuthedRequest, res) => {
  const report = db
    .prepare(`
      SELECT
        c.id,
        c.title,
        c.description,
        c.category,
        c.location_id,
        c.generalized_location,
        c.urgency_note,
        c.platform_status,
        c.created_at,
        c.published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = c.id) AS support_count
      FROM complaints c
      WHERE c.id = ? AND c.platform_status = 'published' AND c.visibility = 'public'
    `)
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!report) {
    res.status(404).json({ error: 'Published report not found or awaiting moderation.' });
    return;
  }

  const media = db
    .prepare(`SELECT id, media_type FROM complaint_media WHERE complaint_id = ? AND review_status = 'approved'`)
    .all(req.params.id) as Array<{ id: string; media_type: string }>;

  const comments = db
    .prepare(`
      SELECT
        cm.id,
        cm.content,
        cm.created_at,
        p.username AS author_username,
        p.display_name AS author_display_name
      FROM complaint_comments cm
      JOIN profiles p ON p.id = cm.user_id
      WHERE cm.complaint_id = ? AND cm.moderation_status = 'approved'
      ORDER BY cm.created_at ASC
    `)
    .all(req.params.id);

  const history = db
    .prepare(`
      SELECT id, previous_status, new_status, reason, created_at
      FROM complaint_status_history
      WHERE complaint_id = ? AND new_status IN ('submitted', 'under_review', 'published')
      ORDER BY created_at ASC
    `)
    .all(req.params.id);

  const userHasSupported = req.user
    ? Boolean(
        db
          .prepare(`SELECT 1 FROM complaint_support WHERE complaint_id = ? AND user_id = ?`)
          .get(req.params.id, req.user.id)
      )
    : false;

  res.json({
    report: {
      ...report,
      user_has_supported: userHasSupported,
      media: media.map((m) => ({
        id: m.id,
        media_type: m.media_type,
        url: `/api/media/published/${m.id}`,
      })),
    },
    comments,
    history,
  });
});

// Support toggle (unique 1 per user per report)
app.post('/api/reports/:id/support', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`support:${userId}`, 30, 60 * 1000)) {
    res.status(429).json({ error: 'Rate limit reached for support actions.' });
    return;
  }
  const report = db
    .prepare(`SELECT id FROM complaints WHERE id = ? AND platform_status = 'published' AND visibility = 'public'`)
    .get(req.params.id);
  if (!report) {
    res.status(404).json({ error: 'Published report not found.' });
    return;
  }

  try {
    db.prepare(`INSERT INTO complaint_support (id, complaint_id, user_id) VALUES (?, ?, ?)`).run(
      crypto.randomUUID(),
      req.params.id,
      userId
    );
  } catch {
    // Already supported (UNIQUE constraint)
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) AS count FROM complaint_support WHERE complaint_id = ?`)
    .get(req.params.id) as { count: number };

  res.json({ supported: true, support_count: countRow.count });
});

app.delete('/api/reports/:id/support', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  db.prepare(`DELETE FROM complaint_support WHERE complaint_id = ? AND user_id = ?`).run(req.params.id, userId);
  const countRow = db
    .prepare(`SELECT COUNT(*) AS count FROM complaint_support WHERE complaint_id = ?`)
    .get(req.params.id) as { count: number };
  res.json({ supported: false, support_count: countRow.count });
});

// Comments on published reports
app.post('/api/reports/:id/comments', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`comment:${userId}`, 10, 10 * 60 * 1000)) {
    res.status(429).json({ error: 'Comment rate limit reached. Please wait a few minutes.' });
    return;
  }

  const report = db
    .prepare(`SELECT id, user_id, title FROM complaints WHERE id = ? AND platform_status = 'published' AND visibility = 'public'`)
    .get(req.params.id) as { id: string; user_id: string; title: string } | undefined;

  if (!report) {
    res.status(404).json({ error: 'Published report not found.' });
    return;
  }

  const { content } = req.body as { content?: string };
  const validation = validateCommentContent(content || '');
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }

  const commentId = crypto.randomUUID();
  db.prepare(`INSERT INTO complaint_comments (id, complaint_id, user_id, content) VALUES (?, ?, ?, ?)`).run(
    commentId,
    report.id,
    userId,
    content!.trim()
  );

  if (report.user_id !== userId) {
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'new_comment', ?, ?)
    `).run(
      crypto.randomUUID(),
      report.user_id,
      report.id,
      `A community member commented on your published report "${report.title}".`
    );
  }

  res.status(201).json({
    comment: {
      id: commentId,
      content: content!.trim(),
      created_at: new Date().toISOString(),
      author_username: req.user!.username,
      author_display_name: req.user!.display_name,
    },
  });
});

// Content / Safety Reporting
app.post('/api/content-reports', requireAuth, (req: AuthedRequest, res) => {
  const userId = req.user!.id;
  if (!checkRateLimit(`flag:${userId}`, 10, 30 * 60 * 1000)) {
    res.status(429).json({ error: 'Report flag limit reached.' });
    return;
  }
  const { targetType, targetId, reason } = req.body as {
    targetType?: 'complaint' | 'comment' | 'user';
    targetId?: string;
    reason?: string;
  };
  if (!targetType || !['complaint', 'comment', 'user'].includes(targetType) || !targetId) {
    res.status(400).json({ error: 'Valid target type and ID are required.' });
    return;
  }
  if (!reason || reason.trim().length < 5 || reason.trim().length > 600) {
    res.status(400).json({ error: 'Reason must be between 5 and 600 characters.' });
    return;
  }

  const flagId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_id, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(flagId, userId, targetType, targetId, reason.trim());

  writeAuditLog({
    actorId: userId,
    action: 'content_flagged',
    targetType,
    targetId,
    metadata: { flagId },
  });

  res.status(201).json({ ok: true, id: flagId });
});

// =========================================================================
// CITIZEN REPORT SUBMISSION & MY REPORTS
// =========================================================================

app.post('/api/reports', requireAuth, reportUpload.array('attachments', 3), (req: AuthedRequest, res) => {
  const user = req.user!;
  if (!checkRateLimit(`submit:${user.id}`, 6, 60 * 60 * 1000)) {
    res.status(429).json({ error: 'Report submission rate limit reached. Please try again later.' });
    return;
  }

  // Enforce identity verification check when required (test-environment adapter available at /verify-identity)
  if (user.identity_status !== 'verified') {
    res.status(403).json({
      error: 'Please complete the citizen verification step before submitting a report.',
      code: 'IDENTITY_VERIFICATION_REQUIRED',
    });
    return;
  }

  const body = req.body as {
    title?: string;
    description?: string;
    category?: string;
    stateId?: string;
    districtId?: string;
    blockId?: string;
    localityId?: string;
    approximateLat?: string;
    approximateLng?: string;
    urgencyNote?: string;
  };

  const lat = body.approximateLat ? Number(body.approximateLat) : null;
  const lng = body.approximateLng ? Number(body.approximateLng) : null;

  const validation = validateReportDraft({
    title: body.title || '',
    description: body.description || '',
    category: body.category || '',
    stateId: body.stateId || '',
    districtId: body.districtId || '',
    blockId: body.blockId || '',
    localityId: body.localityId || '',
    approximateLat: Number.isFinite(lat) ? lat : null,
    approximateLng: Number.isFinite(lng) ? lng : null,
  });

  if (!validation.valid) {
    res.status(400).json({ error: 'Please fix the highlighted form errors.', errors: validation.errors });
    return;
  }

  const locCheck = db.prepare(`SELECT id FROM locations WHERE id = ?`).get(body.localityId);
  if (!locCheck) {
    res.status(400).json({ error: 'Selected locality was not found.' });
    return;
  }

  const locParts = buildLocationPath(body.localityId!);
  const generalizedLocation = formatGeneralizedLocation({
    locality: locParts.locality,
    block: locParts.block,
    district: locParts.district,
    state: locParts.state,
  });

  const files = (req.files as Express.Multer.File[] | undefined) || [];
  const savedMedia: Array<{ storagePath: string; mediaType: string }> = [];
  try {
    for (const file of files) {
      savedMedia.push(savePendingMedia(file.buffer));
    }
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  const reportId = crypto.randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO complaints (
        id, user_id, title, description, category, location_id, generalized_location,
        restricted_latitude, restricted_longitude, urgency_note, platform_status, visibility
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', 'private')
    `).run(
      reportId,
      user.id,
      body.title!.trim(),
      body.description!.trim(),
      body.category!,
      body.localityId!,
      generalizedLocation,
      Number.isFinite(lat) ? lat : null,
      Number.isFinite(lng) ? lng : null,
      body.urgencyNote?.trim() || null
    );

    for (const m of savedMedia) {
      db.prepare(`
        INSERT INTO complaint_media (id, complaint_id, uploader_id, storage_path, media_type, review_status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(crypto.randomUUID(), reportId, user.id, m.storagePath, m.mediaType);
    }

    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, previous_status, new_status, actor_id, reason)
      VALUES (?, ?, NULL, 'submitted', ?, 'Submitted by citizen into private moderation queue')
    `).run(crypto.randomUUID(), reportId, user.id);
  });
  tx();

  writeAuditLog({
    actorId: user.id,
    action: 'report_submitted',
    targetType: 'complaint',
    targetId: reportId,
    metadata: { category: body.category },
  });

  res.status(201).json({
    id: reportId,
    platform_status: 'submitted',
    visibility: 'private',
    generalized_location: generalizedLocation,
  });
});

app.get('/api/reports/my', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`
      SELECT
        c.id, c.title, c.description, c.category, c.generalized_location,
        c.platform_status, c.visibility, c.created_at, c.updated_at, c.published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = c.id) AS support_count
      FROM complaints c
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `)
    .all(req.user!.id);

  res.json({ reports: rows });
});

app.get('/api/reports/my/:id', requireAuth, (req: AuthedRequest, res) => {
  const report = db
    .prepare(`
      SELECT
        id, user_id, title, description, category, location_id, generalized_location,
        urgency_note, platform_status, visibility, created_at, updated_at, published_at
      FROM complaints
      WHERE id = ? AND user_id = ?
    `)
    .get(req.params.id, req.user!.id);

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const media = db
    .prepare(`SELECT id, media_type, review_status FROM complaint_media WHERE complaint_id = ?`)
    .all(req.params.id) as Array<{ id: string; media_type: string; review_status: string }>;

  const history = db
    .prepare(`
      SELECT id, previous_status, new_status, reason, created_at
      FROM complaint_status_history
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `)
    .all(req.params.id);

  res.json({
    report,
    media: media.map((m) => ({
      ...m,
      url: m.review_status === 'approved' ? `/api/media/published/${m.id}` : `/api/media/pending/${m.id}`,
    })),
    history,
  });
});

// =========================================================================
// MEDIA ACCESS CONTROL
// =========================================================================

app.get('/api/media/published/:id', (req, res) => {
  const row = db
    .prepare(`
      SELECT m.storage_path, m.media_type
      FROM complaint_media m
      JOIN complaints c ON c.id = m.complaint_id
      WHERE m.id = ? AND m.review_status = 'approved' AND c.platform_status = 'published' AND c.visibility = 'public'
    `)
    .get(req.params.id) as { storage_path: string; media_type: string } | undefined;

  if (!row) {
    res.status(404).send('Not found');
    return;
  }
  const filePath = resolveSafeMediaPath('published', row.storage_path);
  if (!filePath) {
    res.status(404).send('Not found');
    return;
  }
  res.setHeader('Content-Type', row.media_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

app.get('/api/media/pending/:id', requireAuth, (req: AuthedRequest, res) => {
  const row = db
    .prepare(`SELECT storage_path, media_type, uploader_id FROM complaint_media WHERE id = ?`)
    .get(req.params.id) as { storage_path: string; media_type: string; uploader_id: string } | undefined;

  if (!row) {
    res.status(404).send('Not found');
    return;
  }

  const isMod = req.user!.roles.includes('moderator') || req.user!.roles.includes('administrator');
  if (row.uploader_id !== req.user!.id && !isMod) {
    res.status(403).send('Forbidden');
    return;
  }

  const filePath = resolveSafeMediaPath('pending', row.storage_path);
  if (!filePath) {
    res.status(404).send('Not found');
    return;
  }
  res.setHeader('Content-Type', row.media_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(filePath);
});

// =========================================================================
// NOTIFICATIONS
// =========================================================================

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  const rows = db
    .prepare(`
      SELECT id, type, related_id, message, is_read, created_at
      FROM notifications
      WHERE recipient_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `)
    .all(req.user!.id);

  res.json({ notifications: rows });
});

app.patch('/api/notifications/:id/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?`).run(
    req.params.id,
    req.user!.id
  );
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ?`).run(req.user!.id);
  res.json({ ok: true });
});

// =========================================================================
// MODERATOR & ADMINISTRATOR CONSOLE (SERVER-SIDE AUTHORIZED)
// =========================================================================

app.get('/api/admin/bootstrap-status', (_req, res) => {
  const modExists = db
    .prepare(`SELECT COUNT(*) AS count FROM user_roles WHERE role IN ('moderator', 'administrator')`)
    .get() as { count: number };
  const passcodeConfigured = Boolean(process.env.MODERATOR_PASSCODE && process.env.MODERATOR_PASSCODE.trim());
  res.json({
    needsSetup: modExists.count === 0 && !passcodeConfigured,
    passcodeConfigured,
  });
});

app.post('/api/admin/claim', (req, res) => {
  const modExists = db
    .prepare(`SELECT COUNT(*) AS count FROM user_roles WHERE role IN ('moderator', 'administrator')`)
    .get() as { count: number };
  const passcodeConfigured = Boolean(process.env.MODERATOR_PASSCODE && process.env.MODERATOR_PASSCODE.trim());

  if (modExists.count > 0 || passcodeConfigured) {
    res.status(409).json({ error: 'Initial moderator setup has already been completed or is managed by MODERATOR_PASSCODE.' });
    return;
  }

  const { email, username, displayName, password } = req.body as {
    email?: string;
    username?: string;
    displayName?: string;
    password?: string;
  };
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUsername = (username || '').trim().toLowerCase();
  const cleanDisplay = (displayName || '').trim();

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: 'Valid email is required.' });
    return;
  }
  const userErr = validateUsername(cleanUsername);
  if (userErr) {
    res.status(400).json({ error: userErr });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const userId = crypto.randomUUID();
  const pwHash = hashPassword(password);

  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO auth_accounts (id, email, password_hash) VALUES (?, ?, ?)`).run(userId, cleanEmail, pwHash);
    db.prepare(`
      INSERT INTO profiles (id, username, display_name, account_status, phone_verified, identity_status, age_consent_acknowledged)
      VALUES (?, ?, ?, 'active', 0, 'verified', 1)
    `).run(userId, cleanUsername, cleanDisplay || 'Lead Moderator');
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'administrator')`).run(crypto.randomUUID(), userId);
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'moderator')`).run(crypto.randomUUID(), userId);
  });
  tx();

  writeAuditLog({ actorId: userId, action: 'initial_moderator_claimed', targetType: 'profile', targetId: userId });

  const token = signSessionToken(userId);
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user: loadSessionUser(userId) });
});

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`admin-login:${ip}`, 15, 15 * 60 * 1000)) {
    res.status(429).json({ error: 'Too many moderator login attempts.' });
    return;
  }

  const { identifier, password, passcode } = req.body as {
    identifier?: string;
    password?: string;
    passcode?: string;
  };

  const envPasscode = process.env.MODERATOR_PASSCODE?.trim();
  if (envPasscode) {
    if (!passcode || passcode !== envPasscode) {
      res.status(401).json({ error: 'Invalid moderator passcode.' });
      return;
    }
    // Ensure a dedicated operator moderator profile exists for configured passcode login
    const opEmail = 'operator@janconnect.local';
    let opAccount = db.prepare(`SELECT id FROM auth_accounts WHERE email = ?`).get(opEmail) as { id: string } | undefined;
    if (!opAccount) {
      const uid = crypto.randomUUID();
      db.prepare(`INSERT INTO auth_accounts (id, email, password_hash) VALUES (?, ?, ?)`).run(
        uid,
        opEmail,
        hashPassword(crypto.randomBytes(24).toString('hex'))
      );
      db.prepare(`
        INSERT INTO profiles (id, username, display_name, account_status, identity_status, age_consent_acknowledged)
        VALUES (?, 'janconnect_mod', 'JanConnect Moderator', 'active', 'verified', 1)
      `).run(uid);
      db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'administrator')`).run(crypto.randomUUID(), uid);
      db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'moderator')`).run(crypto.randomUUID(), uid);
      opAccount = { id: uid };
    }
    const token = signSessionToken(opAccount.id);
    setSessionCookie(req, res, token);
    res.json({ token, user: loadSessionUser(opAccount.id) });
    return;
  }

  const cleanId = (identifier || '').trim().toLowerCase();
  if (!cleanId || !password) {
    res.status(400).json({ error: 'Moderator email/username and password are required.' });
    return;
  }

  const account = db
    .prepare(`
      SELECT a.id, a.password_hash
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR p.username = ?
      LIMIT 1
    `)
    .get(cleanId, cleanId) as { id: string; password_hash: string } | undefined;

  if (!account || !verifyPassword(password, account.password_hash)) {
    res.status(401).json({ error: 'Invalid moderator credentials.' });
    return;
  }

  const user = loadSessionUser(account.id);
  if (!user || (!user.roles.includes('moderator') && !user.roles.includes('administrator'))) {
    res.status(403).json({ error: 'This account does not have moderator authorization.' });
    return;
  }

  const token = signSessionToken(user.id);
  setSessionCookie(req, res, token);
  res.json({ token, user });
});

app.get('/api/admin/analytics', requireModerator, (_req, res) => {
  const counts = db
    .prepare(`
      SELECT
        COUNT(*) AS total_submitted,
        SUM(CASE WHEN platform_status IN ('submitted', 'under_review', 'additional_information_required') THEN 1 ELSE 0 END) AS pending_moderation,
        SUM(CASE WHEN platform_status = 'published' THEN 1 ELSE 0 END) AS published_reports,
        SUM(CASE WHEN platform_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_reports,
        SUM(CASE WHEN platform_status = 'removed' THEN 1 ELSE 0 END) AS removed_reports
      FROM complaints
    `)
    .get() as Record<string, number>;

  const reportedContent = db
    .prepare(`SELECT COUNT(*) AS count FROM reports WHERE review_status = 'pending'`)
    .get() as { count: number };

  const pendingVerifications = db
    .prepare(`SELECT COUNT(*) AS count FROM verification_records WHERE verification_status = 'pending' AND id_type IS NOT NULL`)
    .get() as { count: number };

  const byCategory = db
    .prepare(`SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC`)
    .all();

  const allReportsLoc = db.prepare(`SELECT location_id FROM complaints`).all() as Array<{ location_id: string }>;
  const districtMap = new Map<string, number>();
  for (const r of allReportsLoc) {
    const loc = buildLocationPath(r.location_id);
    const dName = loc.district || 'Unassigned';
    districtMap.set(dName, (districtMap.get(dName) || 0) + 1);
  }
  const byDistrict = Array.from(districtMap.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    metrics: {
      totalSubmitted: counts.total_submitted || 0,
      pendingModeration: counts.pending_moderation || 0,
      publishedReports: counts.published_reports || 0,
      rejectedReports: counts.rejected_reports || 0,
      removedReports: counts.removed_reports || 0,
      reportedContent: reportedContent.count || 0,
      pendingVerifications: pendingVerifications.count || 0,
    },
    byCategory,
    byDistrict,
  });
});

// Moderator National ID Verification Review Queue
app.get('/api/admin/verifications', requireModerator, (req, res) => {
  const { status } = req.query;
  let where = `WHERE vr.id_type IS NOT NULL`;
  const params: unknown[] = [];

  if (typeof status === 'string' && ['pending', 'verified', 'rejected'].includes(status)) {
    where += ` AND vr.verification_status = ?`;
    params.push(status);
  } else {
    where += ` AND vr.verification_status != 'expired'`;
  }

  const rows = db
    .prepare(`
      SELECT
        vr.id, vr.user_id, vr.provider_name, vr.id_type, vr.legal_name, vr.id_masked,
        CASE WHEN vr.document_storage_path IS NOT NULL THEN 1 ELSE 0 END AS has_document,
        vr.verification_status, vr.review_note, vr.reviewed_at, vr.verified_at, vr.created_at,
        p.username, p.display_name, p.account_status, p.phone_verified
      FROM verification_records vr
      JOIN profiles p ON p.id = vr.user_id
      ${where}
      ORDER BY
        CASE vr.verification_status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,
        vr.created_at DESC
      LIMIT 100
    `)
    .all(...params) as Array<Record<string, unknown>>;

  res.json({
    verifications: rows.map((r) => ({
      ...r,
      has_document: Boolean(r.has_document),
      phone_verified: Boolean(r.phone_verified),
    })),
  });
});

app.get('/api/admin/verifications/:id/document', requireModerator, (req, res) => {
  const rec = db
    .prepare(`SELECT document_storage_path, document_media_type FROM verification_records WHERE id = ?`)
    .get(req.params.id) as { document_storage_path: string | null; document_media_type: string | null } | undefined;

  if (!rec || !rec.document_storage_path) {
    res.status(404).json({ error: 'No ID document attached to this verification record.' });
    return;
  }

  const filePath = resolveRestrictedKycPath(rec.document_storage_path);
  if (!filePath) {
    res.status(404).json({ error: 'Document file not found.' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (rec.document_media_type) {
    res.setHeader('Content-Type', rec.document_media_type);
  }
  res.sendFile(filePath);
});

app.post('/api/admin/verifications/:id/review', requireModerator, (req: AuthedRequest, res) => {
  const { decision, reason } = req.body as { decision?: 'approve' | 'reject'; reason?: string };
  if (decision !== 'approve' && decision !== 'reject') {
    res.status(400).json({ error: 'Decision must be approve or reject.' });
    return;
  }
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: 'Please provide a review reason (at least 5 characters).' });
    return;
  }

  try {
    const result = reviewNationalIdVerification({
      recordId: req.params.id,
      moderatorId: req.user!.id,
      decision,
      reason,
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

app.get('/api/admin/reports', requireModerator, (req, res) => {
  const { status, q } = req.query;
  let where = `WHERE 1=1`;
  const params: unknown[] = [];

  if (status === 'pending') {
    where += ` AND c.platform_status IN ('submitted', 'under_review', 'additional_information_required')`;
  } else if (typeof status === 'string' && status && status !== 'all') {
    where += ` AND c.platform_status = ?`;
    params.push(status);
  }

  if (typeof q === 'string' && q.trim()) {
    const term = `%${q.trim()}%`;
    where += ` AND (c.title LIKE ? OR c.generalized_location LIKE ? OR p.username LIKE ?)`;
    params.push(term, term, term);
  }

  const rows = db
    .prepare(`
      SELECT
        c.id, c.title, c.category, c.generalized_location, c.platform_status, c.visibility,
        c.created_at, c.published_at,
        p.username AS author_username, p.display_name AS author_display_name,
        (SELECT COUNT(*) FROM complaint_media m WHERE m.complaint_id = c.id) AS media_count
      FROM complaints c
      JOIN profiles p ON p.id = c.user_id
      ${where}
      ORDER BY c.created_at DESC
    `)
    .all(...params);

  res.json({ reports: rows });
});

app.get('/api/admin/reports/:id', requireModerator, (req, res) => {
  const report = db
    .prepare(`
      SELECT
        c.*, p.username AS author_username, p.display_name AS author_display_name,
        p.account_status AS author_account_status, p.identity_status AS author_identity_status
      FROM complaints c
      JOIN profiles p ON p.id = c.user_id
      WHERE c.id = ?
    `)
    .get(req.params.id) as Record<string, unknown> | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const media = db
    .prepare(`SELECT id, media_type, review_status FROM complaint_media WHERE complaint_id = ?`)
    .all(req.params.id) as Array<{ id: string; media_type: string; review_status: string }>;

  const actions = db
    .prepare(`
      SELECT ma.*, p.username AS moderator_username
      FROM moderation_actions ma
      JOIN profiles p ON p.id = ma.moderator_id
      WHERE ma.complaint_id = ?
      ORDER BY ma.created_at DESC
    `)
    .all(req.params.id);

  const history = db
    .prepare(`SELECT * FROM complaint_status_history WHERE complaint_id = ? ORDER BY created_at DESC`)
    .all(req.params.id);

  const potentialDuplicates = db
    .prepare(`
      SELECT id, title, platform_status, generalized_location, created_at
      FROM complaints
      WHERE id != ? AND category = ?
      ORDER BY created_at DESC
      LIMIT 5
    `)
    .all(req.params.id, report.category);

  res.json({
    report,
    media: media.map((m) => ({
      ...m,
      url: m.review_status === 'approved' ? `/api/media/published/${m.id}` : `/api/media/pending/${m.id}`,
    })),
    actions,
    history,
    potentialDuplicates,
  });
});

app.post('/api/admin/reports/:id/moderate', requireModerator, (req: AuthedRequest, res) => {
  const { action, reason } = req.body as { action?: ModerationActionType; reason?: string };
  if (!action || !reason || reason.trim().length < 5) {
    res.status(400).json({ error: 'A moderation action and clear reason (at least 5 characters) are required.' });
    return;
  }

  const report = db
    .prepare(`SELECT id, user_id, title, platform_status FROM complaints WHERE id = ?`)
    .get(req.params.id) as { id: string; user_id: string; title: string; platform_status: PlatformStatus } | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const transition = canModeratorTransition(report.platform_status, action);
  if (!transition.allowed) {
    res.status(400).json({ error: transition.reason || 'Invalid moderation status transition.' });
    return;
  }

  const modId = req.user!.id;
  const cleanReason = reason.trim();

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE complaints
      SET
        platform_status = ?,
        visibility = ?,
        updated_at = datetime('now'),
        published_at = CASE WHEN ? = 'publish' THEN COALESCE(published_at, datetime('now')) ELSE published_at END
      WHERE id = ?
    `).run(transition.nextStatus, transition.nextVisibility, action, report.id);

    db.prepare(`
      INSERT INTO moderation_actions (id, moderator_id, complaint_id, action, reason, previous_status, new_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), modId, report.id, action, cleanReason, report.platform_status, transition.nextStatus);

    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, previous_status, new_status, actor_id, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), report.id, report.platform_status, transition.nextStatus, modId, cleanReason);

    if (action === 'publish') {
      const mediaRows = db
        .prepare(`SELECT id, storage_path FROM complaint_media WHERE complaint_id = ?`)
        .all(report.id) as Array<{ id: string; storage_path: string }>;
      for (const m of mediaRows) {
        promotePendingToPublished(m.storage_path);
      }
      db.prepare(`UPDATE complaint_media SET review_status = 'approved' WHERE complaint_id = ?`).run(report.id);
    }

    const notifMessage =
      action === 'publish'
        ? `Your report "${report.title}" is now published on JanConnect.`
        : action === 'request_info'
        ? `A JanConnect moderator requested more context on "${report.title}": ${cleanReason}`
        : action === 'reject'
        ? `Your report "${report.title}" was not published: ${cleanReason}`
        : action === 'remove'
        ? `Your report "${report.title}" was removed from public view: ${cleanReason}`
        : `Your report "${report.title}" is now under JanConnect moderation review.`;

    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), report.user_id, `report_${transition.nextStatus}`, report.id, notifMessage);
  });
  tx();

  writeAuditLog({
    actorId: modId,
    action: `moderation_${action}`,
    targetType: 'complaint',
    targetId: report.id,
    metadata: { previous_status: report.platform_status, new_status: transition.nextStatus, reason: cleanReason },
  });

  res.json({ ok: true, new_status: transition.nextStatus, visibility: transition.nextVisibility });
});

app.post('/api/admin/reports/:id/ai-assist', requireModerator, async (req, res) => {
  const report = db
    .prepare(`SELECT id, title, description, category, location_id FROM complaints WHERE id = ?`)
    .get(req.params.id) as { id: string; title: string; description: string; category: string; location_id: string } | undefined;

  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const recent = db
    .prepare(`
      SELECT id, title, generalized_location
      FROM complaints
      WHERE id != ?
      ORDER BY created_at DESC
      LIMIT 15
    `)
    .all(report.id) as Array<{ id: string; title: string; generalized_location: string }>;

  const result = await runModeratorAiAssist({
    title: report.title,
    description: report.description,
    currentCategory: report.category,
    recentTitlesInDistrict: recent,
  });

  res.json(result);
});

app.get('/api/admin/content-reports', requireModerator, (_req, res) => {
  const flags = db
    .prepare(`
      SELECT
        r.*, p.username AS reporter_username
      FROM reports r
      JOIN profiles p ON p.id = r.reporter_id
      ORDER BY r.created_at DESC
    `)
    .all();

  const users = db
    .prepare(`
      SELECT p.id, p.username, p.display_name, p.account_status, p.identity_status, p.created_at
      FROM profiles p
      ORDER BY p.created_at DESC
      LIMIT 100
    `)
    .all();

  res.json({ flags, users });
});

app.post('/api/admin/content-reports/:id/resolve', requireModerator, (req: AuthedRequest, res) => {
  const { decision, reason } = req.body as { decision?: 'dismiss' | 'remove_target'; reason?: string };
  if (!decision || !['dismiss', 'remove_target'].includes(decision)) {
    res.status(400).json({ error: 'Invalid resolution decision.' });
    return;
  }

  const flag = db.prepare(`SELECT * FROM reports WHERE id = ?`).get(req.params.id) as
    | { id: string; target_type: string; target_id: string; review_status: string }
    | undefined;

  if (!flag) {
    res.status(404).json({ error: 'Content report not found.' });
    return;
  }

  const modId = req.user!.id;
  const tx = db.transaction(() => {
    const nextStatus = decision === 'dismiss' ? 'dismissed' : 'resolved_removed';
    db.prepare(`UPDATE reports SET review_status = ? WHERE id = ?`).run(nextStatus, flag.id);

    if (decision === 'remove_target') {
      if (flag.target_type === 'comment') {
        db.prepare(`UPDATE complaint_comments SET moderation_status = 'removed', updated_at = datetime('now') WHERE id = ?`).run(
          flag.target_id
        );
      } else if (flag.target_type === 'complaint') {
        db.prepare(`UPDATE complaints SET platform_status = 'removed', visibility = 'private', updated_at = datetime('now') WHERE id = ?`).run(
          flag.target_id
        );
      } else if (flag.target_type === 'user') {
        db.prepare(`UPDATE profiles SET account_status = 'restricted', updated_at = datetime('now') WHERE id = ?`).run(flag.target_id);
        db.prepare(`
          INSERT INTO notifications (id, recipient_id, type, message)
          VALUES (?, ?, 'safety_notice', ?)
        `).run(
          crypto.randomUUID(),
          flag.target_id,
          `Account safety notice: ${reason || 'Your account was restricted following a safety review.'}`
        );
      }
    }
  });
  tx();

  writeAuditLog({
    actorId: modId,
    action: `content_flag_${decision}`,
    targetType: flag.target_type,
    targetId: flag.target_id,
    metadata: { reason: reason || '' },
  });

  res.json({ ok: true });
});

app.post('/api/admin/users/:id/status', requireModerator, (req: AuthedRequest, res) => {
  const { status, reason } = req.body as { status?: 'active' | 'restricted' | 'suspended'; reason?: string };
  if (!status || !['active', 'restricted', 'suspended'].includes(status)) {
    res.status(400).json({ error: 'Invalid account status.' });
    return;
  }
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Moderators cannot change their own account status.' });
    return;
  }
  db.prepare(`UPDATE profiles SET account_status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  db.prepare(`
    INSERT INTO notifications (id, recipient_id, type, message)
    VALUES (?, ?, 'safety_notice', ?)
  `).run(
    crypto.randomUUID(),
    req.params.id,
    `Your account status was updated to ${status}. ${reason ? `Note: ${reason}` : ''}`
  );
  writeAuditLog({
    actorId: req.user!.id,
    action: 'user_status_updated',
    targetType: 'profile',
    targetId: req.params.id,
    metadata: { status, reason: reason || '' },
  });
  res.json({ ok: true });
});

app.get('/api/admin/moderation-history', requireModerator, (_req, res) => {
  const actions = db
    .prepare(`
      SELECT ma.*, p.username AS moderator_username, c.title AS report_title
      FROM moderation_actions ma
      JOIN profiles p ON p.id = ma.moderator_id
      JOIN complaints c ON c.id = ma.complaint_id
      ORDER BY ma.created_at DESC
      LIMIT 100
    `)
    .all();

  const auditLogs = db
    .prepare(`
      SELECT al.*, p.username AS actor_username
      FROM audit_logs al
      LEFT JOIN profiles p ON p.id = al.actor_id
      ORDER BY al.created_at DESC
      LIMIT 100
    `)
    .all();

  res.json({ actions, auditLogs });
});

app.post('/api/admin/roles', requireAdministrator, (req: AuthedRequest, res) => {
  const { userId, role } = req.body as { userId?: string; role?: 'citizen' | 'moderator' | 'administrator' };
  if (!userId || !role || !['citizen', 'moderator', 'administrator'].includes(role)) {
    res.status(400).json({ error: 'Valid userId and role are required.' });
    return;
  }
  db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)`).run(
    crypto.randomUUID(),
    userId,
    role,
    req.user!.id
  );
  writeAuditLog({ actorId: req.user!.id, action: 'role_assigned', targetType: 'user_roles', targetId: userId, metadata: { role } });
  res.json({ ok: true });
});

app.use('/api', (err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: 'Uploaded file exceeds the size limit (up to 50 MB for report photos/videos, 5 MB for ID photos).',
      });
      return;
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({ error: 'You can upload at most 3 attachments per report.' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

// =========================================================================
// VITE MIDDLEWARE (DEV) & STATIC DIST (PROD)
// =========================================================================

async function startServer() {
  const port = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`JanConnect server running on http://0.0.0.0:${port}`);
  });
}

startServer();
