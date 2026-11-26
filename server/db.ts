import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SEED_LOCATIONS } from '../src/data/uttarakhandLocations';
import { initGovDatabase } from './govDb';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'janconnect.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('country', 'state', 'district', 'block', 'locality')),
      state_code TEXT,
      latitude REAL,
      longitude REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_locations_parent ON locations(parent_id);

    CREATE TABLE IF NOT EXISTS auth_accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      phone_e164 TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      location_id TEXT REFERENCES locations(id) ON DELETE SET NULL,
      account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'restricted', 'suspended')),
      phone_verified INTEGER NOT NULL DEFAULT 0,
      identity_status TEXT NOT NULL DEFAULT 'unverified' CHECK (identity_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired')),
      age_consent_acknowledged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('citizen', 'moderator', 'administrator', 'government_authority', 'financial_admin')),
      assigned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (user_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

    CREATE TABLE IF NOT EXISTS verification_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      provider_name TEXT NOT NULL,
      provider_reference TEXT NOT NULL,
      id_type TEXT CHECK (id_type IN ('voter_id', 'driving_licence', 'passport', 'pan', 'aadhaar_vid')),
      legal_name TEXT,
      id_masked TEXT,
      id_number_hash TEXT,
      document_storage_path TEXT,
      document_media_type TEXT,
      verification_status TEXT NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
      reviewer_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      review_note TEXT,
      reviewed_at TEXT,
      verified_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS otp_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      phone_e164 TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_challenges (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      expires_at TEXT NOT NULL,
      consumed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_pw_reset_user ON password_reset_challenges(user_id, consumed);

    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      location_id TEXT NOT NULL REFERENCES locations(id),
      generalized_location TEXT NOT NULL,
      restricted_latitude REAL,
      restricted_longitude REAL,
      urgency_note TEXT,
      platform_status TEXT NOT NULL DEFAULT 'submitted' CHECK (platform_status IN (
        'submitted',
        'under_review',
        'additional_information_required',
        'published',
        'rejected',
        'removed'
      )),
      visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      published_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_complaints_status_vis ON complaints(platform_status, visibility);
    CREATE INDEX IF NOT EXISTS idx_complaints_user ON complaints(user_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_location ON complaints(location_id);

    CREATE TABLE IF NOT EXISTS complaint_media (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      uploader_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL,
      media_type TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_complaint_media_complaint ON complaint_media(complaint_id);

    CREATE TABLE IF NOT EXISTS complaint_support (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (complaint_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_complaint_support_complaint ON complaint_support(complaint_id);

    CREATE TABLE IF NOT EXISTS complaint_comments (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'removed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_complaint_comments_complaint ON complaint_comments(complaint_id);

    CREATE TABLE IF NOT EXISTS complaint_status_history (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES profiles(id),
      reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS moderation_actions (
      id TEXT PRIMARY KEY,
      moderator_id TEXT NOT NULL REFERENCES profiles(id),
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      action TEXT NOT NULL CHECK (action IN ('start_review', 'request_info', 'publish', 'reject', 'remove')),
      reason TEXT NOT NULL,
      previous_status TEXT NOT NULL,
      new_status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      target_type TEXT NOT NULL CHECK (target_type IN ('complaint', 'comment', 'user')),
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'resolved_removed', 'dismissed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      related_id TEXT,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);

    CREATE TABLE IF NOT EXISTS contractor_bids (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      contractor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      registration_number TEXT NOT NULL,
      bid_amount_inr INTEGER NOT NULL,
      estimated_days INTEGER NOT NULL,
      warranty_months INTEGER NOT NULL DEFAULT 12,
      proposal_summary TEXT NOT NULL,
      bid_status TEXT NOT NULL DEFAULT 'submitted' CHECK (bid_status IN ('submitted', 'shortlisted', 'awarded', 'rejected', 'withdrawn')),
      reviewer_note TEXT,
      reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (complaint_id, contractor_id)
    );
    CREATE INDEX IF NOT EXISTS idx_contractor_bids_complaint ON contractor_bids(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_contractor_bids_contractor ON contractor_bids(contractor_id);
    CREATE INDEX IF NOT EXISTS idx_contractor_bids_status ON contractor_bids(bid_status);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES profiles(id),
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TRIGGER IF NOT EXISTS trg_status_history_no_update
      BEFORE UPDATE ON complaint_status_history
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;
    CREATE TRIGGER IF NOT EXISTS trg_status_history_no_delete
      BEFORE DELETE ON complaint_status_history
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;

    CREATE TRIGGER IF NOT EXISTS trg_moderation_actions_no_update
      BEFORE UPDATE ON moderation_actions
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;
    CREATE TRIGGER IF NOT EXISTS trg_moderation_actions_no_delete
      BEFORE DELETE ON moderation_actions
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;

    CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
      BEFORE UPDATE ON audit_logs
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;
    CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
      BEFORE DELETE ON audit_logs
      BEGIN SELECT RAISE(ABORT, 'Append-only table'); END;
  `);

  const existingVerifCols = new Set(
    (db.prepare(`PRAGMA table_info(verification_records)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  const verifColumnMigrations: Array<[string, string]> = [
    ['id_type', 'TEXT'],
    ['legal_name', 'TEXT'],
    ['id_masked', 'TEXT'],
    ['id_number_hash', 'TEXT'],
    ['document_storage_path', 'TEXT'],
    ['document_media_type', 'TEXT'],
    ['reviewer_id', 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'],
    ['review_note', 'TEXT'],
    ['reviewed_at', 'TEXT'],
  ];
  for (const [col, def] of verifColumnMigrations) {
    if (!existingVerifCols.has(col)) {
      db.exec(`ALTER TABLE verification_records ADD COLUMN ${col} ${def}`);
    }
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_national_id
      ON verification_records(id_type, id_number_hash)
      WHERE id_type IS NOT NULL AND id_number_hash IS NOT NULL AND verification_status IN ('pending', 'verified');
  `);

  const existingBidCols = new Set(
    (db.prepare(`PRAGMA table_info(contractor_bids)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  if (!existingBidCols.has('budget_funded_by')) {
    db.exec(`ALTER TABLE contractor_bids ADD COLUMN budget_funded_by TEXT`);
  }

  const insertLoc = db.prepare(`
    INSERT OR IGNORE INTO locations (id, parent_id, name, type, state_code, latitude, longitude)
    VALUES (@id, @parent_id, @name, @type, @state_code, @latitude, @longitude)
  `);

  const seedTx = db.transaction(() => {
    for (const loc of SEED_LOCATIONS) {
      insertLoc.run(loc);
    }
  });
  seedTx();

  // Safely upgrade existing user_roles table CHECK constraint if created before v0.2 roles
  const userRolesMeta = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'user_roles'`)
    .get() as { sql?: string } | undefined;
  if (userRolesMeta?.sql && !userRolesMeta.sql.includes('government_authority')) {
    db.pragma('foreign_keys = OFF');
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE user_roles_new (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('citizen', 'moderator', 'administrator', 'government_authority', 'financial_admin')),
        assigned_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE (user_id, role)
      );
      INSERT INTO user_roles_new (id, user_id, role, assigned_by, assigned_at)
      SELECT id, user_id, role, assigned_by, assigned_at FROM user_roles;
      DROP TABLE user_roles;
      ALTER TABLE user_roles_new RENAME TO user_roles;
      CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
      COMMIT;
    `);
    db.pragma('foreign_keys = ON');
  }

  initGovDatabase(db);
}

export function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.actorId,
    params.action,
    params.targetType,
    params.targetId ?? null,
    JSON.stringify(params.metadata ?? {})
  );
}
