// server.ts
import "dotenv/config";
import express from "express";
import path3 from "path";
import fs3 from "fs";
import crypto5 from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";

// server/db.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// src/data/uttarakhandLocations.ts
var SEED_LOCATIONS = [
  { id: "in-country", parent_id: null, name: "India", type: "country", state_code: null, latitude: 20.5937, longitude: 78.9629 },
  { id: "uk-state", parent_id: "in-country", name: "Uttarakhand", type: "state", state_code: "UK", latitude: 30.0668, longitude: 79.0193 },
  // 13 Districts of Uttarakhand
  { id: "uk-dehradun", parent_id: "uk-state", name: "Dehradun", type: "district", state_code: "UK", latitude: 30.3165, longitude: 78.0322 },
  { id: "uk-haridwar", parent_id: "uk-state", name: "Haridwar", type: "district", state_code: "UK", latitude: 29.9457, longitude: 78.1642 },
  { id: "uk-nainital", parent_id: "uk-state", name: "Nainital", type: "district", state_code: "UK", latitude: 29.3919, longitude: 79.4542 },
  { id: "uk-usnagar", parent_id: "uk-state", name: "Udham Singh Nagar", type: "district", state_code: "UK", latitude: 28.961, longitude: 79.515 },
  { id: "uk-almora", parent_id: "uk-state", name: "Almora", type: "district", state_code: "UK", latitude: 29.5892, longitude: 79.6467 },
  { id: "uk-pauri", parent_id: "uk-state", name: "Pauri Garhwal", type: "district", state_code: "UK", latitude: 30.1469, longitude: 78.7808 },
  { id: "uk-tehri", parent_id: "uk-state", name: "Tehri Garhwal", type: "district", state_code: "UK", latitude: 30.3753, longitude: 78.4337 },
  { id: "uk-chamoli", parent_id: "uk-state", name: "Chamoli", type: "district", state_code: "UK", latitude: 30.4067, longitude: 79.3212 },
  { id: "uk-pithoragarh", parent_id: "uk-state", name: "Pithoragarh", type: "district", state_code: "UK", latitude: 29.5829, longitude: 80.2182 },
  { id: "uk-bageshwar", parent_id: "uk-state", name: "Bageshwar", type: "district", state_code: "UK", latitude: 29.8362, longitude: 79.7714 },
  { id: "uk-champawat", parent_id: "uk-state", name: "Champawat", type: "district", state_code: "UK", latitude: 29.3361, longitude: 80.091 },
  { id: "uk-rudraprayag", parent_id: "uk-state", name: "Rudraprayag", type: "district", state_code: "UK", latitude: 30.2844, longitude: 78.9811 },
  { id: "uk-uttarkashi", parent_id: "uk-state", name: "Uttarkashi", type: "district", state_code: "UK", latitude: 30.7268, longitude: 78.4354 },
  // Blocks / Municipalities
  { id: "uk-dehradun-raipur", parent_id: "uk-dehradun", name: "Raipur / Dehradun Municipal", type: "block", state_code: "UK", latitude: 30.325, longitude: 78.08 },
  { id: "uk-dehradun-vikasnagar", parent_id: "uk-dehradun", name: "Vikasnagar", type: "block", state_code: "UK", latitude: 30.469, longitude: 77.772 },
  { id: "uk-dehradun-rishikesh", parent_id: "uk-dehradun", name: "Rishikesh Municipal", type: "block", state_code: "UK", latitude: 30.0869, longitude: 78.2676 },
  { id: "uk-dehradun-mussoorie", parent_id: "uk-dehradun", name: "Mussoorie Municipal", type: "block", state_code: "UK", latitude: 30.4598, longitude: 78.0644 },
  { id: "uk-haridwar-city", parent_id: "uk-haridwar", name: "Haridwar Municipal", type: "block", state_code: "UK", latitude: 29.9457, longitude: 78.1642 },
  { id: "uk-haridwar-roorkee", parent_id: "uk-haridwar", name: "Roorkee", type: "block", state_code: "UK", latitude: 29.8543, longitude: 77.888 },
  { id: "uk-haridwar-laksar", parent_id: "uk-haridwar", name: "Laksar", type: "block", state_code: "UK", latitude: 29.756, longitude: 78.04 },
  { id: "uk-nainital-haldwani", parent_id: "uk-nainital", name: "Haldwani Municipal", type: "block", state_code: "UK", latitude: 29.2183, longitude: 79.513 },
  { id: "uk-nainital-bhimtal", parent_id: "uk-nainital", name: "Bhimtal / Nainital", type: "block", state_code: "UK", latitude: 29.3461, longitude: 79.5519 },
  { id: "uk-nainital-ramnagar", parent_id: "uk-nainital", name: "Ramnagar", type: "block", state_code: "UK", latitude: 29.3948, longitude: 79.1265 },
  { id: "uk-usnagar-rudrapur", parent_id: "uk-usnagar", name: "Rudrapur Municipal", type: "block", state_code: "UK", latitude: 28.9875, longitude: 79.4141 },
  { id: "uk-usnagar-kashipur", parent_id: "uk-usnagar", name: "Kashipur", type: "block", state_code: "UK", latitude: 29.2104, longitude: 78.9619 },
  { id: "uk-almora-hawalbagh", parent_id: "uk-almora", name: "Hawalbagh / Almora", type: "block", state_code: "UK", latitude: 29.5971, longitude: 79.6591 },
  { id: "uk-almora-ranikhet", parent_id: "uk-almora", name: "Ranikhet / Tarikhet", type: "block", state_code: "UK", latitude: 29.6434, longitude: 79.4322 },
  { id: "uk-pauri-srinagar", parent_id: "uk-pauri", name: "Srinagar / Khirsu", type: "block", state_code: "UK", latitude: 30.2224, longitude: 78.7834 },
  { id: "uk-pauri-kotdwar", parent_id: "uk-pauri", name: "Kotdwar Municipal", type: "block", state_code: "UK", latitude: 29.7464, longitude: 78.523 },
  { id: "uk-tehri-chamba", parent_id: "uk-tehri", name: "Chamba / New Tehri", type: "block", state_code: "UK", latitude: 30.3435, longitude: 78.3935 },
  { id: "uk-chamoli-gopeshwar", parent_id: "uk-chamoli", name: "Dasholi / Gopeshwar", type: "block", state_code: "UK", latitude: 30.4093, longitude: 79.3198 },
  { id: "uk-pithoragarh-munakot", parent_id: "uk-pithoragarh", name: "Pithoragarh / Munakot", type: "block", state_code: "UK", latitude: 29.5829, longitude: 80.2182 },
  { id: "uk-bageshwar-block", parent_id: "uk-bageshwar", name: "Bageshwar Block", type: "block", state_code: "UK", latitude: 29.8362, longitude: 79.7714 },
  { id: "uk-champawat-lohaghat", parent_id: "uk-champawat", name: "Lohaghat / Champawat", type: "block", state_code: "UK", latitude: 29.4036, longitude: 80.0887 },
  { id: "uk-rudraprayag-augm", parent_id: "uk-rudraprayag", name: "Augustmuni / Rudraprayag", type: "block", state_code: "UK", latitude: 30.394, longitude: 79.027 },
  { id: "uk-uttarkashi-bhatwari", parent_id: "uk-uttarkashi", name: "Bhatwari / Uttarkashi", type: "block", state_code: "UK", latitude: 30.7268, longitude: 78.4354 },
  // Localities / Wards / Villages
  { id: "uk-dehradun-raipur-rajpur", parent_id: "uk-dehradun-raipur", name: "Rajpur Road Ward", type: "locality", state_code: "UK", latitude: 30.365, longitude: 78.07 },
  { id: "uk-dehradun-raipur-dalanwala", parent_id: "uk-dehradun-raipur", name: "Dalanwala", type: "locality", state_code: "UK", latitude: 30.32, longitude: 78.055 },
  { id: "uk-dehradun-raipur-sahastradhara", parent_id: "uk-dehradun-raipur", name: "Sahastradhara Crossing", type: "locality", state_code: "UK", latitude: 30.34, longitude: 78.09 },
  { id: "uk-dehradun-vikasnagar-town", parent_id: "uk-dehradun-vikasnagar", name: "Vikasnagar Market Ward", type: "locality", state_code: "UK", latitude: 30.469, longitude: 77.772 },
  { id: "uk-dehradun-rishikesh-triveni", parent_id: "uk-dehradun-rishikesh", name: "Triveni Ghat / Tilak Road", type: "locality", state_code: "UK", latitude: 30.103, longitude: 78.295 },
  { id: "uk-dehradun-mussoorie-library", parent_id: "uk-dehradun-mussoorie", name: "Library Chowk / Landour", type: "locality", state_code: "UK", latitude: 30.459, longitude: 78.064 },
  { id: "uk-haridwar-city-jwalapur", parent_id: "uk-haridwar-city", name: "Jwalapur", type: "locality", state_code: "UK", latitude: 29.922, longitude: 78.105 },
  { id: "uk-haridwar-city-kankhal", parent_id: "uk-haridwar-city", name: "Kankhal", type: "locality", state_code: "UK", latitude: 29.925, longitude: 78.148 },
  { id: "uk-haridwar-roorkee-civil", parent_id: "uk-haridwar-roorkee", name: "Civil Lines Roorkee", type: "locality", state_code: "UK", latitude: 29.865, longitude: 77.896 },
  { id: "uk-haridwar-laksar-main", parent_id: "uk-haridwar-laksar", name: "Laksar Bazaar", type: "locality", state_code: "UK", latitude: 29.756, longitude: 78.04 },
  { id: "uk-nainital-haldwani-kathgodam", parent_id: "uk-nainital-haldwani", name: "Kathgodam", type: "locality", state_code: "UK", latitude: 29.266, longitude: 79.547 },
  { id: "uk-nainital-haldwani-mukhani", parent_id: "uk-nainital-haldwani", name: "Mukhani / Kaladhungi Road", type: "locality", state_code: "UK", latitude: 29.222, longitude: 79.501 },
  { id: "uk-nainital-bhimtal-tallital", parent_id: "uk-nainital-bhimtal", name: "Tallital / Mallital", type: "locality", state_code: "UK", latitude: 29.38, longitude: 79.46 },
  { id: "uk-nainital-ramnagar-town", parent_id: "uk-nainital-ramnagar", name: "Ramnagar Town", type: "locality", state_code: "UK", latitude: 29.3948, longitude: 79.1265 },
  { id: "uk-usnagar-rudrapur-awaas", parent_id: "uk-usnagar-rudrapur", name: "Awas Vikas Rudrapur", type: "locality", state_code: "UK", latitude: 28.985, longitude: 79.405 },
  { id: "uk-usnagar-kashipur-main", parent_id: "uk-usnagar-kashipur", name: "Kashipur Ward", type: "locality", state_code: "UK", latitude: 29.21, longitude: 78.96 },
  { id: "uk-almora-hawalbagh-chowk", parent_id: "uk-almora-hawalbagh", name: "Mall Road Almora", type: "locality", state_code: "UK", latitude: 29.597, longitude: 79.659 },
  { id: "uk-almora-ranikhet-sadar", parent_id: "uk-almora-ranikhet", name: "Sadar Bazaar Ranikhet", type: "locality", state_code: "UK", latitude: 29.643, longitude: 79.432 },
  { id: "uk-pauri-srinagar-town", parent_id: "uk-pauri-srinagar", name: "Srinagar Garhwal Ward", type: "locality", state_code: "UK", latitude: 30.222, longitude: 78.783 },
  { id: "uk-pauri-kotdwar-town", parent_id: "uk-pauri-kotdwar", name: "Kotdwar Town", type: "locality", state_code: "UK", latitude: 29.746, longitude: 78.523 },
  { id: "uk-tehri-chamba-newtehri", parent_id: "uk-tehri-chamba", name: "New Tehri Baurari", type: "locality", state_code: "UK", latitude: 30.375, longitude: 78.433 },
  { id: "uk-chamoli-gopeshwar-town", parent_id: "uk-chamoli-gopeshwar", name: "Gopeshwar Town", type: "locality", state_code: "UK", latitude: 30.409, longitude: 79.319 },
  { id: "uk-pithoragarh-town", parent_id: "uk-pithoragarh-munakot", name: "Pithoragarh Town", type: "locality", state_code: "UK", latitude: 29.582, longitude: 80.218 },
  { id: "uk-bageshwar-town", parent_id: "uk-bageshwar-block", name: "Bageshwar Town", type: "locality", state_code: "UK", latitude: 29.836, longitude: 79.771 },
  { id: "uk-champawat-town", parent_id: "uk-champawat-lohaghat", name: "Lohaghat Town", type: "locality", state_code: "UK", latitude: 29.403, longitude: 80.088 },
  { id: "uk-rudraprayag-town", parent_id: "uk-rudraprayag-augm", name: "Rudraprayag Main", type: "locality", state_code: "UK", latitude: 30.284, longitude: 78.981 },
  { id: "uk-uttarkashi-town", parent_id: "uk-uttarkashi-bhatwari", name: "Uttarkashi Town", type: "locality", state_code: "UK", latitude: 30.726, longitude: 78.435 }
];

