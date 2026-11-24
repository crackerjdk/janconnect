import crypto from 'crypto';
import { db, writeAuditLog } from './db';
import { saveRestrictedKycDocument } from './media';
import {
  type NationalIdType,
  validateLegalName,
  validateNationalIdFormat,
} from '../src/utils/nationalId';

const EPHEMERAL_ID_HASH_SECRET = crypto.randomBytes(32).toString('hex');

function getNationalIdHashSecret(): string {
  return process.env.NATIONAL_ID_HASH_SECRET || process.env.SESSION_SECRET || EPHEMERAL_ID_HASH_SECRET;
}

export class DuplicateNationalIdError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateNationalIdError';
  }
}

export interface VerificationSessionResult {
  providerName: string;
  mode: 'production-provider' | 'test-environment';
  bannerNotice: string;
  sessionToken: string;
  challengeCode?: string;
}

export interface VerificationSummary {
  id: string;
  provider_name: string;
  provider_reference: string;
  id_type: NationalIdType | null;
  legal_name: string | null;
  id_masked: string | null;
  has_document: boolean;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired';
  review_note: string | null;
  reviewed_at: string | null;
  verified_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function isProductionVerificationConfigured(): boolean {
  return Boolean(process.env.IDENTITY_PROVIDER_URL && process.env.IDENTITY_PROVIDER_SECRET);
}

export function hashNationalId(idType: NationalIdType, normalizedId: string): string {
  return crypto
    .createHmac('sha256', getNationalIdHashSecret())
    .update(`${idType}:${normalizedId}`)
    .digest('hex');
}

export function getUserVerificationSummary(userId: string): VerificationSummary | null {
  const row = db
    .prepare(`
      SELECT
        id, provider_name, provider_reference, id_type, legal_name, id_masked,
        CASE WHEN document_storage_path IS NOT NULL THEN 1 ELSE 0 END AS has_document,
        verification_status, review_note, reviewed_at, verified_at, expires_at, created_at
      FROM verification_records
      WHERE user_id = ? AND verification_status != 'expired'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(userId) as
    | (Omit<VerificationSummary, 'has_document'> & { has_document: number })
    | undefined;

  if (!row) return null;
  return {
    ...row,
    has_document: Boolean(row.has_document),
  };
}

export function submitNationalIdVerification(params: {
  userId: string;
  idType: NationalIdType;
  legalName: string;
  idNumber: string;
  documentBuffer?: Buffer | null;
}): VerificationSummary {
  const nameCheck = validateLegalName(params.legalName);
  if (!nameCheck.valid) {
    throw new Error(nameCheck.error || 'Invalid legal name.');
  }

  const idCheck = validateNationalIdFormat(params.idType, params.idNumber);
  if (!idCheck.valid) {
    throw new Error(idCheck.error || 'Invalid National ID format.');
  }

  const existingVerified = db
    .prepare(`SELECT identity_status FROM profiles WHERE id = ?`)
    .get(params.userId) as { identity_status: string } | undefined;

  if (!existingVerified) {
    throw new Error('Citizen profile not found.');
  }
  if (existingVerified.identity_status === 'verified') {
    throw new Error('Your identity is already verified.');
  }

  const idHash = hashNationalId(params.idType, idCheck.normalized);

  const duplicate = db
    .prepare(`
      SELECT user_id
      FROM verification_records
      WHERE id_type = ? AND id_number_hash = ? AND verification_status IN ('pending', 'verified') AND user_id != ?
      LIMIT 1
    `)
    .get(params.idType, idHash, params.userId) as { user_id: string } | undefined;

  if (duplicate) {
    throw new DuplicateNationalIdError(
      'This National ID is already linked to another active or pending JanConnect account. One National ID can only verify one citizen account.'
    );
  }

  let savedDoc: { storagePath: string; mediaType: string } | null = null;
  if (params.documentBuffer && params.documentBuffer.length > 0) {
    savedDoc = saveRestrictedKycDocument(params.documentBuffer);
  }

  const recordId = crypto.randomUUID();
  const providerRef = `nid_${crypto.randomUUID()}`;
  const providerName = isProductionVerificationConfigured()
    ? 'configured_provider_national_id'
    : 'national_id_moderator_queue';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE verification_records
      SET verification_status = 'expired'
      WHERE user_id = ? AND verification_status IN ('pending', 'rejected')
    `).run(params.userId);

    db.prepare(`
      INSERT INTO verification_records (
        id, user_id, provider_name, provider_reference,
        id_type, legal_name, id_masked, id_number_hash,
        document_storage_path, document_media_type,
        verification_status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      recordId,
      params.userId,
      providerName,
      providerRef,
      params.idType,
      nameCheck.cleaned,
      idCheck.masked,
      idHash,
      savedDoc?.storagePath ?? null,
      savedDoc?.mediaType ?? null
    );

    db.prepare(`
      UPDATE profiles
      SET identity_status = 'pending', updated_at = datetime('now')
      WHERE id = ?
    `).run(params.userId);

    writeAuditLog({
      actorId: params.userId,
      action: 'national_id_submitted',
      targetType: 'verification_record',
      targetId: recordId,
      metadata: {
        id_type: params.idType,
        id_masked: idCheck.masked,
        has_document: Boolean(savedDoc),
      },
    });
  });

  try {
    tx();
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('UNIQUE constraint failed')) {
      throw new DuplicateNationalIdError(
        'This National ID is already linked to another active or pending JanConnect account.'
      );
    }
    throw err;
  }

  return getUserVerificationSummary(params.userId)!;
}

export function reviewNationalIdVerification(params: {
  recordId: string;
  moderatorId: string;
  decision: 'approve' | 'reject';
  reason: string;
}): { userId: string; status: 'verified' | 'rejected' } {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 5) {
    throw new Error('Please provide a review reason (at least 5 characters).');
  }

  const rec = db
    .prepare(`
      SELECT id, user_id, id_type, id_masked, verification_status
      FROM verification_records
      WHERE id = ?
    `)
    .get(params.recordId) as
    | {
        id: string;
        user_id: string;
        id_type: string | null;
        id_masked: string | null;
        verification_status: string;
      }
    | undefined;

  if (!rec) {
    throw new Error('Verification submission not found.');
  }
  if (rec.user_id === params.moderatorId) {
    throw new Error('Moderators cannot approve or reject their own identity verification.');
  }
  if (rec.verification_status !== 'pending') {
    throw new Error(`Cannot review verification record in status "${rec.verification_status}".`);
  }

  const nextStatus = params.decision === 'approve' ? 'verified' : 'rejected';
  const nowIso = new Date().toISOString();
  const expiresIso = params.decision === 'approve'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE verification_records
      SET
        verification_status = ?,
        reviewer_id = ?,
        review_note = ?,
        reviewed_at = ?,
        verified_at = ?,
        expires_at = ?
      WHERE id = ?
    `).run(
      nextStatus,
      params.moderatorId,
      cleanReason,
      nowIso,
      params.decision === 'approve' ? nowIso : null,
      expiresIso,
      rec.id
    );

    db.prepare(`
      UPDATE profiles
      SET identity_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, rec.user_id);

    const notifMsg =
      params.decision === 'approve'
        ? `Your National ID verification (${rec.id_masked || 'ID'}) was approved. You can now submit civic reports.`
        : `Your National ID verification was not approved: ${cleanReason}`;

    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'identity_verification_update', ?, ?)
    `).run(crypto.randomUUID(), rec.user_id, rec.id, notifMsg);

    writeAuditLog({
      actorId: params.moderatorId,
      action: `national_id_${params.decision}`,
      targetType: 'verification_record',
      targetId: rec.id,
      metadata: {
        target_user_id: rec.user_id,
        id_type: rec.id_type,
        id_masked: rec.id_masked,
        reason: cleanReason,
      },
    });
  });

  tx();
  return { userId: rec.user_id, status: nextStatus };
}