// server/db.ts
var dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
var dbPath = path.join(dataDir, "janconnect.db");
var db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
function initDatabase() {
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
      role TEXT NOT NULL CHECK (role IN ('citizen', 'moderator', 'administrator')),
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
    db.prepare(`PRAGMA table_info(verification_records)`).all().map((c) => c.name)
  );
  const verifColumnMigrations = [
    ["id_type", "TEXT"],
    ["legal_name", "TEXT"],
    ["id_masked", "TEXT"],
    ["id_number_hash", "TEXT"],
    ["document_storage_path", "TEXT"],
    ["document_media_type", "TEXT"],
    ["reviewer_id", "TEXT REFERENCES profiles(id) ON DELETE SET NULL"],
    ["review_note", "TEXT"],
    ["reviewed_at", "TEXT"]
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
}
function writeAuditLog(params) {
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

// server/auth.ts
import crypto2 from "crypto";
var EPHEMERAL_SECRET = crypto2.randomBytes(32).toString("hex");
function getSessionSecret() {
  return process.env.SESSION_SECRET || EPHEMERAL_SECRET;
}
var SESSION_COOKIE_NAME = "janconnect_session";
function hashPassword(password) {
  const salt = crypto2.randomBytes(16).toString("hex");
  const derived = crypto2.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const derived = crypto2.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (derived.length !== original.length) return false;
  return crypto2.timingSafeEqual(derived, original);
}
function signSessionToken(userId) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1e3
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto2.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function verifySessionToken(token) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = crypto2.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto2.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!parsed.sub || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}
function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {};
  const result = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    result[key] = decodeURIComponent(val);
  }
  return result;
}
function setSessionCookie(req, res, token) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${7 * 24 * 60 * 60}`
  ];
  if (isHttps) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function clearSessionCookie(req, res) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https";
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0"
  ];
  if (isHttps) {
    parts.push("Secure", "SameSite=None", "Partitioned");
  } else {
    parts.push("SameSite=Lax");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}
function loadSessionUser(userId) {
  const profile = db.prepare(`
      SELECT id, username, display_name, avatar_url, bio, location_id, account_status, phone_verified, identity_status, created_at
      FROM profiles WHERE id = ?
    `).get(userId);
  if (!profile) return null;
  const roleRows = db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`).all(userId);
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
    created_at: profile.created_at
  };
}
function extractAuthUser(req, _res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
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
function verifyCsrfForCookieMutations(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return next();
  }
  const requestedWith = req.headers["x-requested-with"];
  if (requestedWith === "JanConnect") {
    return next();
  }
  const origin = req.headers.origin;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (origin && host) {
    try {
      const originHost = new URL(origin).host;
      if (originHost === host) return next();
    } catch {
    }
  }
  res.status(403).json({ error: "Cross-origin request validation failed." });
}
function requireAuth(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required. Please sign in." });
    return;
  }
  if (req.user.account_status === "suspended") {
    res.status(403).json({ error: "This account is suspended. Contact JanConnect Safety Support for review." });
    return;
  }
  next();
}
function requireModerator(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Moderator authentication required." });
    return;
  }
  if (!req.user.roles.includes("moderator") && !req.user.roles.includes("administrator")) {
    res.status(403).json({ error: "Forbidden: Moderator privileges verified server-side are required." });
    return;
  }
  next();
}
function requireAdministrator(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Administrator authentication required." });
    return;
  }
  if (!req.user.roles.includes("administrator")) {
    res.status(403).json({ error: "Forbidden: Administrator privileges required." });
    return;
  }
  next();
}
var rateBuckets = /* @__PURE__ */ new Map();
function checkRateLimit(key, maxRequests, windowMs) {
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

// server/media.ts
import fs2 from "fs";
import path2 from "path";
import crypto3 from "crypto";
var storageRoot = path2.resolve(process.cwd(), "storage");
var pendingStorageDir = path2.join(storageRoot, "pending");
var publishedStorageDir = path2.join(storageRoot, "published");
var restrictedKycStorageDir = path2.join(storageRoot, "restricted-kyc");
for (const dir of [storageRoot, pendingStorageDir, publishedStorageDir, restrictedKycStorageDir]) {
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
}
function detectMagicMediaType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) {
    return "image/jpeg";
  }
  if (buf[0] === 137 && buf[1] === 80 && buf[2] === 78 && buf[3] === 71 && buf[4] === 13 && buf[5] === 10 && buf[6] === 26 && buf[7] === 10) {
    return "image/png";
  }
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }
  return null;
}
function stripMetadataFromBuffer(buf, mediaType) {
  if (mediaType === "image/jpeg") {
    return stripJpegMetadata(buf);
  }
  if (mediaType === "image/png") {
    return stripPngMetadata(buf);
  }
  return buf;
}
function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 255 || buf[1] !== 216) return buf;
  const chunks = [buf.subarray(0, 2)];
  let offset = 2;
  while (offset + 1 < buf.length) {
    if (buf[offset] !== 255) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const marker = buf[offset + 1];
    if (marker === 218 || marker === 217) {
      chunks.push(buf.subarray(offset));
      break;
    }
    if (marker >= 208 && marker <= 215 || marker === 1 || marker === 0) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > buf.length) break;
    const segLen = buf.readUInt16BE(offset + 2);
    const segEnd = offset + 2 + segLen;
    if (segEnd > buf.length || segLen < 2) {
      chunks.push(buf.subarray(offset));
      break;
    }
    const isMetadataSegment = marker >= 225 && marker <= 239 && marker !== 238 || marker === 254;
    if (!isMetadataSegment) {
      chunks.push(buf.subarray(offset, segEnd));
    }
    offset = segEnd;
  }
  return Buffer.concat(chunks);
}
function stripPngMetadata(buf) {
  if (buf.length < 8) return buf;
  const chunks = [buf.subarray(0, 8)];
  let offset = 8;
  const stripTypes = /* @__PURE__ */ new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const totalChunkLen = 12 + length;
    if (offset + totalChunkLen > buf.length) break;
    if (!stripTypes.has(type)) {
      chunks.push(buf.subarray(offset, offset + totalChunkLen));
    }
    offset += totalChunkLen;
    if (type === "IEND") break;
  }
  return Buffer.concat(chunks);
}
var EXT_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4"
};
function savePendingMedia(rawBuffer) {
  const mediaType = detectMagicMediaType(rawBuffer);
  if (!mediaType) {
    throw new Error("Unsupported or corrupted media file. Allowed: JPEG, PNG, WebP, MP4.");
  }
  const cleanBuffer = stripMetadataFromBuffer(rawBuffer, mediaType);
  const fileName = `${crypto3.randomUUID()}.${EXT_MAP[mediaType]}`;
  const fullPath = path2.resolve(pendingStorageDir, fileName);
  if (!fullPath.startsWith(pendingStorageDir + path2.sep)) {
    throw new Error("Invalid storage path");
  }
  fs2.writeFileSync(fullPath, cleanBuffer);
  return { storagePath: fileName, mediaType };
}
function promotePendingToPublished(storageFileName) {
  const safeName = path2.basename(storageFileName);
  const src = path2.resolve(pendingStorageDir, safeName);
  const dest = path2.resolve(publishedStorageDir, safeName);
  if (!src.startsWith(pendingStorageDir + path2.sep) || !dest.startsWith(publishedStorageDir + path2.sep)) {
    throw new Error("Invalid storage boundary");
  }
  if (fs2.existsSync(src)) {
    fs2.copyFileSync(src, dest);
  }
}
function resolveSafeMediaPath(bucket, storageFileName) {
  const baseDir = bucket === "pending" ? pendingStorageDir : publishedStorageDir;
  const safeName = path2.basename(storageFileName);
  const resolved = path2.resolve(baseDir, safeName);
  if (!resolved.startsWith(baseDir + path2.sep)) return null;
  if (!fs2.existsSync(resolved)) return null;
  return resolved;
}
function saveRestrictedKycDocument(rawBuffer) {
  const mediaType = detectMagicMediaType(rawBuffer);
  if (!mediaType || mediaType === "video/mp4") {
    throw new Error("ID document must be a valid JPEG, PNG, or WebP image.");
  }
  const cleanBuffer = stripMetadataFromBuffer(rawBuffer, mediaType);
  const fileName = `${crypto3.randomUUID()}.${EXT_MAP[mediaType]}`;
  const fullPath = path2.resolve(restrictedKycStorageDir, fileName);
  if (!fullPath.startsWith(restrictedKycStorageDir + path2.sep)) {
    throw new Error("Invalid restricted KYC storage path");
  }
  fs2.writeFileSync(fullPath, cleanBuffer);
  return { storagePath: fileName, mediaType };
}
function resolveRestrictedKycPath(storageFileName) {
  const safeName = path2.basename(storageFileName);
  const resolved = path2.resolve(restrictedKycStorageDir, safeName);
  if (!resolved.startsWith(restrictedKycStorageDir + path2.sep)) return null;
  if (!fs2.existsSync(resolved)) return null;
  return resolved;
}

// server/verification.ts
import crypto4 from "crypto";