/**
 * IdentityVerificationAdapter:
 * - When IDENTITY_PROVIDER_URL & IDENTITY_PROVIDER_SECRET are set, integrates with external verified provider.
 * - In local preview / development mode, runs a strictly labeled Test-Environment adapter
 *   displaying "TEST ENVIRONMENT — IDENTITY NOT VERIFIED" and never claims official government ID verification.
 */
export function startVerificationSession(userId: string): VerificationSessionResult {
  if (isProductionVerificationConfigured()) {
    const ref = crypto.randomUUID();
    db.prepare(`
      INSERT INTO verification_records (id, user_id, provider_name, provider_reference, verification_status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(crypto.randomUUID(), userId, 'configured_provider', ref);

    db.prepare(`UPDATE profiles SET identity_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(userId);
    writeAuditLog({ actorId: userId, action: 'identity_verification_started', targetType: 'profile', targetId: userId });

    return {
      providerName: 'Authorized Identity Provider',
      mode: 'production-provider',
      bannerNotice: 'External verification session initiated.',
      sessionToken: ref,
    };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Identity verification provider credentials are not configured for production.');
  }

  const ref = `test_${crypto.randomUUID()}`;
  const challengeCode = 'TEST-UK-01';
  db.prepare(`
    UPDATE verification_records
    SET verification_status = 'expired'
    WHERE user_id = ? AND verification_status IN ('pending', 'rejected')
  `).run(userId);

  db.prepare(`
    INSERT INTO verification_records (id, user_id, provider_name, provider_reference, verification_status)
    VALUES (?, ?, 'test_environment_adapter', ?, 'pending')
  `).run(crypto.randomUUID(), userId, ref);

  db.prepare(`UPDATE profiles SET identity_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(userId);
  writeAuditLog({
    actorId: userId,
    action: 'test_identity_verification_started',
    targetType: 'profile',
    targetId: userId,
  });

  return {
    providerName: 'Test-Environment Verification Adapter',
    mode: 'test-environment',
    bannerNotice:
      'TEST ENVIRONMENT — IDENTITY NOT VERIFIED. Test-only verification is active for preview; production requires an authorized provider or moderator review.',
    sessionToken: ref,
    challengeCode,
  };
}

export function completeTestVerificationSession(userId: string, sessionToken?: string): void {
  if (process.env.NODE_ENV === 'production' && !isProductionVerificationConfigured()) {
    throw new Error('Test verification cannot be used in production.');
  }

  const rec = sessionToken
    ? (db
        .prepare(`SELECT id, verification_status FROM verification_records WHERE user_id = ? AND provider_reference = ?`)
        .get(userId, sessionToken) as { id: string; verification_status: string } | undefined)
    : (db
        .prepare(`SELECT id, verification_status FROM verification_records WHERE user_id = ? AND verification_status = 'pending' ORDER BY created_at DESC LIMIT 1`)
        .get(userId) as { id: string; verification_status: string } | undefined);

  if (!rec) {
    throw new Error('Verification session not found or expired.');
  }

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE verification_records
    SET verification_status = 'verified', verified_at = ?, expires_at = ?
    WHERE id = ?
  `).run(nowIso, expiresIso, rec.id);

  db.prepare(`
    UPDATE profiles SET identity_status = 'verified', updated_at = datetime('now') WHERE id = ?
  `).run(userId);

  writeAuditLog({
    actorId: userId,
    action: 'test_identity_verification_completed',
    targetType: 'profile',
    targetId: userId,
    metadata: { mode: 'test-environment' },
  });
}