// src/utils/nationalId.ts
function normalizeNationalId(raw) {
  return raw.replace(/[\s-]+/g, "").trim().toUpperCase();
}
function maskNationalId(type, normalized) {
  const last4 = normalized.slice(-4);
  if (type === "aadhaar_vid") {
    return normalized.length === 16 ? `XXXX-XXXX-XXXX-${last4}` : `XXXX-XXXX-${last4}`;
  }
  const hiddenLen = Math.max(4, normalized.length - 4);
  return `${"\u2022".repeat(hiddenLen)}${last4}`;
}
function validateLegalName(name) {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length < 2 || cleaned.length > 80) {
    return { valid: false, cleaned, error: "Legal name must be between 2 and 80 characters." };
  }
  if (!/^[\p{L}\s.'-]+$/u.test(cleaned)) {
    return { valid: false, cleaned, error: "Legal name may only contain letters, spaces, dots, hyphens, and apostrophes." };
  }
  return { valid: true, cleaned };
}
function validateNationalIdFormat(type, rawInput) {
  const normalized = normalizeNationalId(rawInput);
  if (!normalized) {
    return { valid: false, normalized: "", masked: "", error: "Please enter your National ID number." };
  }
  let pattern;
  let errorMsg;
  switch (type) {
    case "voter_id":
      pattern = /^[A-Z]{3}[0-9]{7}$/;
      errorMsg = "Voter ID (EPIC) must be 3 letters followed by 7 digits (e.g., UKD1234567).";
      break;
    case "driving_licence":
      pattern = /^[A-Z]{2}[0-9]{13}$/;
      errorMsg = "Driving Licence must be 2 state letters followed by 13 digits (e.g., UK0720190012345).";
      break;
    case "passport":
      pattern = /^[A-PR-WY][0-9]{7}$/;
      errorMsg = "Indian Passport must be 1 valid letter followed by 7 digits.";
      break;
    case "pan":
      pattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      errorMsg = "PAN Card must match the 10-character format (e.g., ABCDE1234F).";
      break;
    case "aadhaar_vid":
      pattern = /^(?:[0-9]{12}|[0-9]{16})$/;
      errorMsg = "Enter a valid 12-digit Aadhaar or 16-digit Virtual ID (VID).";
      break;
    default:
      return { valid: false, normalized: "", masked: "", error: "Unsupported National ID type." };
  }
  if (!pattern.test(normalized)) {
    return { valid: false, normalized, masked: "", error: errorMsg };
  }
  if (type === "aadhaar_vid") {
    if (/^(\d)\1+$/.test(normalized) || normalized === "123456789012" || normalized === "1234567890123456") {
      return { valid: false, normalized, masked: "", error: "Please enter a valid non-placeholder Aadhaar or VID number." };
    }
    if (normalized.length === 12 && (normalized.startsWith("0") || normalized.startsWith("1"))) {
      return { valid: false, normalized, masked: "", error: "Valid 12-digit Aadhaar numbers cannot start with 0 or 1." };
    }
  }
  return {
    valid: true,
    normalized,
    masked: maskNationalId(type, normalized)
  };
}

// server/verification.ts
var EPHEMERAL_ID_HASH_SECRET = crypto4.randomBytes(32).toString("hex");
function getNationalIdHashSecret() {
  return process.env.NATIONAL_ID_HASH_SECRET || process.env.SESSION_SECRET || EPHEMERAL_ID_HASH_SECRET;
}
var DuplicateNationalIdError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "DuplicateNationalIdError";
  }
};
function isProductionVerificationConfigured() {
  return Boolean(process.env.IDENTITY_PROVIDER_URL && process.env.IDENTITY_PROVIDER_SECRET);
}
function hashNationalId(idType, normalizedId) {
  return crypto4.createHmac("sha256", getNationalIdHashSecret()).update(`${idType}:${normalizedId}`).digest("hex");
}
function getUserVerificationSummary(userId) {
  const row = db.prepare(`
      SELECT
        id, provider_name, provider_reference, id_type, legal_name, id_masked,
        CASE WHEN document_storage_path IS NOT NULL THEN 1 ELSE 0 END AS has_document,
        verification_status, review_note, reviewed_at, verified_at, expires_at, created_at
      FROM verification_records
      WHERE user_id = ? AND verification_status != 'expired'
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);
  if (!row) return null;
  return {
    ...row,
    has_document: Boolean(row.has_document)
  };
}
function submitNationalIdVerification(params) {
  const nameCheck = validateLegalName(params.legalName);
  if (!nameCheck.valid) {
    throw new Error(nameCheck.error || "Invalid legal name.");
  }
  const idCheck = validateNationalIdFormat(params.idType, params.idNumber);
  if (!idCheck.valid) {
    throw new Error(idCheck.error || "Invalid National ID format.");
  }
  const existingVerified = db.prepare(`SELECT identity_status FROM profiles WHERE id = ?`).get(params.userId);
  if (!existingVerified) {
    throw new Error("Citizen profile not found.");
  }
  if (existingVerified.identity_status === "verified") {
    throw new Error("Your identity is already verified.");
  }
  const idHash = hashNationalId(params.idType, idCheck.normalized);
  const duplicate = db.prepare(`
      SELECT user_id
      FROM verification_records
      WHERE id_type = ? AND id_number_hash = ? AND verification_status IN ('pending', 'verified') AND user_id != ?
      LIMIT 1
    `).get(params.idType, idHash, params.userId);
  if (duplicate) {
    throw new DuplicateNationalIdError(
      "This National ID is already linked to another active or pending JanConnect account. One National ID can only verify one citizen account."
    );
  }
  let savedDoc = null;
  if (params.documentBuffer && params.documentBuffer.length > 0) {
    savedDoc = saveRestrictedKycDocument(params.documentBuffer);
  }
  const recordId = crypto4.randomUUID();
  const providerRef = `nid_${crypto4.randomUUID()}`;
  const providerName = isProductionVerificationConfigured() ? "configured_provider_national_id" : "national_id_moderator_queue";
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
      action: "national_id_submitted",
      targetType: "verification_record",
      targetId: recordId,
      metadata: {
        id_type: params.idType,
        id_masked: idCheck.masked,
        has_document: Boolean(savedDoc)
      }
    });
  });
  try {
    tx();
  } catch (err) {
    const msg = err.message || "";
    if (msg.includes("UNIQUE constraint failed")) {
      throw new DuplicateNationalIdError(
        "This National ID is already linked to another active or pending JanConnect account."
      );
    }
    throw err;
  }
  return getUserVerificationSummary(params.userId);
}
function reviewNationalIdVerification(params) {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 5) {
    throw new Error("Please provide a review reason (at least 5 characters).");
  }
  const rec = db.prepare(`
      SELECT id, user_id, id_type, id_masked, verification_status
      FROM verification_records
      WHERE id = ?
    `).get(params.recordId);
  if (!rec) {
    throw new Error("Verification submission not found.");
  }
  if (rec.user_id === params.moderatorId) {
    throw new Error("Moderators cannot approve or reject their own identity verification.");
  }
  if (rec.verification_status !== "pending") {
    throw new Error(`Cannot review verification record in status "${rec.verification_status}".`);
  }
  const nextStatus = params.decision === "approve" ? "verified" : "rejected";
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const expiresIso = params.decision === "approve" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString() : null;
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
      params.decision === "approve" ? nowIso : null,
      expiresIso,
      rec.id
    );
    db.prepare(`
      UPDATE profiles
      SET identity_status = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(nextStatus, rec.user_id);
    const notifMsg = params.decision === "approve" ? `Your National ID verification (${rec.id_masked || "ID"}) was approved. You can now submit civic reports.` : `Your National ID verification was not approved: ${cleanReason}`;
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'identity_verification_update', ?, ?)
    `).run(crypto4.randomUUID(), rec.user_id, rec.id, notifMsg);
    writeAuditLog({
      actorId: params.moderatorId,
      action: `national_id_${params.decision}`,
      targetType: "verification_record",
      targetId: rec.id,
      metadata: {
        target_user_id: rec.user_id,
        id_type: rec.id_type,
        id_masked: rec.id_masked,
        reason: cleanReason
      }
    });
  });
  tx();
  return { userId: rec.user_id, status: nextStatus };
}
function startVerificationSession(userId) {
  if (isProductionVerificationConfigured()) {
    const ref2 = crypto4.randomUUID();
    db.prepare(`
      INSERT INTO verification_records (id, user_id, provider_name, provider_reference, verification_status)
      VALUES (?, ?, ?, ?, 'pending')
    `).run(crypto4.randomUUID(), userId, "configured_provider", ref2);
    db.prepare(`UPDATE profiles SET identity_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(userId);
    writeAuditLog({ actorId: userId, action: "identity_verification_started", targetType: "profile", targetId: userId });
    return {
      providerName: "Authorized Identity Provider",
      mode: "production-provider",
      bannerNotice: "External verification session initiated.",
      sessionToken: ref2
    };
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Identity verification provider credentials are not configured for production.");
  }
  const ref = `test_${crypto4.randomUUID()}`;
  const challengeCode = "TEST-UK-01";
  db.prepare(`
    UPDATE verification_records
    SET verification_status = 'expired'
    WHERE user_id = ? AND verification_status IN ('pending', 'rejected')
  `).run(userId);
  db.prepare(`
    INSERT INTO verification_records (id, user_id, provider_name, provider_reference, verification_status)
    VALUES (?, ?, 'test_environment_adapter', ?, 'pending')
  `).run(crypto4.randomUUID(), userId, ref);
  db.prepare(`UPDATE profiles SET identity_status = 'pending', updated_at = datetime('now') WHERE id = ?`).run(userId);
  writeAuditLog({
    actorId: userId,
    action: "test_identity_verification_started",
    targetType: "profile",
    targetId: userId
  });
  return {
    providerName: "Test-Environment Verification Adapter",
    mode: "test-environment",
    bannerNotice: "TEST ENVIRONMENT \u2014 IDENTITY NOT VERIFIED. Test-only verification is active for preview; production requires an authorized provider or moderator review.",
    sessionToken: ref,
    challengeCode
  };
}
function completeTestVerificationSession(userId, sessionToken) {
  if (process.env.NODE_ENV === "production" && !isProductionVerificationConfigured()) {
    throw new Error("Test verification cannot be used in production.");
  }
  const rec = sessionToken ? db.prepare(`SELECT id, verification_status FROM verification_records WHERE user_id = ? AND provider_reference = ?`).get(userId, sessionToken) : db.prepare(`SELECT id, verification_status FROM verification_records WHERE user_id = ? AND verification_status = 'pending' ORDER BY created_at DESC LIMIT 1`).get(userId);
  if (!rec) {
    throw new Error("Verification session not found or expired.");
  }
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const expiresIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1e3).toISOString();
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
    action: "test_identity_verification_completed",
    targetType: "profile",
    targetId: userId,
    metadata: { mode: "test-environment" }
  });
}

// server/ai.ts
import { GoogleGenAI, Type } from "@google/genai";

// src/utils/civicRules.ts
var REPORT_CATEGORIES = [
  "Roads and Transportation",
  "Water Supply",
  "Electricity",
  "Drainage and Sanitation",
  "Government Hospitals",
  "Education",
  "Public Infrastructure",
  "Public Safety and Accessibility",
  "Environment and Public Spaces",
  "Government Services",
  "Other Civic Problems"
];
var PHONE_PATTERN = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/;
var AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
var EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
function detectPotentialPiiHints(text) {
  const warnings = [];
  if (PHONE_PATTERN.test(text)) {
    warnings.push("Possible mobile number detected. Please remove personal phone numbers before submitting.");
  }
  if (AADHAAR_PATTERN.test(text)) {
    warnings.push("Possible 12-digit ID number detected. Never include Aadhaar or personal ID numbers.");
  }
  if (EMAIL_PATTERN.test(text)) {
    warnings.push("Possible email address detected. Avoid sharing private contact details publicly.");
  }
  return warnings;
}
function validateReportDraft(input) {
  const errors = {};
  const title = (input.title || "").trim();
  const description = (input.description || "").trim();
  if (title.length < 8 || title.length > 140) {
    errors.title = "Title must be between 8 and 140 characters.";
  }
  if (description.length < 20 || description.length > 3e3) {
    errors.description = "Description must be between 20 and 3000 characters.";
  }
  if (!REPORT_CATEGORIES.includes(input.category)) {
    errors.category = "Please select a valid civic category.";
  }
  if (!input.stateId) {
    errors.stateId = "Please select a state.";
  }
  if (!input.districtId) {
    errors.districtId = "Please select a district.";
  }
  if (!input.blockId) {
    errors.blockId = "Please select a block or municipality.";
  }
  if (!input.localityId) {
    errors.localityId = "Please select a village or locality.";
  }
  if (input.approximateLat != null && (input.approximateLat < 6 || input.approximateLat > 38)) {
    errors.coordinates = "Coordinates must fall within India.";
  }
  if (input.approximateLng != null && (input.approximateLng < 68 || input.approximateLng > 98)) {
    errors.coordinates = "Coordinates must fall within India.";
  }
  const piiWarnings = detectPotentialPiiHints(`${title}
${description}`);
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    piiWarnings
  };
}
function validateCommentContent(content) {
  const trimmed = (content || "").trim();
  if (trimmed.length < 2) {
    return { valid: false, error: "Comment must be at least 2 characters.", piiWarnings: [] };
  }
  if (trimmed.length > 1e3) {
    return { valid: false, error: "Comment cannot exceed 1000 characters.", piiWarnings: [] };
  }
  const piiWarnings = detectPotentialPiiHints(trimmed);
  return { valid: true, piiWarnings };
}
function validateUsername(username) {
  const clean = (username || "").trim().toLowerCase();
  if (clean.length < 3 || clean.length > 32) {
    return "Username must be between 3 and 32 characters.";
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return "Username may only contain lowercase letters, numbers, and underscores.";
  }
  return null;
}
function formatGeneralizedLocation(parts) {
  const list = [parts.locality, parts.block, parts.district, parts.state].map((p) => (p || "").trim()).filter(Boolean);
  return list.join(", ");
}
function canModeratorTransition(currentStatus, action) {
  switch (action) {
    case "start_review":
      if (currentStatus === "submitted" || currentStatus === "additional_information_required") {
        return { allowed: true, nextStatus: "under_review", nextVisibility: "private" };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: "private", reason: "Report is not awaiting initial review." };
    case "request_info":
      if (currentStatus === "submitted" || currentStatus === "under_review") {
        return { allowed: true, nextStatus: "additional_information_required", nextVisibility: "private" };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: "private", reason: "Cannot request info from current status." };
    case "publish":
      if (currentStatus === "submitted" || currentStatus === "under_review" || currentStatus === "additional_information_required" || currentStatus === "removed") {
        return { allowed: true, nextStatus: "published", nextVisibility: "public" };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: "private", reason: "Rejected reports cannot be directly published without resubmission." };
    case "reject":
      if (currentStatus === "submitted" || currentStatus === "under_review" || currentStatus === "additional_information_required") {
        return { allowed: true, nextStatus: "rejected", nextVisibility: "private" };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: "private", reason: "Only pending reports can be rejected." };
    case "remove":
      if (currentStatus === "published") {
        return { allowed: true, nextStatus: "removed", nextVisibility: "private" };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: "private", reason: "Only published reports can be removed." };
  }
}
var MAX_ATTACHMENT_MB = 50;
var MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

// server/ai.ts
async function runModeratorAiAssist(input) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return {
      available: false,
      disclaimer: "AI assistance is optional. Human moderation is always required.",
      error: "GEMINI_API_KEY is not configured in server secrets. Perform manual human review below."
    };
  }
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: [
        "You are an advisory triage assistant for human civic moderators on JanConnect.",
        "NEVER decide whether an allegation is factually true. Only assess category fit, spam signals, possible personal information exposure (phone numbers, Aadhaar, home addresses, minor details), and possible duplicate similarity.",
        `Allowed categories: ${REPORT_CATEGORIES.join(", ")}`,
        `Report Title: ${input.title}`,
        `Report Description: ${input.description}`,
        `Selected Category: ${input.currentCategory}`,
        `Recent Reports in District: ${JSON.stringify(input.recentTitlesInDistrict.slice(0, 12))}`
      ].join("\n\n"),
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedCategory: { type: Type.STRING },
            spamRisk: { type: Type.STRING },
            piiConcerns: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            duplicateSignals: { type: Type.STRING },
            moderatorChecklist: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["suggestedCategory", "spamRisk", "piiConcerns", "duplicateSignals", "moderatorChecklist"]
        }
      }
    });
    const parsed = JSON.parse((response.text ?? "{}").trim());
    return {
      available: true,
      disclaimer: "Advisory AI triage only. AI never decides factual truth; human moderator approval is required.",
      suggestedCategory: parsed.suggestedCategory,
      spamRisk: parsed.spamRisk,
      piiConcerns: parsed.piiConcerns || [],
      duplicateSignals: parsed.duplicateSignals || "No strong duplicate signal detected.",
      moderatorChecklist: parsed.moderatorChecklist || []
    };
  } catch (err) {
    return {
      available: false,
      disclaimer: "AI assistance unavailable. Human moderation is required.",
      error: `AI assist request failed: ${err.message}`
    };
  }
}

// server.ts
initDatabase();
var app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(extractAuthUser);
app.use("/api", verifyCsrfForCookieMutations);
var reportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ATTACHMENT_BYTES,
    files: 3
  }
});
var kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
});
function hasSupabaseServerConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  return Boolean(url && anon && url.startsWith("https://") && !url.includes("YOUR_"));
}
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    backendMode: hasSupabaseServerConfig() ? "supabase-configured" : "local-sqlite-v01",
    supabaseConfigured: hasSupabaseServerConfig(),
    mapsConfigured: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_MAPBOX_ACCESS_TOKEN),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"),
    identityProviderConfigured: isProductionVerificationConfigured(),
    ageConsentGateMode: process.env.VITE_AGE_CONSENT_GATE_MODE || "gated"
  });
});
app.get("/api/locations", (req, res) => {
  const { type, parent_id, state_code } = req.query;
  let sql = `SELECT id, parent_id, name, type, state_code, latitude, longitude FROM locations WHERE 1=1`;
  const params = [];
  if (typeof type === "string" && type) {
    sql += ` AND type = ?`;
    params.push(type);
  }
  if (typeof parent_id === "string" && parent_id) {
    sql += ` AND parent_id = ?`;
    params.push(parent_id);
  }
  if (typeof state_code === "string" && state_code) {
    sql += ` AND state_code = ?`;
    params.push(state_code);
  }
  sql += ` ORDER BY name ASC`;
  const rows = db.prepare(sql).all(...params);
  res.json({ locations: rows });
});
function buildLocationPath(locationId) {
  const map = /* @__PURE__ */ new Map();
  const rows = db.prepare(`SELECT id, parent_id, name, type FROM locations`).all();
  for (const r of rows) map.set(r.id, r);
  let curr = map.get(locationId);
  let locality = null;
  let block = null;
  let district = null;
  let districtId = null;
  let state = null;
  while (curr) {
    if (curr.type === "locality") locality = curr.name;
    if (curr.type === "block") block = curr.name;
    if (curr.type === "district") {
      district = curr.name;
      districtId = curr.id;
    }
    if (curr.type === "state") state = curr.name;
    curr = curr.parent_id ? map.get(curr.parent_id) : void 0;
  }
  return { locality, block, district, state, districtId };
}
app.post("/api/auth/signup", (req, res) => {
  const ip = req.ip || "unknown";
  if (!checkRateLimit(`signup:${ip}`, 12, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many registration attempts. Please try again shortly." });
    return;
  }
  const { email, phone, password, username, displayName, ageConsentAcknowledged } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanPhone = (phone || "").trim();
  const cleanUsername = (username || "").trim().toLowerCase();
  const cleanDisplay = (displayName || "").trim();
  if (!cleanEmail && !cleanPhone) {
    res.status(400).json({ error: "Please provide an email address or mobile number." });
    return;
  }
  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (cleanPhone && !/^(?:\+91)?[6-9]\d{9}$/.test(cleanPhone.replace(/[\s-]/g, ""))) {
    res.status(400).json({ error: "Please enter a valid 10-digit Indian mobile number." });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const usernameErr = validateUsername(cleanUsername);
  if (usernameErr) {
    res.status(400).json({ error: usernameErr });
    return;
  }
  if (cleanDisplay.length < 2 || cleanDisplay.length > 60) {
    res.status(400).json({ error: "Display name must be between 2 and 60 characters." });
    return;
  }
  if (!ageConsentAcknowledged) {
    res.status(400).json({
      error: "Please acknowledge the age, guardian-guidance, and safety terms notice before registering."
    });
    return;
  }
  const normalizedPhone = cleanPhone ? cleanPhone.replace(/[\s-]/g, "").startsWith("+91") ? cleanPhone.replace(/[\s-]/g, "") : `+91${cleanPhone.replace(/[\s-]/g, "")}` : null;
  const existingUsername = db.prepare(`SELECT id FROM profiles WHERE username = ?`).get(cleanUsername);
  if (existingUsername) {
    res.status(409).json({ error: "That username is already taken." });
    return;
  }
  if (cleanEmail) {
    const existingEmail = db.prepare(`SELECT id FROM auth_accounts WHERE email = ?`).get(cleanEmail);
    if (existingEmail) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
  }
  if (normalizedPhone) {
    const existingPhone = db.prepare(`SELECT id FROM auth_accounts WHERE phone_e164 = ?`).get(normalizedPhone);
    if (existingPhone) {
      res.status(409).json({ error: "An account with this mobile number already exists." });
      return;
    }
  }
  const userId = crypto5.randomUUID();
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
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'citizen')`).run(crypto5.randomUUID(), userId);
  });
  tx();
  writeAuditLog({ actorId: userId, action: "citizen_registered", targetType: "profile", targetId: userId });
  const token = signSessionToken(userId);
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user: loadSessionUser(userId) });
});
app.post("/api/auth/login", (req, res) => {
  const ip = req.ip || "unknown";
  if (!checkRateLimit(`login:${ip}`, 20, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many sign-in attempts. Please wait a few minutes." });
    return;
  }
  const { identifier, password } = req.body;
  const cleanId = (identifier || "").trim().toLowerCase();
  if (!cleanId || !password) {
    res.status(400).json({ error: "Email/mobile/username and password are required." });
    return;
  }
  const normalizedPhone = /^[6-9]\d{9}$/.test(cleanId.replace(/[\s-]/g, "")) ? `+91${cleanId.replace(/[\s-]/g, "")}` : cleanId;
  const account = db.prepare(`
      SELECT a.id, a.password_hash
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR a.phone_e164 = ? OR p.username = ?
      LIMIT 1
    `).get(cleanId, normalizedPhone, cleanId);
  if (!account || !verifyPassword(password, account.password_hash)) {
    res.status(401).json({ error: "Invalid credentials." });
    return;
  }
  const user = loadSessionUser(account.id);
  if (!user) {
    res.status(401).json({ error: "Account not found." });
    return;
  }
  if (user.account_status === "suspended") {
    res.status(403).json({ error: "Account suspended. Please review Safety Centre guidance." });
    return;
  }
  const token = signSessionToken(user.id);
  setSessionCookie(req, res, token);
  res.json({ token, user });
});
app.post("/api/auth/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});
app.get("/api/auth/me", (req, res) => {
  if (!req.user) {
    res.json({ user: null });
    return;
  }
  res.json({ user: req.user });
});
function findAccountByIdentifier(rawIdentifier) {
  const cleanId = rawIdentifier.trim().toLowerCase();
  if (!cleanId) return void 0;
  const digits = cleanId.replace(/[\s-]/g, "");
  const normalizedPhone = /^(?:\+91)?[6-9]\d{9}$/.test(digits) ? digits.startsWith("+91") ? digits : `+91${digits}` : cleanId;
  return db.prepare(`
      SELECT a.id, p.account_status
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR a.phone_e164 = ? OR p.username = ?
      LIMIT 1
    `).get(cleanId, normalizedPhone, cleanId);
}
app.post("/api/auth/reset-password", (req, res) => {
  const ipKey = req.ip || "unknown";
  if (!checkRateLimit(`pw-reset-req:${ipKey}`, 5, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many password reset requests. Please wait 15 minutes and try again." });
    return;
  }
  const { identifier } = req.body;
  if (!identifier || identifier.trim().length < 3) {
    res.status(400).json({ error: "Please enter your registered email, mobile number, or username." });
    return;
  }
  const account = findAccountByIdentifier(identifier);
  let previewResetCode;
  if (account && account.account_status !== "suspended") {
    const code = String(crypto5.randomInt(1e5, 999999));
    const codeHash = hashPassword(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
    const tx = db.transaction(() => {
      db.prepare(`UPDATE password_reset_challenges SET consumed = 1 WHERE user_id = ? AND consumed = 0`).run(account.id);
      db.prepare(`
        INSERT INTO password_reset_challenges (id, user_id, code_hash, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(crypto5.randomUUID(), account.id, codeHash, expiresAt);
      writeAuditLog({ actorId: account.id, action: "password_reset_requested", targetType: "profile", targetId: account.id });
    });
    tx();
    const isDevPreview = process.env.NODE_ENV !== "production" && !hasSupabaseServerConfig();
    if (isDevPreview) {
      previewResetCode = code;
    }
  }
  res.json({
    ok: true,
    message: "If an active account matches that email, mobile number, or username, a 6-digit password reset code is ready for the next step.",
    previewResetCode
  });
});
app.post("/api/auth/reset-password/confirm", (req, res) => {
  const ipKey = req.ip || "unknown";
  if (!checkRateLimit(`pw-reset-confirm:${ipKey}`, 10, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many reset confirmation attempts. Please wait and request a new code." });
    return;
  }
  const { identifier, code, newPassword } = req.body;
  if (!identifier || !code || !newPassword) {
    res.status(400).json({ error: "Account identifier, 6-digit reset code, and new password are required." });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: "New password must be between 8 and 128 characters." });
    return;
  }
  const account = findAccountByIdentifier(identifier);
  if (!account) {
    res.status(400).json({ error: "Invalid or expired reset code." });
    return;
  }
  if (account.account_status === "suspended") {
    res.status(403).json({ error: "This account is suspended. Contact safety support." });
    return;
  }
  const challenge = db.prepare(`
      SELECT id, code_hash, attempts, expires_at
      FROM password_reset_challenges
      WHERE user_id = ? AND consumed = 0
      ORDER BY created_at DESC
      LIMIT 1
    `).get(account.id);
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "Reset code expired or not found. Please request a new code." });
    return;
  }
  if (challenge.attempts >= 5) {
    res.status(429).json({ error: "Maximum reset code attempts exceeded. Please request a new reset code." });
    return;
  }
  if (!verifyPassword(code.trim(), challenge.code_hash)) {
    db.prepare(`UPDATE password_reset_challenges SET attempts = attempts + 1 WHERE id = ?`).run(challenge.id);
    res.status(400).json({ error: "Invalid or expired reset code." });
    return;
  }
  const nextHash = hashPassword(newPassword);
  const tx = db.transaction(() => {
    db.prepare(`UPDATE password_reset_challenges SET consumed = 1 WHERE id = ?`).run(challenge.id);
    db.prepare(`UPDATE auth_accounts SET password_hash = ? WHERE id = ?`).run(nextHash, account.id);
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, message)
      VALUES (?, ?, 'security_notice', 'Your JanConnect account password was recently reset.')
    `).run(crypto5.randomUUID(), account.id);
    writeAuditLog({ actorId: account.id, action: "password_reset_completed", targetType: "profile", targetId: account.id });
  });
  tx();
  res.json({ ok: true, message: "Password updated successfully. You can now sign in with your new password." });
});
app.post("/api/auth/change-password", requireAuth, (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current password and new password are required." });
    return;
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    res.status(400).json({ error: "New password must be between 8 and 128 characters." });
    return;
  }
  if (currentPassword === newPassword) {
    res.status(400).json({ error: "New password must be different from your current password." });
    return;
  }
  const account = db.prepare(`SELECT password_hash FROM auth_accounts WHERE id = ?`).get(userId);
  if (!account || !verifyPassword(currentPassword, account.password_hash)) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }
  db.prepare(`UPDATE auth_accounts SET password_hash = ? WHERE id = ?`).run(hashPassword(newPassword), userId);
  writeAuditLog({ actorId: userId, action: "password_changed", targetType: "profile", targetId: userId });
  res.json({ ok: true, message: "Password changed successfully." });
});
app.post("/api/auth/verify-phone/request", requireAuth, (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`otp-req:${userId}`, 5, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "OTP rate limit reached. Please wait before requesting another code." });
    return;
  }
  const { phone } = req.body;
  const cleaned = (phone || "").replace(/[\s-]/g, "");
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(cleaned)) {
    res.status(400).json({ error: "Enter a valid 10-digit Indian mobile number." });
    return;
  }
  const e164 = cleaned.startsWith("+91") ? cleaned : `+91${cleaned}`;
  const code = String(crypto5.randomInt(1e5, 999999));
  const codeHash = hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1e3).toISOString();
  db.prepare(`INSERT INTO otp_challenges (id, user_id, phone_e164, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)`).run(
    crypto5.randomUUID(),
    userId,
    e164,
    codeHash,
    expiresAt
  );
  writeAuditLog({ actorId: userId, action: "phone_otp_requested", targetType: "profile", targetId: userId });
  const isDevPreview = process.env.NODE_ENV !== "production" && !hasSupabaseServerConfig();
  res.json({
    ok: true,
    note: "Phone OTP verifies control of your phone number only; it is not proof of identity or age.",
    previewOtp: isDevPreview ? code : void 0,
    smsConfigured: hasSupabaseServerConfig()
  });
});
app.post("/api/auth/verify-phone/confirm", requireAuth, (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`otp-confirm:${userId}`, 10, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many OTP verification attempts." });
    return;
  }
  const { code } = req.body;
  if (!code || !/^\d{6}$/.test(code.trim())) {
    res.status(400).json({ error: "Enter the 6-digit verification code." });
    return;
  }
  const challenge = db.prepare(`
      SELECT id, phone_e164, code_hash, attempts, expires_at
      FROM otp_challenges
      WHERE user_id = ? AND consumed = 0
      ORDER BY created_at DESC LIMIT 1
    `).get(userId);
  if (!challenge) {
    res.status(400).json({ error: "No active OTP challenge found. Request a new code." });
    return;
  }
  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: "OTP expired. Request a new code." });
    return;
  }
  if (challenge.attempts >= 5) {
    res.status(429).json({ error: "Maximum OTP attempts exceeded for this code." });
    return;
  }
  if (!verifyPassword(code.trim(), challenge.code_hash)) {
    db.prepare(`UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?`).run(challenge.id);
    res.status(400).json({ error: "Incorrect OTP code." });
    return;
  }
  db.prepare(`UPDATE otp_challenges SET consumed = 1 WHERE id = ?`).run(challenge.id);
  db.prepare(`UPDATE auth_accounts SET phone_e164 = ? WHERE id = ?`).run(challenge.phone_e164, userId);
  db.prepare(`UPDATE profiles SET phone_verified = 1, updated_at = datetime('now') WHERE id = ?`).run(userId);
  writeAuditLog({ actorId: userId, action: "phone_control_verified", targetType: "profile", targetId: userId });
  res.json({ ok: true, user: loadSessionUser(userId) });
});
app.get("/api/verification/status", requireAuth, (req, res) => {
  const verification = getUserVerificationSummary(req.user.id);
  res.json({ verification, user: loadSessionUser(req.user.id) });
});
app.post("/api/verification/national-id", requireAuth, kycUpload.single("idDocument"), (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`national-id:${userId}`, 5, 60 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many National ID verification attempts. Please wait before trying again." });
    return;
  }
  const { idType, legalName, idNumber } = req.body;
  if (!idType || !legalName || !idNumber) {
    res.status(400).json({ error: "National ID type, legal name, and ID number are required." });
    return;
  }
  try {
    const verification = submitNationalIdVerification({
      userId,
      idType,
      legalName,
      idNumber,
      documentBuffer: req.file?.buffer ?? null
    });
    res.status(201).json({ ok: true, verification, user: loadSessionUser(userId) });
  } catch (err) {
    if (err instanceof DuplicateNationalIdError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/verification/session", requireAuth, (req, res) => {
  try {
    const result = startVerificationSession(req.user.id);
    res.json({ session: result, user: loadSessionUser(req.user.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.post("/api/verification/complete-test", requireAuth, (req, res) => {
  const { sessionToken } = req.body || {};
  try {
    completeTestVerificationSession(req.user.id, sessionToken);
    res.json({ ok: true, verification: getUserVerificationSummary(req.user.id), user: loadSessionUser(req.user.id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.patch("/api/profile", requireAuth, (req, res) => {
  const userId = req.user.id;
  const { displayName, bio, locationId, avatarUrl } = req.body;
  if (displayName !== void 0 && (displayName.trim().length < 2 || displayName.trim().length > 60)) {
    res.status(400).json({ error: "Display name must be between 2 and 60 characters." });
    return;
  }
  if (bio !== void 0 && bio.trim().length > 240) {
    res.status(400).json({ error: "Bio must be 240 characters or fewer." });
    return;
  }
  if (locationId) {
    const loc = db.prepare(`SELECT id FROM locations WHERE id = ?`).get(locationId);
    if (!loc) {
      res.status(400).json({ error: "Selected location does not exist." });
      return;
    }
  }
  if (avatarUrl && !avatarUrl.startsWith("https://") && !avatarUrl.startsWith("/src/assets/")) {
    res.status(400).json({ error: "Invalid avatar URL." });
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
    displayName !== void 0 ? displayName.trim() : null,
    bio !== void 0 ? bio.trim() : null,
    locationId ?? null,
    avatarUrl ?? null,
    userId
  );
  res.json({ user: loadSessionUser(userId) });
});
app.get("/api/profiles/:username", (req, res) => {
  const username = req.params.username.toLowerCase();
  const profile = db.prepare(`
      SELECT p.id, p.username, p.display_name, p.avatar_url, p.bio, p.location_id, p.identity_status, p.created_at
      FROM profiles p
      WHERE p.username = ? AND p.account_status = 'active'
    `).get(username);
  if (!profile) {
    res.status(404).json({ error: "Citizen profile not found." });
    return;
  }
  const locParts = profile.location_id ? buildLocationPath(profile.location_id) : null;
  const generalArea = locParts ? formatGeneralizedLocation({
    locality: locParts.locality,
    block: locParts.block,
    district: locParts.district,
    state: locParts.state
  }) : null;
  const publishedReports = db.prepare(`
      SELECT id, title, category, generalized_location, platform_status, published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = complaints.id) AS support_count
      FROM complaints
      WHERE user_id = ? AND platform_status = 'published' AND visibility = 'public'
      ORDER BY published_at DESC
    `).all(profile.id);
  res.json({
    profile: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      general_area: generalArea,
      created_at: profile.created_at
    },
    publishedReports
  });
});
app.get("/api/reports/public", (req, res) => {
  const { q, category, state_id, district_id, block_id, locality_id, sort, page, limit } = req.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const pageSize = Math.min(30, Math.max(1, Number(limit) || 12));
  const offset = (pageNum - 1) * pageSize;
  let where = `WHERE c.platform_status = 'published' AND c.visibility = 'public'`;
  const params = [];
  if (typeof q === "string" && q.trim()) {
    const term = `%${q.trim()}%`;
    where += ` AND (c.title LIKE ? OR c.description LIKE ? OR c.generalized_location LIKE ?)`;
    params.push(term, term, term);
  }
  if (typeof category === "string" && category && category !== "all") {
    where += ` AND c.category = ?`;
    params.push(category);
  }
  const targetLocId = typeof locality_id === "string" && locality_id || typeof block_id === "string" && block_id || typeof district_id === "string" && district_id || typeof state_id === "string" && state_id || "";
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
  const orderBy = sort === "most_supported" ? `ORDER BY support_count DESC, c.published_at DESC` : `ORDER BY c.published_at DESC, c.created_at DESC`;
  const totalRow = db.prepare(`SELECT COUNT(*) AS count FROM complaints c ${where}`).get(...params);
  const rows = db.prepare(`
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
    `).all(...params, pageSize, offset);
  const enriched = rows.map((r) => {
    const locPath = buildLocationPath(r.location_id);
    return {
      ...r,
      district_id: locPath.districtId,
      district_name: locPath.district,
      preview_media_url: r.preview_media_id ? `/api/media/published/${r.preview_media_id}` : null,
      user_has_supported: req.user ? Boolean(
        db.prepare(`SELECT 1 FROM complaint_support WHERE complaint_id = ? AND user_id = ?`).get(r.id, req.user.id)
      ) : false
    };
  });
  res.json({
    reports: enriched,
    total: totalRow.count,
    page: pageNum,
    pageSize
  });
});
app.get("/api/reports/public/:id", (req, res) => {
  const report = db.prepare(`
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
    `).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Published report not found or awaiting moderation." });
    return;
  }
  const media = db.prepare(`SELECT id, media_type FROM complaint_media WHERE complaint_id = ? AND review_status = 'approved'`).all(req.params.id);
  const comments = db.prepare(`
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
    `).all(req.params.id);
  const history = db.prepare(`
      SELECT id, previous_status, new_status, reason, created_at
      FROM complaint_status_history
      WHERE complaint_id = ? AND new_status IN ('submitted', 'under_review', 'published')
      ORDER BY created_at ASC
    `).all(req.params.id);
  const userHasSupported = req.user ? Boolean(
    db.prepare(`SELECT 1 FROM complaint_support WHERE complaint_id = ? AND user_id = ?`).get(req.params.id, req.user.id)
  ) : false;
  res.json({
    report: {
      ...report,
      user_has_supported: userHasSupported,
      media: media.map((m) => ({
        id: m.id,
        media_type: m.media_type,
        url: `/api/media/published/${m.id}`
      }))
    },
    comments,
    history
  });
});
app.post("/api/reports/:id/support", requireAuth, (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`support:${userId}`, 30, 60 * 1e3)) {
    res.status(429).json({ error: "Rate limit reached for support actions." });
    return;
  }
  const report = db.prepare(`SELECT id FROM complaints WHERE id = ? AND platform_status = 'published' AND visibility = 'public'`).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Published report not found." });
    return;
  }
  try {
    db.prepare(`INSERT INTO complaint_support (id, complaint_id, user_id) VALUES (?, ?, ?)`).run(
      crypto5.randomUUID(),
      req.params.id,
      userId
    );
  } catch {
  }
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM complaint_support WHERE complaint_id = ?`).get(req.params.id);
  res.json({ supported: true, support_count: countRow.count });
});
app.delete("/api/reports/:id/support", requireAuth, (req, res) => {
  const userId = req.user.id;
  db.prepare(`DELETE FROM complaint_support WHERE complaint_id = ? AND user_id = ?`).run(req.params.id, userId);
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM complaint_support WHERE complaint_id = ?`).get(req.params.id);
  res.json({ supported: false, support_count: countRow.count });
});
app.post("/api/reports/:id/comments", requireAuth, (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`comment:${userId}`, 10, 10 * 60 * 1e3)) {
    res.status(429).json({ error: "Comment rate limit reached. Please wait a few minutes." });
    return;
  }
  const report = db.prepare(`SELECT id, user_id, title FROM complaints WHERE id = ? AND platform_status = 'published' AND visibility = 'public'`).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Published report not found." });
    return;
  }
  const { content } = req.body;
  const validation = validateCommentContent(content || "");
  if (!validation.valid) {
    res.status(400).json({ error: validation.error });
    return;
  }
  const commentId = crypto5.randomUUID();
  db.prepare(`INSERT INTO complaint_comments (id, complaint_id, user_id, content) VALUES (?, ?, ?, ?)`).run(
    commentId,
    report.id,
    userId,
    content.trim()
  );
  if (report.user_id !== userId) {
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'new_comment', ?, ?)
    `).run(
      crypto5.randomUUID(),
      report.user_id,
      report.id,
      `A community member commented on your published report "${report.title}".`
    );
  }
  res.status(201).json({
    comment: {
      id: commentId,
      content: content.trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      author_username: req.user.username,
      author_display_name: req.user.display_name
    }
  });
});
app.post("/api/content-reports", requireAuth, (req, res) => {
  const userId = req.user.id;
  if (!checkRateLimit(`flag:${userId}`, 10, 30 * 60 * 1e3)) {
    res.status(429).json({ error: "Report flag limit reached." });
    return;
  }
  const { targetType, targetId, reason } = req.body;
  if (!targetType || !["complaint", "comment", "user"].includes(targetType) || !targetId) {
    res.status(400).json({ error: "Valid target type and ID are required." });
    return;
  }
  if (!reason || reason.trim().length < 5 || reason.trim().length > 600) {
    res.status(400).json({ error: "Reason must be between 5 and 600 characters." });
    return;
  }
  const flagId = crypto5.randomUUID();
  db.prepare(`
    INSERT INTO reports (id, reporter_id, target_type, target_id, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(flagId, userId, targetType, targetId, reason.trim());
  writeAuditLog({
    actorId: userId,
    action: "content_flagged",
    targetType,
    targetId,
    metadata: { flagId }
  });
  res.status(201).json({ ok: true, id: flagId });
});
app.post("/api/reports", requireAuth, reportUpload.array("attachments", 3), (req, res) => {
  const user = req.user;
  if (!checkRateLimit(`submit:${user.id}`, 6, 60 * 60 * 1e3)) {
    res.status(429).json({ error: "Report submission rate limit reached. Please try again later." });
    return;
  }
  if (user.identity_status !== "verified") {
    res.status(403).json({
      error: "Please complete the citizen verification step before submitting a report.",
      code: "IDENTITY_VERIFICATION_REQUIRED"
    });
    return;
  }
  const body = req.body;
  const lat = body.approximateLat ? Number(body.approximateLat) : null;
  const lng = body.approximateLng ? Number(body.approximateLng) : null;
  const validation = validateReportDraft({
    title: body.title || "",
    description: body.description || "",
    category: body.category || "",
    stateId: body.stateId || "",
    districtId: body.districtId || "",
    blockId: body.blockId || "",
    localityId: body.localityId || "",
    approximateLat: Number.isFinite(lat) ? lat : null,
    approximateLng: Number.isFinite(lng) ? lng : null
  });
  if (!validation.valid) {
    res.status(400).json({ error: "Please fix the highlighted form errors.", errors: validation.errors });
    return;
  }
  const locCheck = db.prepare(`SELECT id FROM locations WHERE id = ?`).get(body.localityId);
  if (!locCheck) {
    res.status(400).json({ error: "Selected locality was not found." });
    return;
  }
  const locParts = buildLocationPath(body.localityId);
  const generalizedLocation = formatGeneralizedLocation({
    locality: locParts.locality,
    block: locParts.block,
    district: locParts.district,
    state: locParts.state
  });
  const files = req.files || [];
  const savedMedia = [];
  try {
    for (const file of files) {
      savedMedia.push(savePendingMedia(file.buffer));
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
    return;
  }
  const reportId = crypto5.randomUUID();
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
      body.title.trim(),
      body.description.trim(),
      body.category,
      body.localityId,
      generalizedLocation,
      Number.isFinite(lat) ? lat : null,
      Number.isFinite(lng) ? lng : null,
      body.urgencyNote?.trim() || null
    );
    for (const m of savedMedia) {
      db.prepare(`
        INSERT INTO complaint_media (id, complaint_id, uploader_id, storage_path, media_type, review_status)
        VALUES (?, ?, ?, ?, ?, 'pending')
      `).run(crypto5.randomUUID(), reportId, user.id, m.storagePath, m.mediaType);
    }
    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, previous_status, new_status, actor_id, reason)
      VALUES (?, ?, NULL, 'submitted', ?, 'Submitted by citizen into private moderation queue')
    `).run(crypto5.randomUUID(), reportId, user.id);
  });
  tx();
  writeAuditLog({
    actorId: user.id,
    action: "report_submitted",
    targetType: "complaint",
    targetId: reportId,
    metadata: { category: body.category }
  });
  res.status(201).json({
    id: reportId,
    platform_status: "submitted",
    visibility: "private",
    generalized_location: generalizedLocation
  });
});
app.get("/api/reports/my", requireAuth, (req, res) => {
  const rows = db.prepare(`
      SELECT
        c.id, c.title, c.description, c.category, c.generalized_location,
        c.platform_status, c.visibility, c.created_at, c.updated_at, c.published_at,
        (SELECT COUNT(*) FROM complaint_support s WHERE s.complaint_id = c.id) AS support_count
      FROM complaints c
      WHERE c.user_id = ?
      ORDER BY c.created_at DESC
    `).all(req.user.id);
  res.json({ reports: rows });
});
app.get("/api/reports/my/:id", requireAuth, (req, res) => {
  const report = db.prepare(`
      SELECT
        id, user_id, title, description, category, location_id, generalized_location,
        urgency_note, platform_status, visibility, created_at, updated_at, published_at
      FROM complaints
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  const media = db.prepare(`SELECT id, media_type, review_status FROM complaint_media WHERE complaint_id = ?`).all(req.params.id);
  const history = db.prepare(`
      SELECT id, previous_status, new_status, reason, created_at
      FROM complaint_status_history
      WHERE complaint_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id);
  res.json({
    report,
    media: media.map((m) => ({
      ...m,
      url: m.review_status === "approved" ? `/api/media/published/${m.id}` : `/api/media/pending/${m.id}`
    })),
    history
  });
});
app.get("/api/media/published/:id", (req, res) => {
  const row = db.prepare(`
      SELECT m.storage_path, m.media_type
      FROM complaint_media m
      JOIN complaints c ON c.id = m.complaint_id
      WHERE m.id = ? AND m.review_status = 'approved' AND c.platform_status = 'published' AND c.visibility = 'public'
    `).get(req.params.id);
  if (!row) {
    res.status(404).send("Not found");
    return;
  }
  const filePath = resolveSafeMediaPath("published", row.storage_path);
  if (!filePath) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Type", row.media_type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});
app.get("/api/media/pending/:id", requireAuth, (req, res) => {
  const row = db.prepare(`SELECT storage_path, media_type, uploader_id FROM complaint_media WHERE id = ?`).get(req.params.id);
  if (!row) {
    res.status(404).send("Not found");
    return;
  }
  const isMod = req.user.roles.includes("moderator") || req.user.roles.includes("administrator");
  if (row.uploader_id !== req.user.id && !isMod) {
    res.status(403).send("Forbidden");
    return;
  }
  const filePath = resolveSafeMediaPath("pending", row.storage_path);
  if (!filePath) {
    res.status(404).send("Not found");
    return;
  }
  res.setHeader("Content-Type", row.media_type);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(filePath);
});
app.get("/api/notifications", requireAuth, (req, res) => {
  const rows = db.prepare(`
      SELECT id, type, related_id, message, is_read, created_at
      FROM notifications
      WHERE recipient_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(req.user.id);
  res.json({ notifications: rows });
});
app.patch("/api/notifications/:id/read", requireAuth, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE id = ? AND recipient_id = ?`).run(
    req.params.id,
    req.user.id
  );
  res.json({ ok: true });
});
app.post("/api/notifications/read-all", requireAuth, (req, res) => {
  db.prepare(`UPDATE notifications SET is_read = 1 WHERE recipient_id = ?`).run(req.user.id);
  res.json({ ok: true });
});
app.get("/api/admin/bootstrap-status", (_req, res) => {
  const modExists = db.prepare(`SELECT COUNT(*) AS count FROM user_roles WHERE role IN ('moderator', 'administrator')`).get();
  const passcodeConfigured = Boolean(process.env.MODERATOR_PASSCODE && process.env.MODERATOR_PASSCODE.trim());
  res.json({
    needsSetup: modExists.count === 0 && !passcodeConfigured,
    passcodeConfigured
  });
});
app.post("/api/admin/claim", (req, res) => {
  const modExists = db.prepare(`SELECT COUNT(*) AS count FROM user_roles WHERE role IN ('moderator', 'administrator')`).get();
  const passcodeConfigured = Boolean(process.env.MODERATOR_PASSCODE && process.env.MODERATOR_PASSCODE.trim());
  if (modExists.count > 0 || passcodeConfigured) {
    res.status(409).json({ error: "Initial moderator setup has already been completed or is managed by MODERATOR_PASSCODE." });
    return;
  }
  const { email, username, displayName, password } = req.body;
  const cleanEmail = (email || "").trim().toLowerCase();
  const cleanUsername = (username || "").trim().toLowerCase();
  const cleanDisplay = (displayName || "").trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    res.status(400).json({ error: "Valid email is required." });
    return;
  }
  const userErr = validateUsername(cleanUsername);
  if (userErr) {
    res.status(400).json({ error: userErr });
    return;
  }
  if (!password || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }
  const userId = crypto5.randomUUID();
  const pwHash = hashPassword(password);
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO auth_accounts (id, email, password_hash) VALUES (?, ?, ?)`).run(userId, cleanEmail, pwHash);
    db.prepare(`
      INSERT INTO profiles (id, username, display_name, account_status, phone_verified, identity_status, age_consent_acknowledged)
      VALUES (?, ?, ?, 'active', 0, 'verified', 1)
    `).run(userId, cleanUsername, cleanDisplay || "Lead Moderator");
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'administrator')`).run(crypto5.randomUUID(), userId);
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'moderator')`).run(crypto5.randomUUID(), userId);
  });
  tx();
  writeAuditLog({ actorId: userId, action: "initial_moderator_claimed", targetType: "profile", targetId: userId });
  const token = signSessionToken(userId);
  setSessionCookie(req, res, token);
  res.status(201).json({ token, user: loadSessionUser(userId) });
});
app.post("/api/admin/login", (req, res) => {
  const ip = req.ip || "unknown";
  if (!checkRateLimit(`admin-login:${ip}`, 15, 15 * 60 * 1e3)) {
    res.status(429).json({ error: "Too many moderator login attempts." });
    return;
  }
  const { identifier, password, passcode } = req.body;
  const envPasscode = process.env.MODERATOR_PASSCODE?.trim();
  if (envPasscode) {
    if (!passcode || passcode !== envPasscode) {
      res.status(401).json({ error: "Invalid moderator passcode." });
      return;
    }
    const opEmail = "operator@janconnect.local";
    let opAccount = db.prepare(`SELECT id FROM auth_accounts WHERE email = ?`).get(opEmail);
    if (!opAccount) {
      const uid = crypto5.randomUUID();
      db.prepare(`INSERT INTO auth_accounts (id, email, password_hash) VALUES (?, ?, ?)`).run(
        uid,
        opEmail,
        hashPassword(crypto5.randomBytes(24).toString("hex"))
      );
      db.prepare(`
        INSERT INTO profiles (id, username, display_name, account_status, identity_status, age_consent_acknowledged)
        VALUES (?, 'janconnect_mod', 'JanConnect Moderator', 'active', 'verified', 1)
      `).run(uid);
      db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'administrator')`).run(crypto5.randomUUID(), uid);
      db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'moderator')`).run(crypto5.randomUUID(), uid);
      opAccount = { id: uid };
    }
    const token2 = signSessionToken(opAccount.id);
    setSessionCookie(req, res, token2);
    res.json({ token: token2, user: loadSessionUser(opAccount.id) });
    return;
  }
  const cleanId = (identifier || "").trim().toLowerCase();
  if (!cleanId || !password) {
    res.status(400).json({ error: "Moderator email/username and password are required." });
    return;
  }
  const account = db.prepare(`
      SELECT a.id, a.password_hash
      FROM auth_accounts a
      JOIN profiles p ON p.id = a.id
      WHERE a.email = ? OR p.username = ?
      LIMIT 1
    `).get(cleanId, cleanId);
  if (!account || !verifyPassword(password, account.password_hash)) {
    res.status(401).json({ error: "Invalid moderator credentials." });
    return;
  }
  const user = loadSessionUser(account.id);
  if (!user || !user.roles.includes("moderator") && !user.roles.includes("administrator")) {
    res.status(403).json({ error: "This account does not have moderator authorization." });
    return;
  }
  const token = signSessionToken(user.id);
  setSessionCookie(req, res, token);
  res.json({ token, user });
});
app.get("/api/admin/analytics", requireModerator, (_req, res) => {
  const counts = db.prepare(`
      SELECT
        COUNT(*) AS total_submitted,
        SUM(CASE WHEN platform_status IN ('submitted', 'under_review', 'additional_information_required') THEN 1 ELSE 0 END) AS pending_moderation,
        SUM(CASE WHEN platform_status = 'published' THEN 1 ELSE 0 END) AS published_reports,
        SUM(CASE WHEN platform_status = 'rejected' THEN 1 ELSE 0 END) AS rejected_reports,
        SUM(CASE WHEN platform_status = 'removed' THEN 1 ELSE 0 END) AS removed_reports
      FROM complaints
    `).get();
  const reportedContent = db.prepare(`SELECT COUNT(*) AS count FROM reports WHERE review_status = 'pending'`).get();
  const pendingVerifications = db.prepare(`SELECT COUNT(*) AS count FROM verification_records WHERE verification_status = 'pending' AND id_type IS NOT NULL`).get();
  const byCategory = db.prepare(`SELECT category, COUNT(*) AS count FROM complaints GROUP BY category ORDER BY count DESC`).all();
  const allReportsLoc = db.prepare(`SELECT location_id FROM complaints`).all();
  const districtMap = /* @__PURE__ */ new Map();
  for (const r of allReportsLoc) {
    const loc = buildLocationPath(r.location_id);
    const dName = loc.district || "Unassigned";
    districtMap.set(dName, (districtMap.get(dName) || 0) + 1);
  }
  const byDistrict = Array.from(districtMap.entries()).map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count);
  res.json({
    metrics: {
      totalSubmitted: counts.total_submitted || 0,
      pendingModeration: counts.pending_moderation || 0,
      publishedReports: counts.published_reports || 0,
      rejectedReports: counts.rejected_reports || 0,
      removedReports: counts.removed_reports || 0,
      reportedContent: reportedContent.count || 0,
      pendingVerifications: pendingVerifications.count || 0
    },
    byCategory,
    byDistrict
  });
});
app.get("/api/admin/verifications", requireModerator, (req, res) => {
  const { status } = req.query;
  let where = `WHERE vr.id_type IS NOT NULL`;
  const params = [];
  if (typeof status === "string" && ["pending", "verified", "rejected"].includes(status)) {
    where += ` AND vr.verification_status = ?`;
    params.push(status);
  } else {
    where += ` AND vr.verification_status != 'expired'`;
  }
  const rows = db.prepare(`
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
    `).all(...params);
  res.json({
    verifications: rows.map((r) => ({
      ...r,
      has_document: Boolean(r.has_document),
      phone_verified: Boolean(r.phone_verified)
    }))
  });
});
app.get("/api/admin/verifications/:id/document", requireModerator, (req, res) => {
  const rec = db.prepare(`SELECT document_storage_path, document_media_type FROM verification_records WHERE id = ?`).get(req.params.id);
  if (!rec || !rec.document_storage_path) {
    res.status(404).json({ error: "No ID document attached to this verification record." });
    return;
  }
  const filePath = resolveRestrictedKycPath(rec.document_storage_path);
  if (!filePath) {
    res.status(404).json({ error: "Document file not found." });
    return;
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (rec.document_media_type) {
    res.setHeader("Content-Type", rec.document_media_type);
  }
  res.sendFile(filePath);
});
app.post("/api/admin/verifications/:id/review", requireModerator, (req, res) => {
  const { decision, reason } = req.body;
  if (decision !== "approve" && decision !== "reject") {
    res.status(400).json({ error: "Decision must be approve or reject." });
    return;
  }
  if (!reason || reason.trim().length < 5) {
    res.status(400).json({ error: "Please provide a review reason (at least 5 characters)." });
    return;
  }
  try {
    const result = reviewNationalIdVerification({
      recordId: req.params.id,
      moderatorId: req.user.id,
      decision,
      reason
    });
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
app.get("/api/admin/reports", requireModerator, (req, res) => {
  const { status, q } = req.query;
  let where = `WHERE 1=1`;
  const params = [];
  if (status === "pending") {
    where += ` AND c.platform_status IN ('submitted', 'under_review', 'additional_information_required')`;
  } else if (typeof status === "string" && status && status !== "all") {
    where += ` AND c.platform_status = ?`;
    params.push(status);
  }
  if (typeof q === "string" && q.trim()) {
    const term = `%${q.trim()}%`;
    where += ` AND (c.title LIKE ? OR c.generalized_location LIKE ? OR p.username LIKE ?)`;
    params.push(term, term, term);
  }
  const rows = db.prepare(`
      SELECT
        c.id, c.title, c.category, c.generalized_location, c.platform_status, c.visibility,
        c.created_at, c.published_at,
        p.username AS author_username, p.display_name AS author_display_name,
        (SELECT COUNT(*) FROM complaint_media m WHERE m.complaint_id = c.id) AS media_count
      FROM complaints c
      JOIN profiles p ON p.id = c.user_id
      ${where}
      ORDER BY c.created_at DESC
    `).all(...params);
  res.json({ reports: rows });
});
app.get("/api/admin/reports/:id", requireModerator, (req, res) => {
  const report = db.prepare(`
      SELECT
        c.*, p.username AS author_username, p.display_name AS author_display_name,
        p.account_status AS author_account_status, p.identity_status AS author_identity_status
      FROM complaints c
      JOIN profiles p ON p.id = c.user_id
      WHERE c.id = ?
    `).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  const media = db.prepare(`SELECT id, media_type, review_status FROM complaint_media WHERE complaint_id = ?`).all(req.params.id);
  const actions = db.prepare(`
      SELECT ma.*, p.username AS moderator_username
      FROM moderation_actions ma
      JOIN profiles p ON p.id = ma.moderator_id
      WHERE ma.complaint_id = ?
      ORDER BY ma.created_at DESC
    `).all(req.params.id);
  const history = db.prepare(`SELECT * FROM complaint_status_history WHERE complaint_id = ? ORDER BY created_at DESC`).all(req.params.id);
  const potentialDuplicates = db.prepare(`
      SELECT id, title, platform_status, generalized_location, created_at
      FROM complaints
      WHERE id != ? AND category = ?
      ORDER BY created_at DESC
      LIMIT 5
    `).all(req.params.id, report.category);
  res.json({
    report,
    media: media.map((m) => ({
      ...m,
      url: m.review_status === "approved" ? `/api/media/published/${m.id}` : `/api/media/pending/${m.id}`
    })),
    actions,
    history,
    potentialDuplicates
  });
});
app.post("/api/admin/reports/:id/moderate", requireModerator, (req, res) => {
  const { action, reason } = req.body;
  if (!action || !reason || reason.trim().length < 5) {
    res.status(400).json({ error: "A moderation action and clear reason (at least 5 characters) are required." });
    return;
  }
  const report = db.prepare(`SELECT id, user_id, title, platform_status FROM complaints WHERE id = ?`).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  const transition = canModeratorTransition(report.platform_status, action);
  if (!transition.allowed) {
    res.status(400).json({ error: transition.reason || "Invalid moderation status transition." });
    return;
  }
  const modId = req.user.id;
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
    `).run(crypto5.randomUUID(), modId, report.id, action, cleanReason, report.platform_status, transition.nextStatus);
    db.prepare(`
      INSERT INTO complaint_status_history (id, complaint_id, previous_status, new_status, actor_id, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(crypto5.randomUUID(), report.id, report.platform_status, transition.nextStatus, modId, cleanReason);
    if (action === "publish") {
      const mediaRows = db.prepare(`SELECT id, storage_path FROM complaint_media WHERE complaint_id = ?`).all(report.id);
      for (const m of mediaRows) {
        promotePendingToPublished(m.storage_path);
      }
      db.prepare(`UPDATE complaint_media SET review_status = 'approved' WHERE complaint_id = ?`).run(report.id);
    }
    const notifMessage = action === "publish" ? `Your report "${report.title}" is now published on JanConnect.` : action === "request_info" ? `A JanConnect moderator requested more context on "${report.title}": ${cleanReason}` : action === "reject" ? `Your report "${report.title}" was not published: ${cleanReason}` : action === "remove" ? `Your report "${report.title}" was removed from public view: ${cleanReason}` : `Your report "${report.title}" is now under JanConnect moderation review.`;
    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, ?, ?, ?)
    `).run(crypto5.randomUUID(), report.user_id, `report_${transition.nextStatus}`, report.id, notifMessage);
  });
  tx();
  writeAuditLog({
    actorId: modId,
    action: `moderation_${action}`,
    targetType: "complaint",
    targetId: report.id,
    metadata: { previous_status: report.platform_status, new_status: transition.nextStatus, reason: cleanReason }
  });
  res.json({ ok: true, new_status: transition.nextStatus, visibility: transition.nextVisibility });
});
app.post("/api/admin/reports/:id/ai-assist", requireModerator, async (req, res) => {
  const report = db.prepare(`SELECT id, title, description, category, location_id FROM complaints WHERE id = ?`).get(req.params.id);
  if (!report) {
    res.status(404).json({ error: "Report not found." });
    return;
  }
  const recent = db.prepare(`
      SELECT id, title, generalized_location
      FROM complaints
      WHERE id != ?
      ORDER BY created_at DESC
      LIMIT 15
    `).all(report.id);
  const result = await runModeratorAiAssist({
    title: report.title,
    description: report.description,
    currentCategory: report.category,
    recentTitlesInDistrict: recent
  });
  res.json(result);
});
app.get("/api/admin/content-reports", requireModerator, (_req, res) => {
  const flags = db.prepare(`
      SELECT
        r.*, p.username AS reporter_username
      FROM reports r
      JOIN profiles p ON p.id = r.reporter_id
      ORDER BY r.created_at DESC
    `).all();
  const users = db.prepare(`
      SELECT p.id, p.username, p.display_name, p.account_status, p.identity_status, p.created_at
      FROM profiles p
      ORDER BY p.created_at DESC
      LIMIT 100
    `).all();
  res.json({ flags, users });
});
app.post("/api/admin/content-reports/:id/resolve", requireModerator, (req, res) => {
  const { decision, reason } = req.body;
  if (!decision || !["dismiss", "remove_target"].includes(decision)) {
    res.status(400).json({ error: "Invalid resolution decision." });
    return;
  }
  const flag = db.prepare(`SELECT * FROM reports WHERE id = ?`).get(req.params.id);
  if (!flag) {
    res.status(404).json({ error: "Content report not found." });
    return;
  }
  const modId = req.user.id;
  const tx = db.transaction(() => {
    const nextStatus = decision === "dismiss" ? "dismissed" : "resolved_removed";
    db.prepare(`UPDATE reports SET review_status = ? WHERE id = ?`).run(nextStatus, flag.id);
    if (decision === "remove_target") {
      if (flag.target_type === "comment") {
        db.prepare(`UPDATE complaint_comments SET moderation_status = 'removed', updated_at = datetime('now') WHERE id = ?`).run(
          flag.target_id
        );
      } else if (flag.target_type === "complaint") {
        db.prepare(`UPDATE complaints SET platform_status = 'removed', visibility = 'private', updated_at = datetime('now') WHERE id = ?`).run(
          flag.target_id
        );
      } else if (flag.target_type === "user") {
        db.prepare(`UPDATE profiles SET account_status = 'restricted', updated_at = datetime('now') WHERE id = ?`).run(flag.target_id);
        db.prepare(`
          INSERT INTO notifications (id, recipient_id, type, message)
          VALUES (?, ?, 'safety_notice', ?)
        `).run(
          crypto5.randomUUID(),
          flag.target_id,
          `Account safety notice: ${reason || "Your account was restricted following a safety review."}`
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
    metadata: { reason: reason || "" }
  });
  res.json({ ok: true });
});
app.post("/api/admin/users/:id/status", requireModerator, (req, res) => {
  const { status, reason } = req.body;
  if (!status || !["active", "restricted", "suspended"].includes(status)) {
    res.status(400).json({ error: "Invalid account status." });
    return;
  }
  if (req.params.id === req.user.id) {
    res.status(400).json({ error: "Moderators cannot change their own account status." });
    return;
  }
  db.prepare(`UPDATE profiles SET account_status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, req.params.id);
  db.prepare(`
    INSERT INTO notifications (id, recipient_id, type, message)
    VALUES (?, ?, 'safety_notice', ?)
  `).run(
    crypto5.randomUUID(),
    req.params.id,
    `Your account status was updated to ${status}. ${reason ? `Note: ${reason}` : ""}`
  );
  writeAuditLog({
    actorId: req.user.id,
    action: "user_status_updated",
    targetType: "profile",
    targetId: req.params.id,
    metadata: { status, reason: reason || "" }
  });
  res.json({ ok: true });
});
app.get("/api/admin/moderation-history", requireModerator, (_req, res) => {
  const actions = db.prepare(`
      SELECT ma.*, p.username AS moderator_username, c.title AS report_title
      FROM moderation_actions ma
      JOIN profiles p ON p.id = ma.moderator_id
      JOIN complaints c ON c.id = ma.complaint_id
      ORDER BY ma.created_at DESC
      LIMIT 100
    `).all();
  const auditLogs = db.prepare(`
      SELECT al.*, p.username AS actor_username
      FROM audit_logs al
      LEFT JOIN profiles p ON p.id = al.actor_id
      ORDER BY al.created_at DESC
      LIMIT 100
    `).all();
  res.json({ actions, auditLogs });
});
app.post("/api/admin/roles", requireAdministrator, (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role || !["citizen", "moderator", "administrator"].includes(role)) {
    res.status(400).json({ error: "Valid userId and role are required." });
    return;
  }
  db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)`).run(
    crypto5.randomUUID(),
    userId,
    role,
    req.user.id
  );
  writeAuditLog({ actorId: req.user.id, action: "role_assigned", targetType: "user_roles", targetId: userId, metadata: { role } });
  res.json({ ok: true });
});
app.use("/api", (err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        error: "Uploaded file exceeds the size limit (up to 50 MB for report photos/videos, 5 MB for ID photos)."
      });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: "You can upload at most 3 attachments per report." });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});
async function startServer() {
  const port = Number(process.env.PORT) || 3e3;
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path3.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      const indexHtml = path3.join(distDir, "index.html");
      if (fs3.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send("Build output not found.");
      }
    });
  }
  app.listen(port, "0.0.0.0", () => {
    console.log(`JanConnect server running on http://0.0.0.0:${port}`);
  });
}
startServer();
