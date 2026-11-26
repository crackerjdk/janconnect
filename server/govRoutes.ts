import crypto from 'crypto';
import type { Express } from 'express';
import multer from 'multer';
import { db, writeAuditLog } from './db';
import {
  type AuthedRequest,
  checkRateLimit,
  requireAdministrator,
  requireAuth,
  requireAuthorityOrAdmin,
  requireFinancialAdmin,
  requireGovernmentAuthority,
  requireModerator,
} from './auth';
import { buildPaymentBreakdown } from './govDb';
import { promotePendingToPublished, resolveSafeMediaPath, savePendingMedia } from './media';
import { formatInrCurrency, validateBudgetFundedBy } from '../src/utils/civicRules';
import {
  calculateBudgetDisbursementSplit,
  calculateJanConnectFee,
  canIssueFeeInvoice,
  canRecordFeePayment,
  CREATOR_REWARD_ACCOUNT_NAME,
  FEE_BASES,
  FEE_STATUSES,
  type FeeBasis,
  type FeeStatus,
  GOV_PROJECT_STATUSES,
  validateContractorProfileInput,
  validateGovernmentProjectInput,
  validatePaymentTransferInput,
} from '../src/utils/govRules';

const govMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 4,
  },
});

function isGatewayConfiguredOnServer(): boolean {
  const key = (process.env.JANCONNECT_PAYMENT_GATEWAY_KEY || '').trim();
  const secret = (process.env.JANCONNECT_PAYMENT_GATEWAY_SECRET || '').trim();
  const row = db
    .prepare(`SELECT gateway_enabled FROM payment_gateway_settings WHERE id = 'default'`)
    .get() as { gateway_enabled: number } | undefined;
  return Boolean(key && secret && row && row.gateway_enabled === 1);
}

function generateProjectCode(): string {
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM government_projects`).get() as { count: number };
  const seq = String((countRow?.count ?? 0) + 1).padStart(4, '0');
  const year = new Date().getFullYear();
  return `JC-UK-${year}-${seq}`;
}

function generateInvoiceNumber(): string {
  const countRow = db.prepare(`SELECT COUNT(*) AS count FROM fee_invoices`).get() as { count: number };
  const seq = String((countRow?.count ?? 0) + 1).padStart(5, '0');
  const year = new Date().getFullYear();
  return `JC-FEE-${year}-${seq}`;
}

export function registerGovRoutes(app: Express): void {
  // =========================================================================
  // PUBLIC PROJECT TRANSPARENCY & VERIFIED CONTRACTOR PORTFOLIOS
  // (Strictly non-sensitive public records only)
  // =========================================================================

  // Top Completed Work Done Pinned by JanConnect Team (Public)
  app.get('/api/public/pinned-works', (_req, res) => {
    const rows = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.complaint_id, gp.title, gp.description,
          gp.generalized_location, gp.department_name,
          gp.sanctioned_budget_inr, gp.actual_completion_date,
          gp.budget_funded_by, gp.pinned_rank, gp.pinned_note, gp.pinned_at,
          pa.contractor_id AS awarded_contractor_id,
          cp.registered_business_name AS awarded_contractor_name,
          cp.govt_registration_number AS awarded_contractor_reg,
          CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS awarded_contractor_logo,
          pa.awarded_amount_inr,
          (
            SELECT '/api/gov/media/project/' || pm.id
            FROM project_media pm
            WHERE pm.project_id = gp.id AND pm.is_public = 1 AND pm.stage = 'before'
            ORDER BY pm.created_at ASC LIMIT 1
          ) AS before_media_url,
          (
            SELECT '/api/gov/media/project/' || pm.id
            FROM project_media pm
            WHERE pm.project_id = gp.id AND pm.is_public = 1 AND pm.stage = 'after'
            ORDER BY pm.created_at DESC LIMIT 1
          ) AS after_media_url
        FROM government_projects gp
        LEFT JOIN project_awards pa ON pa.project_id = gp.id
        LEFT JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE gp.status = 'completed'
          AND gp.public_transparency_published = 1
          AND gp.is_pinned_work = 1
        ORDER BY COALESCE(gp.pinned_rank, 999) ASC, gp.pinned_at DESC, gp.actual_completion_date DESC
        LIMIT 6
      `)
      .all() as Array<Record<string, unknown>>;

    res.json({
      works: rows.map((w) => {
        const awardedAmt = Number(w.awarded_amount_inr || 0);
        const sanctionedAmt = Number(w.sanctioned_budget_inr || 0);
        return {
          ...w,
          payment_breakdown: buildPaymentBreakdown(db, {
            projectId: String(w.id),
            allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
            isAllotted: awardedAmt > 0,
            contractorName: (w.awarded_contractor_name as string | null) ?? null,
            contractorReg: (w.awarded_contractor_reg as string | null) ?? null,
            includeTransfers: true,
          }),
        };
      }),
    });
  });

  app.get('/api/public/projects', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';

    const where: string[] = [`gp.status NOT IN ('cancelled')`];
    const params: unknown[] = [];

    if (statusFilter === 'completed') {
      where.push(`gp.status = 'completed' AND gp.public_transparency_published = 1`);
    } else if (statusFilter !== 'all' && GOV_PROJECT_STATUSES.includes(statusFilter as (typeof GOV_PROJECT_STATUSES)[number])) {
      where.push(`gp.status = ?`);
      params.push(statusFilter);
    }

    if (q) {
      where.push(`(gp.title LIKE ? OR gp.generalized_location LIKE ? OR gp.department_name LIKE ? OR gp.project_code LIKE ? OR COALESCE(gp.budget_funded_by, '') LIKE ?)`);
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const projects = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.complaint_id, gp.title, gp.description,
          gp.location_id, gp.generalized_location, gp.department_name,
          gp.sanctioned_budget_inr, gp.estimated_cost_inr, gp.tender_reference_number,
          gp.approval_date, gp.expected_completion_date, gp.actual_completion_date,
          gp.status, gp.public_transparency_published, gp.budget_funded_by,
          gp.is_pinned_work, gp.pinned_rank, gp.pinned_note, gp.pinned_at,
          gp.created_at, gp.updated_at,
          pa.contractor_id AS awarded_contractor_id,
          cp.registered_business_name AS awarded_contractor_name,
          cp.govt_registration_number AS awarded_contractor_reg,
          CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS awarded_contractor_logo,
          pa.awarded_amount_inr
        FROM government_projects gp
        LEFT JOIN project_awards pa ON pa.project_id = gp.id
        LEFT JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE ${where.join(' AND ')}
        ORDER BY gp.is_pinned_work DESC, gp.public_transparency_published DESC, gp.updated_at DESC
        LIMIT 100
      `)
      .all(...params) as Array<Record<string, unknown>>;

    res.json({
      projects: projects.map((p) => {
        const awardedAmt = Number(p.awarded_amount_inr || 0);
        const sanctionedAmt = Number(p.sanctioned_budget_inr || 0);
        return {
          ...p,
          public_transparency_published: Boolean(p.public_transparency_published),
          is_pinned_work: Boolean(p.is_pinned_work),
          payment_breakdown: buildPaymentBreakdown(db, {
            projectId: String(p.id),
            allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
            isAllotted: awardedAmt > 0,
            contractorName: (p.awarded_contractor_name as string | null) ?? null,
            contractorReg: (p.awarded_contractor_reg as string | null) ?? null,
            includeTransfers: true,
          }),
        };
      }),
    });
  });

  app.get('/api/public/projects/:id', (req, res) => {
    const project = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.complaint_id, gp.title, gp.description,
          gp.location_id, gp.generalized_location, gp.department_name,
          gp.sanctioned_budget_inr, gp.estimated_cost_inr, gp.tender_reference_number,
          gp.approval_date, gp.expected_completion_date, gp.actual_completion_date,
          gp.status, gp.public_transparency_published, gp.budget_funded_by,
          gp.is_pinned_work, gp.pinned_rank, gp.pinned_note, gp.pinned_at,
          gp.created_at, gp.updated_at,
          c.title AS complaint_title,
          ap.authority_department, ap.authority_designation, ap.reference_number AS approval_reference_number
        FROM government_projects gp
        JOIN complaints c ON c.id = gp.complaint_id
        JOIN project_approvals ap ON ap.id = gp.approval_id
        WHERE gp.id = ?
      `)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!project) {
      res.status(404).json({ error: 'Public project record not found.' });
      return;
    }

    const award = db
      .prepare(`
        SELECT
          pa.id, pa.project_id, pa.contractor_id, pa.awarded_amount_inr,
          pa.award_order_number, pa.award_date, pa.commencement_date,
          cp.registered_business_name AS contractor_name,
          cp.govt_registration_number,
          cp.registration_authority,
          cp.verification_status,
          CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS contractor_logo
        FROM project_awards pa
        JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE pa.project_id = ?
      `)
      .get(req.params.id);

    const tender = db
      .prepare(`
        SELECT
          id, tender_reference_number, procurement_portal_name, procurement_mechanism,
          external_portal_url, is_official_integration_active, estimated_tender_value_inr,
          published_date, closing_date, tender_status
        FROM project_tenders
        WHERE project_id = ?
      `)
      .get(req.params.id);

    const milestones = db
      .prepare(`
        SELECT id, title, description, progress_percent, milestone_status, target_date, completed_date, updated_at
        FROM project_milestones
        WHERE project_id = ?
        ORDER BY created_at ASC
      `)
      .all(req.params.id);

    const inspections = db
      .prepare(`
        SELECT
          id, inspector_designation, inspection_date, inspection_stage,
          inspection_outcome, summary, corrective_status, created_at
        FROM project_inspections
        WHERE project_id = ?
        ORDER BY inspection_date DESC
      `)
      .all(req.params.id);

    const media = db
      .prepare(`
        SELECT
          id, project_id, stage, caption, media_type, is_public, created_at,
          '/api/gov/media/project/' || id AS url
        FROM project_media
        WHERE project_id = ? AND is_public = 1
        ORDER BY created_at ASC
      `)
      .all(req.params.id);

    const awardRow = award as
      | { awarded_amount_inr?: number; contractor_name?: string; govt_registration_number?: string }
      | undefined;
    const awardedAmt = Number(awardRow?.awarded_amount_inr || 0);
    const sanctionedAmt = Number(project.sanctioned_budget_inr || 0);

    res.json({
      project: {
        ...project,
        public_transparency_published: Boolean(project.public_transparency_published),
        is_pinned_work: Boolean(project.is_pinned_work),
      },
      award: award || null,
      tender: tender || null,
      milestones,
      inspections,
      media,
      payment_breakdown: buildPaymentBreakdown(db, {
        projectId: String(project.id),
        allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
        isAllotted: awardedAmt > 0,
        contractorName: awardRow?.contractor_name ?? null,
        contractorReg: awardRow?.govt_registration_number ?? null,
        includeTransfers: true,
      }),
    });
  });

  app.get('/api/public/contractors', (_req, res) => {
    const rows = db
      .prepare(`
        SELECT
          cp.id, cp.registered_business_name, cp.authorised_representative,
          cp.govt_registration_number, cp.registration_authority, cp.registration_class,
          cp.certifications_json, cp.previous_project_history, cp.district_coverage,
          cp.verification_status, cp.verified_at, cp.created_at,
          CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS logo_url,
          (SELECT COUNT(*) FROM project_awards pa WHERE pa.contractor_id = cp.id) AS awarded_count,
          (
            SELECT COUNT(*) FROM project_awards pa
            JOIN government_projects gp ON gp.id = pa.project_id
            WHERE pa.contractor_id = cp.id AND gp.status = 'completed' AND gp.public_transparency_published = 1
          ) AS completed_count
        FROM contractor_profiles cp
        WHERE cp.verification_status = 'verified'
        ORDER BY completed_count DESC, awarded_count DESC, cp.registered_business_name ASC
      `)
      .all() as Array<Record<string, unknown>>;

    res.json({
      contractors: rows.map((r) => ({
        ...r,
        certifications: JSON.parse(String(r.certifications_json || '[]')),
      })),
    });
  });

  app.get('/api/public/contractors/:id', (req, res) => {
    const contractor = db
      .prepare(`
        SELECT
          cp.id, cp.registered_business_name, cp.authorised_representative,
          cp.govt_registration_number, cp.registration_authority, cp.registration_class,
          cp.certifications_json, cp.previous_project_history, cp.district_coverage,
          cp.verification_status, cp.verified_at, cp.created_at,
          CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS logo_url
        FROM contractor_profiles cp
        WHERE cp.id = ? AND cp.verification_status = 'verified'
      `)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!contractor) {
      res.status(404).json({ error: 'Verified contractor profile not found.' });
      return;
    }

    const portfolioProjects = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.title, gp.generalized_location, gp.department_name,
          gp.sanctioned_budget_inr, gp.status, gp.expected_completion_date, gp.actual_completion_date,
          gp.public_transparency_published,
          pa.awarded_amount_inr, pa.award_order_number, pa.award_date
        FROM project_awards pa
        JOIN government_projects gp ON gp.id = pa.project_id
        WHERE pa.contractor_id = ? AND gp.status IN ('awarded', 'in_progress', 'inspection', 'completed')
        ORDER BY gp.updated_at DESC
      `)
      .all(req.params.id);

    res.json({
      contractor: {
        ...contractor,
        certifications: JSON.parse(String(contractor.certifications_json || '[]')),
      },
      portfolioProjects,
    });
  });

  // =========================================================================
  // CONTRACTOR REGISTRY (SELF-REGISTRATION + GOVERNMENT VERIFICATION)
  // =========================================================================

  app.get('/api/gov/contractors', requireAuth, (req: AuthedRequest, res) => {
    const isGov = req.user!.roles.includes('government_authority');
    const rows = isGov
      ? db
          .prepare(`
            SELECT
              cp.*, p.username AS owner_username,
              CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS logo_url
            FROM contractor_profiles cp
            JOIN profiles p ON p.id = cp.owner_user_id
            ORDER BY cp.created_at DESC
          `)
          .all()
      : db
          .prepare(`
            SELECT
              cp.*, p.username AS owner_username,
              CASE WHEN cp.logo_storage_path IS NOT NULL THEN '/api/gov/media/contractor-logo/' || cp.id ELSE NULL END AS logo_url
            FROM contractor_profiles cp
            JOIN profiles p ON p.id = cp.owner_user_id
            WHERE cp.owner_user_id = ? OR cp.verification_status = 'verified'
            ORDER BY cp.created_at DESC
          `)
          .all(req.user!.id);

    res.json({
      contractors: (rows as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        certifications: JSON.parse(String(r.certifications_json || '[]')),
      })),
    });
  });

  app.post('/api/gov/contractors', requireAuth, govMediaUpload.single('logo'), (req: AuthedRequest, res) => {
    if (!checkRateLimit(`contractor-reg:${req.user!.id}`, 10, 15 * 60 * 1000)) {
      res.status(429).json({ error: 'Too many contractor profile updates. Please wait shortly.' });
      return;
    }

    const body = req.body as Record<string, string | undefined>;
    const validation = validateContractorProfileInput({
      registeredBusinessName: body.registeredBusinessName || '',
      authorisedRepresentative: body.authorisedRepresentative || '',
      govtRegistrationNumber: body.govtRegistrationNumber || '',
      registrationAuthority: body.registrationAuthority || '',
    });

    if (!validation.valid) {
      res.status(400).json({ error: Object.values(validation.errors)[0], errors: validation.errors });
      return;
    }

    let logoPath: string | null = null;
    let logoType: string | null = null;
    if (req.file) {
      try {
        const saved = savePendingMedia(req.file.buffer);
        if (saved.mediaType === 'video/mp4') {
          res.status(400).json({ error: 'Contractor logo must be JPEG, PNG, or WebP.' });
          return;
        }
        promotePendingToPublished(saved.storagePath);
        logoPath = saved.storagePath;
        logoType = saved.mediaType;
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
        return;
      }
    }

    const certs = (body.certifications || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 12);

    const existing = db
      .prepare(`SELECT id, logo_storage_path, logo_media_type FROM contractor_profiles WHERE owner_user_id = ?`)
      .get(req.user!.id) as { id: string; logo_storage_path: string | null; logo_media_type: string | null } | undefined;

    const id = existing?.id || crypto.randomUUID();
    if (existing) {
      db.prepare(`
        UPDATE contractor_profiles
        SET registered_business_name = ?,
            logo_storage_path = COALESCE(?, logo_storage_path),
            logo_media_type = COALESCE(?, logo_media_type),
            authorised_representative = ?,
            govt_registration_number = ?,
            registration_authority = ?,
            registration_class = ?,
            certifications_json = ?,
            previous_project_history = ?,
            district_coverage = ?,
            verification_status = 'pending',
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        (body.registeredBusinessName || '').trim(),
        logoPath,
        logoType,
        (body.authorisedRepresentative || '').trim(),
        (body.govtRegistrationNumber || '').trim(),
        (body.registrationAuthority || '').trim(),
        (body.registrationClass || '').trim() || null,
        JSON.stringify(certs),
        (body.previousProjectHistory || '').trim() || null,
        (body.districtCoverage || '').trim() || null,
        id
      );
    } else {
      db.prepare(`
        INSERT INTO contractor_profiles (
          id, owner_user_id, registered_business_name, logo_storage_path, logo_media_type,
          authorised_representative, govt_registration_number, registration_authority,
          registration_class, certifications_json, previous_project_history, district_coverage,
          verification_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        id,
        req.user!.id,
        (body.registeredBusinessName || '').trim(),
        logoPath,
        logoType,
        (body.authorisedRepresentative || '').trim(),
        (body.govtRegistrationNumber || '').trim(),
        (body.registrationAuthority || '').trim(),
        (body.registrationClass || '').trim() || null,
        JSON.stringify(certs),
        (body.previousProjectHistory || '').trim() || null,
        (body.districtCoverage || '').trim() || null
      );
    }

    writeAuditLog({
      actorId: req.user!.id,
      action: existing ? 'contractor_profile_updated' : 'contractor_profile_registered',
      targetType: 'contractor_profile',
      targetId: id,
    });

    res.status(existing ? 200 : 201).json({ id, verificationStatus: 'pending' });
  });

  app.post('/api/gov/contractors/:id/verify', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { decision } = req.body as { decision?: 'verified' | 'suspended' | 'pending' };
    if (!decision || !['verified', 'suspended', 'pending'].includes(decision)) {
      res.status(400).json({ error: 'Invalid verification decision.' });
      return;
    }

    const existing = db.prepare(`SELECT id, owner_user_id, registered_business_name FROM contractor_profiles WHERE id = ?`).get(req.params.id) as
      | { id: string; owner_user_id: string; registered_business_name: string }
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Contractor profile not found.' });
      return;
    }

    db.prepare(`
      UPDATE contractor_profiles
      SET verification_status = ?, verified_by = ?, verified_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(decision, req.user!.id, existing.id);

    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'contractor_verification', ?, ?)
    `).run(
      crypto.randomUUID(),
      existing.owner_user_id,
      existing.id,
      `Government verification updated for "${existing.registered_business_name}": ${decision}.`
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: `contractor_${decision}`,
      targetType: 'contractor_profile',
      targetId: existing.id,
    });

    res.json({ ok: true, verification_status: decision });
  });

  // =========================================================================
  // GOVERNMENT AUTHORITY CONSOLE: CITIZEN ISSUES -> APPROVAL -> PROJECT
  // (Strictly requireGovernmentAuthority)
  // =========================================================================

  app.get('/api/gov/complaints', requireGovernmentAuthority, (_req, res) => {
    const rows = db
      .prepare(`
        SELECT
          c.id, c.title, c.description, c.category, c.location_id, c.generalized_location,
          c.platform_status, c.visibility, c.created_at, c.published_at,
          (SELECT decision FROM project_approvals pa WHERE pa.complaint_id = c.id ORDER BY pa.created_at DESC LIMIT 1) AS latest_approval_decision,
          (SELECT id FROM project_approvals pa WHERE pa.complaint_id = c.id ORDER BY pa.created_at DESC LIMIT 1) AS latest_approval_id,
          (SELECT reference_number FROM project_approvals pa WHERE pa.complaint_id = c.id ORDER BY pa.created_at DESC LIMIT 1) AS latest_approval_ref,
          (SELECT authority_department FROM project_approvals pa WHERE pa.complaint_id = c.id ORDER BY pa.created_at DESC LIMIT 1) AS latest_approval_dept,
          (SELECT id FROM government_projects gp WHERE gp.complaint_id = c.id LIMIT 1) AS linked_project_id,
          (SELECT project_code FROM government_projects gp WHERE gp.complaint_id = c.id LIMIT 1) AS linked_project_code
        FROM complaints c
        WHERE c.platform_status IN ('submitted', 'under_review', 'additional_information_required', 'published')
        ORDER BY c.created_at DESC
        LIMIT 120
      `)
      .all();

    res.json({ complaints: rows });
  });

  app.post('/api/gov/complaints/:id/review', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { decision, authorityDepartment, authorityDesignation, decisionReason, referenceNumber } = req.body as {
      decision?: 'approved' | 'rejected' | 'more_info_requested';
      authorityDepartment?: string;
      authorityDesignation?: string;
      decisionReason?: string;
      referenceNumber?: string;
    };

    if (!decision || !['approved', 'rejected', 'more_info_requested'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be approved, rejected, or more_info_requested.' });
      return;
    }
    if ((authorityDepartment || '').trim().length < 2 || (authorityDesignation || '').trim().length < 2) {
      res.status(400).json({ error: 'Government department and official designation are required.' });
      return;
    }
    if ((decisionReason || '').trim().length < 8) {
      res.status(400).json({ error: 'Please provide an official review reason (at least 8 characters).' });
      return;
    }
    if ((referenceNumber || '').trim().length < 3) {
      res.status(400).json({ error: 'Official approval/review file reference number is required.' });
      return;
    }

    const complaint = db.prepare(`SELECT id, user_id, title FROM complaints WHERE id = ?`).get(req.params.id) as
      | { id: string; user_id: string; title: string }
      | undefined;
    if (!complaint) {
      res.status(404).json({ error: 'Citizen complaint not found.' });
      return;
    }

    const approvalId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO project_approvals (
        id, complaint_id, reviewer_id, authority_department, authority_designation,
        decision, decision_reason, reference_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      approvalId,
      complaint.id,
      req.user!.id,
      authorityDepartment!.trim(),
      authorityDesignation!.trim(),
      decision,
      decisionReason!.trim(),
      referenceNumber!.trim()
    );

    db.prepare(`
      INSERT INTO notifications (id, recipient_id, type, related_id, message)
      VALUES (?, ?, 'gov_project_review', ?, ?)
    `).run(
      crypto.randomUUID(),
      complaint.user_id,
      complaint.id,
      `Government review recorded for "${complaint.title}": ${decision.replace(/_/g, ' ')} (Ref: ${referenceNumber!.trim()}).`
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: `gov_complaint_${decision}`,
      targetType: 'project_approval',
      targetId: approvalId,
      metadata: { complaintId: complaint.id, referenceNumber: referenceNumber!.trim() },
    });

    res.status(201).json({ approvalId, decision });
  });

  app.get('/api/gov/projects', requireGovernmentAuthority, (_req, res) => {
    const projects = db
      .prepare(`
        SELECT
          gp.*,
          pa.contractor_id AS awarded_contractor_id,
          cp.registered_business_name AS awarded_contractor_name,
          cp.govt_registration_number AS awarded_contractor_reg,
          pa.awarded_amount_inr,
          jf.fee_status,
          jf.calculated_fee_inr
        FROM government_projects gp
        LEFT JOIN project_awards pa ON pa.project_id = gp.id
        LEFT JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        LEFT JOIN janconnect_fee_records jf ON jf.project_id = gp.id
        ORDER BY gp.updated_at DESC
      `)
      .all() as Array<Record<string, unknown>>;

    res.json({
      projects: projects.map((p) => {
        const awardedAmt = Number(p.awarded_amount_inr || 0);
        const sanctionedAmt = Number(p.sanctioned_budget_inr || 0);
        return {
          ...p,
          public_transparency_published: Boolean(p.public_transparency_published),
          is_pinned_work: Boolean(p.is_pinned_work),
          payment_breakdown: buildPaymentBreakdown(db, {
            projectId: String(p.id),
            allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
            isAllotted: awardedAmt > 0,
            contractorName: (p.awarded_contractor_name as string | null) ?? null,
            contractorReg: (p.awarded_contractor_reg as string | null) ?? null,
            includeTransfers: false,
          }),
        };
      }),
    });
  });

  app.post('/api/gov/projects', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const {
      complaintId,
      title,
      description,
      departmentName,
      sanctionedBudgetInr,
      estimatedCostInr,
      tenderReferenceNumber,
      budgetFundedBy,
      approvalDate,
      expectedCompletionDate,
    } = req.body as {
      complaintId?: string;
      title?: string;
      description?: string;
      departmentName?: string;
      sanctionedBudgetInr?: number;
      estimatedCostInr?: number;
      tenderReferenceNumber?: string;
      budgetFundedBy?: string;
      approvalDate?: string;
      expectedCompletionDate?: string;
    };

    const fundingCheck = validateBudgetFundedBy(budgetFundedBy);
    if (!fundingCheck.valid) {
      res.status(400).json({ error: fundingCheck.error });
      return;
    }

    if (!complaintId) {
      res.status(400).json({ error: 'Original complaint ID is required.' });
      return;
    }

    const complaint = db
      .prepare(`SELECT id, location_id, generalized_location FROM complaints WHERE id = ?`)
      .get(complaintId) as { id: string; location_id: string; generalized_location: string } | undefined;
    if (!complaint) {
      res.status(404).json({ error: 'Original complaint not found.' });
      return;
    }

    const latestApproval = db
      .prepare(`
        SELECT id, decision FROM project_approvals
        WHERE complaint_id = ?
        ORDER BY created_at DESC LIMIT 1
      `)
      .get(complaintId) as { id: string; decision: string } | undefined;

    if (!latestApproval || latestApproval.decision !== 'approved') {
      res.status(403).json({
        error: 'An authorised government approval decision is required before creating an official project.',
      });
      return;
    }

    const existingProj = db
      .prepare(`SELECT id FROM government_projects WHERE complaint_id = ?`)
      .get(complaintId) as { id: string } | undefined;
    if (existingProj) {
      res.status(409).json({ error: 'An official project already exists for this complaint.' });
      return;
    }

    const budgetInt = Math.round(Number(sanctionedBudgetInr));
    const estCostInt = Math.round(Number(estimatedCostInr));
    const val = validateGovernmentProjectInput({
      title: title || '',
      description: description || '',
      departmentName: departmentName || '',
      sanctionedBudgetInr: budgetInt,
      estimatedCostInr: estCostInt,
      expectedCompletionDate: expectedCompletionDate || '',
    });
    if (!val.valid) {
      res.status(400).json({ error: Object.values(val.errors)[0], errors: val.errors });
      return;
    }

    const projectId = crypto.randomUUID();
    const projectCode = generateProjectCode();
    const cleanApprovalDate =
      approvalDate && /^\d{4}-\d{2}-\d{2}$/.test(approvalDate)
        ? approvalDate
        : new Date().toISOString().slice(0, 10);

    const feeCalc = calculateJanConnectFee({
      sanctionedBudgetInr: budgetInt,
      feeBasis: 'sanctioned_budget',
      feePercentage: 1,
    });

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO government_projects (
          id, project_code, complaint_id, approval_id, title, description,
          location_id, generalized_location, department_name,
          sanctioned_budget_inr, estimated_cost_inr, tender_reference_number, budget_funded_by,
          approval_date, expected_completion_date, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?)
      `).run(
        projectId,
        projectCode,
        complaint.id,
        latestApproval.id,
        title!.trim(),
        description!.trim(),
        complaint.location_id,
        complaint.generalized_location,
        departmentName!.trim(),
        budgetInt,
        estCostInt,
        (tenderReferenceNumber || '').trim() || null,
        fundingCheck.value,
        cleanApprovalDate,
        expectedCompletionDate!.trim(),
        req.user!.id
      );

      // Initialize 1% JanConnect Digital Project Facilitation Fee in Awaiting Government Approval state
      db.prepare(`
        INSERT INTO janconnect_fee_records (
          id, project_id, sanctioned_budget_inr, awarded_contract_amount_inr, actual_contractor_payments_inr,
          fee_basis, approved_fee_base_inr, fee_percentage, calculated_fee_inr,
          illustrative_execution_allocation_inr, fee_status, notes, created_by, updated_by
        ) VALUES (?, ?, ?, 0, 0, 'sanctioned_budget', ?, 1.0, ?, ?, 'awaiting_government_approval', ?, ?, ?)
      `).run(
        crypto.randomUUID(),
        projectId,
        budgetInt,
        feeCalc.approvedFeeBaseInr,
        feeCalc.calculatedFeeInr,
        feeCalc.illustrativeExecutionAllocationInr,
        'Default 1% proposed technology facilitation fee. Remains pending until explicitly sanctioned in government agreement.',
        req.user!.id,
        req.user!.id
      );
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_project_created',
      targetType: 'government_project',
      targetId: projectId,
      metadata: { projectCode, complaintId: complaint.id, sanctionedBudgetInr: budgetInt },
    });

    res.status(201).json({ id: projectId, projectCode });
  });

  app.get('/api/gov/projects/:id', requireGovernmentAuthority, (req, res) => {
    const project = db
      .prepare(`
        SELECT
          gp.*,
          c.title AS complaint_title,
          c.restricted_latitude,
          c.restricted_longitude
        FROM government_projects gp
        JOIN complaints c ON c.id = gp.complaint_id
        WHERE gp.id = ?
      `)
      .get(req.params.id) as Record<string, unknown> | undefined;

    if (!project) {
      res.status(404).json({ error: 'Government project not found.' });
      return;
    }

    const tender = db.prepare(`SELECT * FROM project_tenders WHERE project_id = ?`).get(req.params.id) as
      | Record<string, unknown>
      | undefined;

    const bids = db
      .prepare(`
        SELECT pb.*, cp.registered_business_name AS contractor_name, cp.govt_registration_number
        FROM project_bids pb
        JOIN contractor_profiles cp ON cp.id = pb.contractor_id
        WHERE pb.project_id = ?
        ORDER BY pb.quoted_amount_inr ASC
      `)
      .all(req.params.id);

    const award = db
      .prepare(`
        SELECT pa.*, cp.registered_business_name AS contractor_name, cp.govt_registration_number
        FROM project_awards pa
        JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE pa.project_id = ?
      `)
      .get(req.params.id);

    const milestones = db
      .prepare(`SELECT * FROM project_milestones WHERE project_id = ? ORDER BY created_at ASC`)
      .all(req.params.id);

    const inspections = db
      .prepare(`SELECT * FROM project_inspections WHERE project_id = ? ORDER BY inspection_date DESC`)
      .all(req.params.id);

    const media = db
      .prepare(`
        SELECT *, '/api/gov/media/project/' || id AS url
        FROM project_media
        WHERE project_id = ?
        ORDER BY created_at DESC
      `)
      .all(req.params.id);

    const feeRecord = db
      .prepare(`SELECT * FROM janconnect_fee_records WHERE project_id = ?`)
      .get(req.params.id);

    const feeApprovals = db
      .prepare(`
        SELECT far.*, p.username AS actor_username
        FROM fee_approval_records far
        JOIN profiles p ON p.id = far.actor_id
        WHERE far.project_id = ?
        ORDER BY far.created_at DESC
      `)
      .all(req.params.id);

    const awardRow = award as
      | { awarded_amount_inr?: number; contractor_name?: string; govt_registration_number?: string }
      | undefined;
    const awardedAmt = Number(awardRow?.awarded_amount_inr || 0);
    const sanctionedAmt = Number(project.sanctioned_budget_inr || 0);

    res.json({
      project: {
        ...project,
        public_transparency_published: Boolean(project.public_transparency_published),
        is_pinned_work: Boolean(project.is_pinned_work),
      },
      tender: tender
        ? {
            ...tender,
            is_official_integration_active: Boolean(tender.is_official_integration_active),
          }
        : null,
      bids,
      award: award || null,
      milestones,
      inspections,
      media,
      feeRecord: feeRecord || null,
      feeApprovals,
      payment_breakdown: buildPaymentBreakdown(db, {
        projectId: String(project.id),
        allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
        isAllotted: awardedAmt > 0,
        contractorName: awardRow?.contractor_name ?? null,
        contractorReg: awardRow?.govt_registration_number ?? null,
        includeTransfers: true,
      }),
    });
  });

  // Authority / Admin Payment Transfer on Awarded Government Project
  // First 1% is deducted to creator account "Naman's Account" as reward, then 99% is sent to contractor.
  app.post('/api/gov/projects/:id/transfers', requireAuthorityOrAdmin, (req: AuthedRequest, res) => {
    const val = validatePaymentTransferInput(req.body || {});
    if (!val.valid || !val.value) {
      res.status(400).json({ error: val.error });
      return;
    }

    const { transferMode, amountInr, transferChannel, transferReference, transferDate, note } = val.value;

    const project = db
      .prepare(`SELECT id, project_code, title FROM government_projects WHERE id = ?`)
      .get(req.params.id) as { id: string; project_code: string; title: string } | undefined;
    if (!project) {
      res.status(404).json({ error: 'Government project not found.' });
      return;
    }

    const award = db
      .prepare(`
        SELECT
          pa.id, pa.awarded_amount_inr, pa.contractor_id,
          cp.registered_business_name AS contractor_name,
          cp.govt_registration_number AS contractor_reg,
          cp.owner_user_id AS contractor_owner_user_id
        FROM project_awards pa
        JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE pa.project_id = ?
      `)
      .get(project.id) as
      | {
          id: string;
          awarded_amount_inr: number;
          contractor_id: string;
          contractor_name: string;
          contractor_reg: string;
          contractor_owner_user_id: string;
        }
      | undefined;

    if (!award) {
      res.status(400).json({
        error: 'Award the contract to a verified contractor before transferring allotted budget payments.',
      });
      return;
    }

    const split = calculateBudgetDisbursementSplit(award.awarded_amount_inr);
    const existing = buildPaymentBreakdown(db, {
      projectId: project.id,
      allottedBudgetInr: award.awarded_amount_inr,
      isAllotted: true,
      contractorName: award.contractor_name,
      contractorReg: award.contractor_reg,
      includeTransfers: false,
    });

    if (transferMode === 'creator_1pct') {
      if (existing.creator_remaining_inr <= 0) {
        res.status(409).json({ error: `1% Creator Reward to ${CREATOR_REWARD_ACCOUNT_NAME} is already fully transferred.` });
        return;
      }
      const sendAmt = amountInr ?? existing.creator_remaining_inr;
      if (sendAmt > existing.creator_remaining_inr) {
        res.status(400).json({
          error: `Transfer exceeds remaining 1% Creator Reward balance (${formatInrCurrency(existing.creator_remaining_inr)}).`,
        });
        return;
      }

      const transferId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO budget_payment_transfers (
          id, project_id, contractor_bid_id, recipient_type, recipient_name, recipient_account_ref,
          allotted_budget_inr, amount_inr, transfer_channel, transfer_reference, transfer_date, note, transferred_by
        ) VALUES (?, ?, NULL, 'creator_naman', ?, 'Creator Reward (1%)', ?, ?, ?, ?, ?, ?, ?)
      `).run(
        transferId,
        project.id,
        CREATOR_REWARD_ACCOUNT_NAME,
        split.allottedBudgetInr,
        sendAmt,
        transferChannel,
        transferReference,
        transferDate,
        note ?? `1% Creator Reward deducted from allotted project budget (${project.project_code}).`,
        req.user!.id
      );

      writeAuditLog({
        actorId: req.user!.id,
        action: 'gov_project_creator_reward_transferred',
        targetType: 'budget_payment_transfer',
        targetId: transferId,
        metadata: { projectId: project.id, recipient: CREATOR_REWARD_ACCOUNT_NAME, amountInr: sendAmt, transferReference },
      });
    } else if (transferMode === 'contractor_99pct') {
      if (existing.creator_remaining_inr > 0) {
        res.status(400).json({
          error: `First deduct and transfer the remaining 1% Creator Reward (${formatInrCurrency(
            existing.creator_remaining_inr
          )}) to ${CREATOR_REWARD_ACCOUNT_NAME} before transferring the 99% contractor payment.`,
        });
        return;
      }
      if (existing.contractor_remaining_inr <= 0) {
        res.status(409).json({ error: 'The 99% Contractor Payment has already been fully transferred.' });
        return;
      }
      const sendAmt = amountInr ?? existing.contractor_remaining_inr;
      if (sendAmt > existing.contractor_remaining_inr) {
        res.status(400).json({
          error: `Transfer exceeds remaining 99% Contractor balance (${formatInrCurrency(existing.contractor_remaining_inr)}).`,
        });
        return;
      }

      const transferId = crypto.randomUUID();
      const nextPaidTotal = existing.contractor_transferred_inr + sendAmt;
      const tx = db.transaction(() => {
        db.prepare(`
          INSERT INTO budget_payment_transfers (
            id, project_id, contractor_bid_id, recipient_type, recipient_name, recipient_account_ref,
            allotted_budget_inr, amount_inr, transfer_channel, transfer_reference, transfer_date, note, transferred_by
          ) VALUES (?, ?, NULL, 'contractor', ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          transferId,
          project.id,
          award.contractor_name,
          award.contractor_reg,
          split.allottedBudgetInr,
          sendAmt,
          transferChannel,
          transferReference,
          transferDate,
          note ?? `99% Contractor tranche payment sent after 1% deduction (${project.project_code}).`,
          req.user!.id
        );

        db.prepare(`UPDATE project_awards SET actual_paid_inr = ?, updated_at = datetime('now') WHERE id = ?`).run(
          nextPaidTotal,
          award.id
        );
        db.prepare(`UPDATE janconnect_fee_records SET actual_contractor_payments_inr = ?, updated_at = datetime('now') WHERE project_id = ?`).run(
          nextPaidTotal,
          project.id
        );
      });
      tx();

      writeAuditLog({
        actorId: req.user!.id,
        action: 'gov_project_contractor_payment_transferred',
        targetType: 'budget_payment_transfer',
        targetId: transferId,
        metadata: { projectId: project.id, contractor: award.contractor_name, amountInr: sendAmt, transferReference },
      });

      db.prepare(`
        INSERT INTO notifications (id, recipient_id, type, related_id, message)
        VALUES (?, ?, 'project_payment_transferred', ?, ?)
      `).run(
        crypto.randomUUID(),
        award.contractor_owner_user_id,
        project.id,
        `Payment of ${formatInrCurrency(sendAmt)} (Ref: ${transferReference}) transferred to ${award.contractor_name} for "${project.title}" after 1% deduction to ${CREATOR_REWARD_ACCOUNT_NAME}.`
      );
    } else {
      // full_split: Step 1 deduct 1% to Naman's Account, Step 2 send 99% to Contractor
      if (existing.creator_remaining_inr <= 0 && existing.contractor_remaining_inr <= 0) {
        res.status(409).json({ error: 'Allotted budget (1% Creator Reward + 99% Contractor Payment) is already fully transferred.' });
        return;
      }

      const creatorAmt = existing.creator_remaining_inr;
      const contractorAmt = existing.contractor_remaining_inr;
      const creatorRef = creatorAmt > 0 && contractorAmt > 0 ? `${transferReference}-1PCT` : transferReference;
      const contractorRef = creatorAmt > 0 && contractorAmt > 0 ? `${transferReference}-99PCT` : transferReference;

      const tx = db.transaction(() => {
        if (creatorAmt > 0) {
          db.prepare(`
            INSERT INTO budget_payment_transfers (
              id, project_id, contractor_bid_id, recipient_type, recipient_name, recipient_account_ref,
              allotted_budget_inr, amount_inr, transfer_channel, transfer_reference, transfer_date, note, transferred_by
            ) VALUES (?, ?, NULL, 'creator_naman', ?, 'Creator Reward (1%)', ?, ?, ?, ?, ?, ?, ?)
          `).run(
            crypto.randomUUID(),
            project.id,
            CREATOR_REWARD_ACCOUNT_NAME,
            split.allottedBudgetInr,
            creatorAmt,
            transferChannel,
            creatorRef,
            transferDate,
            note ?? `First 1% Creator Reward deducted to ${CREATOR_REWARD_ACCOUNT_NAME} (${project.project_code}).`,
            req.user!.id
          );
        }

        if (contractorAmt > 0) {
          const nextPaidTotal = existing.contractor_transferred_inr + contractorAmt;
          db.prepare(`
            INSERT INTO budget_payment_transfers (
              id, project_id, contractor_bid_id, recipient_type, recipient_name, recipient_account_ref,
              allotted_budget_inr, amount_inr, transfer_channel, transfer_reference, transfer_date, note, transferred_by
            ) VALUES (?, ?, NULL, 'contractor', ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            crypto.randomUUID(),
            project.id,
            award.contractor_name,
            award.contractor_reg,
            split.allottedBudgetInr,
            contractorAmt,
            transferChannel,
            contractorRef,
            transferDate,
            note ?? `99% Contractor net payment sent after 1% deduction (${project.project_code}).`,
            req.user!.id
          );

          db.prepare(`UPDATE project_awards SET actual_paid_inr = ?, updated_at = datetime('now') WHERE id = ?`).run(
            nextPaidTotal,
            award.id
          );
          db.prepare(`UPDATE janconnect_fee_records SET actual_contractor_payments_inr = ?, updated_at = datetime('now') WHERE project_id = ?`).run(
            nextPaidTotal,
            project.id
          );
        }
      });
      tx();

      writeAuditLog({
        actorId: req.user!.id,
        action: 'gov_project_full_split_transferred',
        targetType: 'government_project',
        targetId: project.id,
        metadata: { creatorAmt, contractorAmt, transferReference },
      });

      if (contractorAmt > 0) {
        db.prepare(`
          INSERT INTO notifications (id, recipient_id, type, related_id, message)
          VALUES (?, ?, 'project_payment_transferred', ?, ?)
        `).run(
          crypto.randomUUID(),
          award.contractor_owner_user_id,
          project.id,
          `Payment of ${formatInrCurrency(contractorAmt)} (Ref: ${contractorRef}) sent to ${award.contractor_name} for "${project.title}" after 1% (${formatInrCurrency(creatorAmt)}) deduction to ${CREATOR_REWARD_ACCOUNT_NAME}.`
        );
      }
    }

    res.status(201).json({
      ok: true,
      payment_breakdown: buildPaymentBreakdown(db, {
        projectId: project.id,
        allottedBudgetInr: award.awarded_amount_inr,
        isAllotted: true,
        contractorName: award.contractor_name,
        contractorReg: award.contractor_reg,
        includeTransfers: true,
      }),
    });
  });

  // Official Tender & E-Procurement Placeholder (Strictly Govt Authority)
  app.post('/api/gov/projects/:id/tenders', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const {
      tenderReferenceNumber,
      procurementPortalName,
      procurementMechanism,
      externalPortalUrl,
      estimatedTenderValueInr,
      publishedDate,
      closingDate,
      tenderStatus,
    } = req.body as {
      tenderReferenceNumber?: string;
      procurementPortalName?: string;
      procurementMechanism?: 'eprocurement_placeholder' | 'authorised_govt_portal';
      externalPortalUrl?: string;
      estimatedTenderValueInr?: number;
      publishedDate?: string;
      closingDate?: string;
      tenderStatus?: 'draft' | 'published_external_placeholder' | 'bidding_closed' | 'evaluated' | 'awarded' | 'cancelled';
    };

    const project = db.prepare(`SELECT id, status FROM government_projects WHERE id = ?`).get(req.params.id) as
      | { id: string; status: string }
      | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    if ((tenderReferenceNumber || '').trim().length < 4) {
      res.status(400).json({ error: 'Official tender reference number is required.' });
      return;
    }

    const mech =
      procurementMechanism === 'authorised_govt_portal' ? 'authorised_govt_portal' : 'eprocurement_placeholder';
    const isOfficialActive = mech === 'authorised_govt_portal' && Boolean((externalPortalUrl || '').trim().startsWith('https://'));

    const existing = db.prepare(`SELECT id FROM project_tenders WHERE project_id = ?`).get(project.id) as { id: string } | undefined;
    const tenderId = existing?.id || crypto.randomUUID();
    const safeUrl =
      externalPortalUrl && /^https?:\/\//i.test(externalPortalUrl.trim()) ? externalPortalUrl.trim() : null;

    if (existing) {
      db.prepare(`
        UPDATE project_tenders
        SET tender_reference_number = ?, procurement_portal_name = ?, procurement_mechanism = ?,
            external_portal_url = ?, is_official_integration_active = ?, estimated_tender_value_inr = ?,
            published_date = ?, closing_date = ?, tender_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(
        tenderReferenceNumber!.trim(),
        (procurementPortalName || 'Uttarakhand e-Procurement Integration Placeholder').trim(),
        mech,
        safeUrl,
        isOfficialActive ? 1 : 0,
        Math.max(1000, Math.round(Number(estimatedTenderValueInr) || 0)),
        publishedDate || null,
        closingDate || null,
        tenderStatus || 'published_external_placeholder',
        tenderId
      );
    } else {
      db.prepare(`
        INSERT INTO project_tenders (
          id, project_id, tender_reference_number, procurement_portal_name, procurement_mechanism,
          external_portal_url, is_official_integration_active, estimated_tender_value_inr,
          published_date, closing_date, tender_status, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tenderId,
        project.id,
        tenderReferenceNumber!.trim(),
        (procurementPortalName || 'Uttarakhand e-Procurement Integration Placeholder').trim(),
        mech,
        safeUrl,
        isOfficialActive ? 1 : 0,
        Math.max(1000, Math.round(Number(estimatedTenderValueInr) || 0)),
        publishedDate || null,
        closingDate || null,
        tenderStatus || 'published_external_placeholder',
        req.user!.id
      );
    }

    db.prepare(`
      UPDATE government_projects
      SET tender_reference_number = ?,
          status = CASE WHEN status = 'approved' THEN 'tendering' ELSE status END,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(tenderReferenceNumber!.trim(), project.id);

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_tender_recorded',
      targetType: 'project_tender',
      targetId: tenderId,
      metadata: { projectId: project.id, tenderReferenceNumber: tenderReferenceNumber!.trim(), mech },
    });

    res.status(201).json({ tenderId });
  });

  // Record Official Procurement Bid (Strictly Govt Authority, Confidential Flag = 1)
  app.post('/api/gov/projects/:id/bids', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { contractorId, officialBidReference, quotedAmountInr, technicalScoreNote, bidStatus } = req.body as {
      contractorId?: string;
      officialBidReference?: string;
      quotedAmountInr?: number;
      technicalScoreNote?: string;
      bidStatus?: 'recorded' | 'technically_qualified' | 'lowest_evaluated' | 'disqualified' | 'rejected';
    };

    const tender = db.prepare(`SELECT id FROM project_tenders WHERE project_id = ?`).get(req.params.id) as
      | { id: string }
      | undefined;
    if (!tender) {
      res.status(400).json({ error: 'Record an official tender reference before logging procurement bids.' });
      return;
    }

    const contractor = db
      .prepare(`SELECT id, verification_status FROM contractor_profiles WHERE id = ?`)
      .get(contractorId || '') as { id: string; verification_status: string } | undefined;
    if (!contractor || contractor.verification_status !== 'verified') {
      res.status(400).json({ error: 'Select a government-verified contractor from the registry.' });
      return;
    }

    const quoteInt = Math.round(Number(quotedAmountInr));
    if (!Number.isInteger(quoteInt) || quoteInt < 1000) {
      res.status(400).json({ error: 'Enter a valid bid quote amount (INR).' });
      return;
    }
    if ((officialBidReference || '').trim().length < 3) {
      res.status(400).json({ error: 'Official e-procurement bid reference ID is required.' });
      return;
    }

    const bidId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO project_bids (
        id, tender_id, project_id, contractor_id, official_bid_reference,
        quoted_amount_inr, technical_score_note, bid_status, confidential_flag, recorded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(tender_id, contractor_id) DO UPDATE SET
        official_bid_reference = excluded.official_bid_reference,
        quoted_amount_inr = excluded.quoted_amount_inr,
        technical_score_note = excluded.technical_score_note,
        bid_status = excluded.bid_status,
        updated_at = datetime('now')
    `).run(
      bidId,
      tender.id,
      req.params.id,
      contractor.id,
      officialBidReference!.trim(),
      quoteInt,
      (technicalScoreNote || '').trim() || null,
      bidStatus || 'recorded',
      req.user!.id
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_official_bid_recorded',
      targetType: 'project_bid',
      targetId: bidId,
      metadata: { projectId: req.params.id, contractorId: contractor.id },
    });

    res.status(201).json({ ok: true });
  });

  // Record Official Contract Award (Strictly Govt Authority)
  app.post('/api/gov/projects/:id/award', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const {
      contractorId,
      winningBidId,
      awardedAmountInr,
      awardOrderNumber,
      awardDate,
      commencementDate,
      budgetFundedBy,
      remarks,
    } = req.body as {
      contractorId?: string;
      winningBidId?: string;
      awardedAmountInr?: number;
      awardOrderNumber?: string;
      awardDate?: string;
      commencementDate?: string;
      budgetFundedBy?: string;
      remarks?: string;
    };

    let nextFunding: string | null | undefined = undefined;
    if (budgetFundedBy !== undefined) {
      const fCheck = validateBudgetFundedBy(budgetFundedBy);
      if (!fCheck.valid) {
        res.status(400).json({ error: fCheck.error });
        return;
      }
      nextFunding = fCheck.value;
    }

    const project = db.prepare(`SELECT id, sanctioned_budget_inr, budget_funded_by FROM government_projects WHERE id = ?`).get(req.params.id) as
      | { id: string; sanctioned_budget_inr: number; budget_funded_by: string | null }
      | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const contractor = db
      .prepare(`SELECT id, verification_status FROM contractor_profiles WHERE id = ?`)
      .get(contractorId || '') as { id: string; verification_status: string } | undefined;
    if (!contractor || contractor.verification_status !== 'verified') {
      res.status(400).json({ error: 'Awarded contractor must be verified in the Contractor Registry.' });
      return;
    }

    const amountInt = Math.round(Number(awardedAmountInr));
    if (!Number.isInteger(amountInt) || amountInt < 1000) {
      res.status(400).json({ error: 'Valid awarded contract amount (INR) is required.' });
      return;
    }
    if ((awardOrderNumber || '').trim().length < 3) {
      res.status(400).json({ error: 'Official work award order number is required.' });
      return;
    }

    const tender = db.prepare(`SELECT id FROM project_tenders WHERE project_id = ?`).get(project.id) as
      | { id: string }
      | undefined;

    const existingAward = db.prepare(`SELECT id FROM project_awards WHERE project_id = ?`).get(project.id) as
      | { id: string }
      | undefined;
    if (existingAward) {
      res.status(409).json({ error: 'Official contract award has already been recorded for this project.' });
      return;
    }

    const awardId = crypto.randomUUID();
    const cleanAwardDate = awardDate && /^\d{4}-\d{2}-\d{2}$/.test(awardDate) ? awardDate : new Date().toISOString().slice(0, 10);
    const resolvedFunding = nextFunding !== undefined ? nextFunding : project.budget_funded_by;

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO project_awards (
          id, project_id, tender_id, contractor_id, winning_bid_id,
          awarded_amount_inr, actual_paid_inr, award_order_number, award_date, commencement_date, awarded_by, remarks
        ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
      `).run(
        awardId,
        project.id,
        tender?.id || null,
        contractor.id,
        winningBidId || null,
        amountInt,
        awardOrderNumber!.trim(),
        cleanAwardDate,
        commencementDate || null,
        req.user!.id,
        (remarks || '').trim() || null
      );

      if (tender) {
        db.prepare(`UPDATE project_tenders SET tender_status = 'awarded', updated_at = datetime('now') WHERE id = ?`).run(
          tender.id
        );
      }
      if (winningBidId) {
        db.prepare(`UPDATE project_bids SET bid_status = 'awarded', updated_at = datetime('now') WHERE id = ?`).run(
          winningBidId
        );
      }

      db.prepare(`
        UPDATE government_projects
        SET status = ?, budget_funded_by = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(commencementDate ? 'in_progress' : 'awarded', resolvedFunding, project.id);

      // Update awarded_contract_amount_inr on fee record without auto-approving fee
      const feeRow = db
        .prepare(`SELECT * FROM janconnect_fee_records WHERE project_id = ?`)
        .get(project.id) as
        | { id: string; fee_basis: FeeBasis; fee_percentage: number; approved_fee_base_inr: number; actual_contractor_payments_inr: number }
        | undefined;
      if (feeRow) {
        const recalc = calculateJanConnectFee({
          sanctionedBudgetInr: project.sanctioned_budget_inr,
          awardedContractAmountInr: amountInt,
          actualContractorPaymentsInr: feeRow.actual_contractor_payments_inr,
          feeBasis: feeRow.fee_basis,
          customApprovedBaseInr: feeRow.approved_fee_base_inr,
          feePercentage: feeRow.fee_percentage,
        });
        db.prepare(`
          UPDATE janconnect_fee_records
          SET awarded_contract_amount_inr = ?,
              approved_fee_base_inr = ?,
              calculated_fee_inr = ?,
              illustrative_execution_allocation_inr = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          amountInt,
          recalc.approvedFeeBaseInr,
          recalc.calculatedFeeInr,
          recalc.illustrativeExecutionAllocationInr,
          feeRow.id
        );
      }
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_contract_awarded',
      targetType: 'project_award',
      targetId: awardId,
      metadata: { projectId: project.id, contractorId: contractor.id, awardedAmountInr: amountInt },
    });

    res.status(201).json({ awardId });
  });

  // Update Execution Commencement / Payments / Status (Strictly Govt Authority)
  app.patch('/api/gov/projects/:id/execution', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { status, commencementDate, actualPaidInr, budgetFundedBy } = req.body as {
      status?: 'in_progress' | 'inspection' | 'on_hold' | 'awarded';
      commencementDate?: string;
      actualPaidInr?: number;
      budgetFundedBy?: string;
    };

    const project = db.prepare(`SELECT id, sanctioned_budget_inr, budget_funded_by FROM government_projects WHERE id = ?`).get(req.params.id) as
      | { id: string; sanctioned_budget_inr: number; budget_funded_by: string | null }
      | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    let nextFunding = project.budget_funded_by;
    if (budgetFundedBy !== undefined) {
      const fCheck = validateBudgetFundedBy(budgetFundedBy);
      if (!fCheck.valid) {
        res.status(400).json({ error: fCheck.error });
        return;
      }
      nextFunding = fCheck.value;
    }

    if (status && ['in_progress', 'inspection', 'on_hold', 'awarded'].includes(status)) {
      db.prepare(`UPDATE government_projects SET status = ?, budget_funded_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
        status,
        nextFunding,
        project.id
      );
    } else if (budgetFundedBy !== undefined) {
      db.prepare(`UPDATE government_projects SET budget_funded_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
        nextFunding,
        project.id
      );
    }

    const award = db.prepare(`SELECT id, awarded_amount_inr, actual_paid_inr FROM project_awards WHERE project_id = ?`).get(project.id) as
      | { id: string; awarded_amount_inr: number; actual_paid_inr: number }
      | undefined;
    if (award) {
      const nextPaid =
        actualPaidInr !== undefined && Number.isFinite(Number(actualPaidInr))
          ? Math.max(0, Math.round(Number(actualPaidInr)))
          : award.actual_paid_inr;
      db.prepare(`
        UPDATE project_awards
        SET commencement_date = COALESCE(?, commencement_date),
            actual_paid_inr = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(commencementDate || null, nextPaid, award.id);

      const feeRow = db
        .prepare(`SELECT * FROM janconnect_fee_records WHERE project_id = ?`)
        .get(project.id) as
        | { id: string; fee_basis: FeeBasis; fee_percentage: number; approved_fee_base_inr: number }
        | undefined;
      if (feeRow) {
        const recalc = calculateJanConnectFee({
          sanctionedBudgetInr: project.sanctioned_budget_inr,
          awardedContractAmountInr: award.awarded_amount_inr,
          actualContractorPaymentsInr: nextPaid,
          feeBasis: feeRow.fee_basis,
          customApprovedBaseInr: feeRow.approved_fee_base_inr,
          feePercentage: feeRow.fee_percentage,
        });
        db.prepare(`
          UPDATE janconnect_fee_records
          SET actual_contractor_payments_inr = ?,
              approved_fee_base_inr = ?,
              calculated_fee_inr = ?,
              illustrative_execution_allocation_inr = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(
          nextPaid,
          recalc.approvedFeeBaseInr,
          recalc.calculatedFeeInr,
          recalc.illustrativeExecutionAllocationInr,
          feeRow.id
        );
      }
    }

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_execution_updated',
      targetType: 'government_project',
      targetId: project.id,
      metadata: { status, commencementDate, actualPaidInr },
    });

    res.json({ ok: true });
  });

  app.post('/api/gov/projects/:id/milestones', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { title, description, progressPercent, milestoneStatus, targetDate, completedDate } = req.body as {
      title?: string;
      description?: string;
      progressPercent?: number;
      milestoneStatus?: 'pending' | 'in_progress' | 'completed' | 'delayed';
      targetDate?: string;
      completedDate?: string;
    };

    if ((title || '').trim().length < 3) {
      res.status(400).json({ error: 'Milestone title is required.' });
      return;
    }

    const pct = Math.max(0, Math.min(100, Math.round(Number(progressPercent) || 0)));
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO project_milestones (
        id, project_id, title, description, progress_percent, milestone_status, target_date, completed_date, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.params.id,
      title!.trim(),
      (description || '').trim() || null,
      pct,
      milestoneStatus || (pct === 100 ? 'completed' : 'in_progress'),
      targetDate || null,
      completedDate || null,
      req.user!.id
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_milestone_recorded',
      targetType: 'project_milestone',
      targetId: id,
      metadata: { projectId: req.params.id, progressPercent: pct },
    });

    res.status(201).json({ id });
  });

  app.post('/api/gov/projects/:id/inspections', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const {
      inspectorName,
      inspectorDesignation,
      inspectionDate,
      inspectionStage,
      inspectionOutcome,
      summary,
      defectsFound,
      correctiveAction,
      correctiveStatus,
    } = req.body as {
      inspectorName?: string;
      inspectorDesignation?: string;
      inspectionDate?: string;
      inspectionStage?: 'commencement' | 'mid_term' | 'quality_test' | 'final_completion' | 'corrective_verification';
      inspectionOutcome?: 'satisfactory' | 'defects_noted' | 'corrective_verified' | 'rejected';
      summary?: string;
      defectsFound?: string;
      correctiveAction?: string;
      correctiveStatus?: 'none' | 'open' | 'resolved';
    };

    if ((inspectorName || '').trim().length < 2 || (inspectorDesignation || '').trim().length < 2) {
      res.status(400).json({ error: 'Inspector name and official designation are required.' });
      return;
    }
    if ((summary || '').trim().length < 10) {
      res.status(400).json({ error: 'Inspection summary must be at least 10 characters.' });
      return;
    }

    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO project_inspections (
        id, project_id, inspector_id, inspector_name, inspector_designation,
        inspection_date, inspection_stage, inspection_outcome, summary,
        defects_found, corrective_action, corrective_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.params.id,
      req.user!.id,
      inspectorName!.trim(),
      inspectorDesignation!.trim(),
      inspectionDate || new Date().toISOString().slice(0, 10),
      inspectionStage || 'mid_term',
      inspectionOutcome || 'satisfactory',
      summary!.trim(),
      (defectsFound || '').trim() || null,
      (correctiveAction || '').trim() || null,
      correctiveStatus || (defectsFound && defectsFound.trim() ? 'open' : 'none')
    );

    if (inspectionStage === 'mid_term' || inspectionStage === 'final_completion') {
      db.prepare(`
        UPDATE government_projects
        SET status = CASE WHEN status IN ('awarded', 'in_progress') THEN 'inspection' ELSE status END,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(req.params.id);
    }

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_inspection_recorded',
      targetType: 'project_inspection',
      targetId: id,
      metadata: { projectId: req.params.id, outcome: inspectionOutcome || 'satisfactory' },
    });

    res.status(201).json({ id });
  });

  app.post(
    '/api/gov/projects/:id/media',
    requireGovernmentAuthority,
    govMediaUpload.single('file'),
    (req: AuthedRequest, res) => {
      if (!req.file) {
        res.status(400).json({ error: 'Attach a JPEG, PNG, or WebP photograph.' });
        return;
      }
      const { stage, caption } = req.body as { stage?: 'before' | 'during' | 'after' | 'inspection'; caption?: string };
      const validStage = stage && ['before', 'during', 'after', 'inspection'].includes(stage) ? stage : 'during';

      const project = db.prepare(`SELECT id, status FROM government_projects WHERE id = ?`).get(req.params.id) as
        | { id: string; status: string }
        | undefined;
      if (!project) {
        res.status(404).json({ error: 'Project not found.' });
        return;
      }

      try {
        const saved = savePendingMedia(req.file.buffer);
        if (saved.mediaType === 'video/mp4') {
          res.status(400).json({ error: 'Project execution photos must be JPEG, PNG, or WebP.' });
          return;
        }
        promotePendingToPublished(saved.storagePath);
        const mediaId = crypto.randomUUID();
        const isPublic = project.status === 'completed' && (validStage === 'before' || validStage === 'after') ? 1 : 0;

        db.prepare(`
          INSERT INTO project_media (id, project_id, uploader_id, stage, caption, storage_path, media_type, is_public)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          mediaId,
          project.id,
          req.user!.id,
          validStage,
          (caption || '').trim() || null,
          saved.storagePath,
          saved.mediaType,
          isPublic
        );

        writeAuditLog({
          actorId: req.user!.id,
          action: 'gov_project_media_uploaded',
          targetType: 'project_media',
          targetId: mediaId,
          metadata: { projectId: project.id, stage: validStage },
        });

        res.status(201).json({ id: mediaId, url: `/api/gov/media/project/${mediaId}` });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Official Project Completion & Public Transparency Unlock (Strictly Govt Authority)
  app.post('/api/gov/projects/:id/complete', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const { actualCompletionDate } = req.body as { actualCompletionDate?: string };
    const project = db.prepare(`SELECT id FROM government_projects WHERE id = ?`).get(req.params.id) as
      | { id: string }
      | undefined;
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }

    const award = db.prepare(`SELECT id FROM project_awards WHERE project_id = ?`).get(project.id) as
      | { id: string }
      | undefined;
    if (!award) {
      res.status(400).json({ error: 'Record the official contractor award before marking the project completed.' });
      return;
    }

    const cleanDate =
      actualCompletionDate && /^\d{4}-\d{2}-\d{2}$/.test(actualCompletionDate)
        ? actualCompletionDate
        : new Date().toISOString().slice(0, 10);

    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE government_projects
        SET status = 'completed',
            actual_completion_date = ?,
            completed_by = ?,
            public_transparency_published = 1,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(cleanDate, req.user!.id, project.id);

      db.prepare(`
        UPDATE project_media
        SET is_public = 1, updated_at = datetime('now')
        WHERE project_id = ? AND stage IN ('before', 'after')
      `).run(project.id);
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: 'gov_project_completed_and_published',
      targetType: 'government_project',
      targetId: project.id,
      metadata: { actualCompletionDate: cleanDate },
    });

    res.json({ ok: true, actualCompletionDate: cleanDate, publicTransparencyPublished: true });
  });

  // Government Official Approval / Sanction of the 1% JanConnect Digital Project Facilitation Fee
  app.post('/api/gov/projects/:id/fee-approval', requireGovernmentAuthority, (req: AuthedRequest, res) => {
    const {
      decision,
      feeBasis,
      feePercentage,
      customApprovedBaseInr,
      approvalAuthority,
      approvalReference,
      agreementClause,
      approvalDate,
      remarks,
    } = req.body as {
      decision?: 'approved' | 'not_applicable' | 'cancelled' | 'disputed';
      feeBasis?: FeeBasis;
      feePercentage?: number;
      customApprovedBaseInr?: number;
      approvalAuthority?: string;
      approvalReference?: string;
      agreementClause?: string;
      approvalDate?: string;
      remarks?: string;
    };

    if (!decision || !['approved', 'not_applicable', 'cancelled', 'disputed'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be approved, not_applicable, cancelled, or disputed.' });
      return;
    }
    if ((approvalAuthority || '').trim().length < 3 || (approvalReference || '').trim().length < 3) {
      res.status(400).json({ error: 'Government approval authority and agreement/sanction reference are required.' });
      return;
    }

    const feeRow = db
      .prepare(`SELECT * FROM janconnect_fee_records WHERE project_id = ?`)
      .get(req.params.id) as
      | {
          id: string;
          sanctioned_budget_inr: number;
          awarded_contract_amount_inr: number;
          actual_contractor_payments_inr: number;
          fee_basis: FeeBasis;
          fee_percentage: number;
          approved_fee_base_inr: number;
        }
      | undefined;
    if (!feeRow) {
      res.status(404).json({ error: 'JanConnect fee record not found for project.' });
      return;
    }

    const nextBasis = feeBasis && FEE_BASES.includes(feeBasis) ? feeBasis : feeRow.fee_basis;
    const calc = calculateJanConnectFee({
      sanctionedBudgetInr: feeRow.sanctioned_budget_inr,
      awardedContractAmountInr: feeRow.awarded_contract_amount_inr,
      actualContractorPaymentsInr: feeRow.actual_contractor_payments_inr,
      feeBasis: nextBasis,
      customApprovedBaseInr: customApprovedBaseInr ?? feeRow.approved_fee_base_inr,
      feePercentage: feePercentage ?? feeRow.fee_percentage,
    });

    const cleanDate =
      approvalDate && /^\d{4}-\d{2}-\d{2}$/.test(approvalDate)
        ? approvalDate
        : new Date().toISOString().slice(0, 10);

    const approvalRecordId = crypto.randomUUID();
    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fee_approval_records (
          id, fee_record_id, project_id, decision, approved_fee_basis, approved_fee_base_inr,
          approved_percentage, approved_fee_inr, approval_authority, approval_reference,
          agreement_clause, approval_date, remarks, actor_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        approvalRecordId,
        feeRow.id,
        req.params.id,
        decision,
        nextBasis,
        calc.approvedFeeBaseInr,
        calc.feePercentage,
        decision === 'not_applicable' || decision === 'cancelled' ? 0 : calc.calculatedFeeInr,
        approvalAuthority!.trim(),
        approvalReference!.trim(),
        (agreementClause || '').trim() || null,
        cleanDate,
        (remarks || '').trim() || null,
        req.user!.id
      );

      db.prepare(`
        UPDATE janconnect_fee_records
        SET fee_basis = ?,
            approved_fee_base_inr = ?,
            fee_percentage = ?,
            calculated_fee_inr = ?,
            illustrative_execution_allocation_inr = ?,
            fee_status = ?,
            approval_authority = ?,
            approval_reference = ?,
            approval_date = ?,
            notes = COALESCE(?, notes),
            updated_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        nextBasis,
        calc.approvedFeeBaseInr,
        calc.feePercentage,
        decision === 'not_applicable' || decision === 'cancelled' ? 0 : calc.calculatedFeeInr,
        calc.illustrativeExecutionAllocationInr,
        decision,
        approvalAuthority!.trim(),
        approvalReference!.trim(),
        cleanDate,
        (remarks || '').trim() || null,
        req.user!.id,
        feeRow.id
      );
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: `gov_fee_${decision}`,
      targetType: 'janconnect_fee_record',
      targetId: feeRow.id,
      metadata: {
        projectId: req.params.id,
        approvalReference: approvalReference!.trim(),
        feeBasis: nextBasis,
        feeInr: calc.calculatedFeeInr,
      },
    });

    res.json({ ok: true, feeStatus: decision, calculatedFeeInr: calc.calculatedFeeInr });
  });

  // =========================================================================
  // JANCONNECT 1% DIGITAL PROJECT FACILITATION FEE & FINANCIAL ADMIN
  // (Strictly requireFinancialAdmin)
  // =========================================================================

  app.get('/api/finance/dashboard', requireFinancialAdmin, (req, res) => {
    const fromDate = typeof req.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : '';
    const toDate = typeof req.query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim() : 'all';

    const where: string[] = ['1=1'];
    const params: unknown[] = [];

    if (fromDate) {
      where.push(`date(gp.created_at) >= date(?)`);
      params.push(fromDate);
    }
    if (toDate) {
      where.push(`date(gp.created_at) <= date(?)`);
      params.push(toDate);
    }
    if (statusFilter !== 'all' && FEE_STATUSES.includes(statusFilter as FeeStatus)) {
      where.push(`jf.fee_status = ?`);
      params.push(statusFilter);
    }

    const records = db
      .prepare(`
        SELECT
          jf.*,
          gp.project_code,
          gp.title AS project_title,
          gp.department_name,
          gp.status AS project_status
        FROM janconnect_fee_records jf
        JOIN government_projects gp ON gp.id = jf.project_id
        WHERE ${where.join(' AND ')}
        ORDER BY jf.updated_at DESC
      `)
      .all(...params) as Array<{
      fee_status: FeeStatus;
      calculated_fee_inr: number;
    }>;

    const allRecords = db
      .prepare(`SELECT fee_status, calculated_fee_inr FROM janconnect_fee_records`)
      .all() as Array<{ fee_status: FeeStatus; calculated_fee_inr: number }>;

    const invoices = db
      .prepare(`SELECT * FROM fee_invoices ORDER BY created_at DESC LIMIT 100`)
      .all() as Array<{ invoice_status: string; invoice_amount_inr: number }>;

    const payments = db
      .prepare(`SELECT * FROM fee_payment_records ORDER BY created_at DESC LIMIT 100`)
      .all() as Array<{ gateway_verified: number; amount_inr: number }>;

    const totalProjectsRegistered = allRecords.length;
    const totalEligibleProjects = allRecords.filter((r) => r.fee_status !== 'not_applicable').length;
    const totalProposedFeesInr = allRecords
      .filter((r) => r.fee_status === 'awaiting_government_approval')
      .reduce((acc, r) => acc + r.calculated_fee_inr, 0);
    const totalApprovedFeesInr = allRecords
      .filter((r) => ['approved', 'awaiting_invoice', 'invoice_issued', 'payment_pending', 'payment_received'].includes(r.fee_status))
      .reduce((acc, r) => acc + r.calculated_fee_inr, 0);
    const totalInvoicedFeesInr = invoices
      .filter((i) => ['issued', 'payment_pending', 'paid'].includes(i.invoice_status))
      .reduce((acc, i) => acc + i.invoice_amount_inr, 0);
    const totalPaymentsReceivedInr = payments
      .filter((p) => p.gateway_verified === 1)
      .reduce((acc, p) => acc + p.amount_inr, 0);
    const totalPendingPaymentsInr = allRecords
      .filter((r) => ['invoice_issued', 'payment_pending'].includes(r.fee_status))
      .reduce((acc, r) => acc + r.calculated_fee_inr, 0);
    const totalCancelledOrDisputedInr = allRecords
      .filter((r) => ['cancelled', 'disputed'].includes(r.fee_status))
      .reduce((acc, r) => acc + r.calculated_fee_inr, 0);

    res.json({
      summary: {
        totalProjectsRegistered,
        totalEligibleProjects,
        totalProposedFeesInr,
        totalApprovedFeesInr,
        totalInvoicedFeesInr,
        totalPaymentsReceivedInr,
        totalPendingPaymentsInr,
        totalCancelledOrDisputedInr,
      },
      gatewayConfigured: isGatewayConfiguredOnServer(),
      records,
      invoices,
      payments: payments.map((p) => ({
        ...p,
        gateway_verified: Boolean(p.gateway_verified),
      })),
    });
  });

  app.patch('/api/finance/fees/:projectId/basis', requireFinancialAdmin, (req: AuthedRequest, res) => {
    const { feeBasis, feePercentage, customApprovedBaseInr, notes } = req.body as {
      feeBasis?: FeeBasis;
      feePercentage?: number;
      customApprovedBaseInr?: number;
      notes?: string;
    };

    if (!feeBasis || !FEE_BASES.includes(feeBasis)) {
      res.status(400).json({ error: 'Select a valid fee calculation basis.' });
      return;
    }

    const feeRow = db
      .prepare(`SELECT * FROM janconnect_fee_records WHERE project_id = ?`)
      .get(req.params.projectId) as
      | {
          id: string;
          sanctioned_budget_inr: number;
          awarded_contract_amount_inr: number;
          actual_contractor_payments_inr: number;
          fee_status: FeeStatus;
        }
      | undefined;

    if (!feeRow) {
      res.status(404).json({ error: 'Fee record not found.' });
      return;
    }

    if (feeRow.fee_status === 'payment_received') {
      res.status(409).json({ error: 'Cannot alter calculation basis after verified payment receipt.' });
      return;
    }

    const calc = calculateJanConnectFee({
      sanctionedBudgetInr: feeRow.sanctioned_budget_inr,
      awardedContractAmountInr: feeRow.awarded_contract_amount_inr,
      actualContractorPaymentsInr: feeRow.actual_contractor_payments_inr,
      feeBasis,
      customApprovedBaseInr,
      feePercentage: feePercentage ?? 1,
    });

    // Updating the calculation basis on an unapproved or awaiting record keeps government approval required
    const nextStatus =
      feeRow.fee_status === 'awaiting_government_approval' ? 'awaiting_government_approval' : feeRow.fee_status;

    db.prepare(`
      UPDATE janconnect_fee_records
      SET fee_basis = ?,
          approved_fee_base_inr = ?,
          fee_percentage = ?,
          calculated_fee_inr = ?,
          illustrative_execution_allocation_inr = ?,
          fee_status = ?,
          notes = COALESCE(?, notes),
          updated_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(
      feeBasis,
      calc.approvedFeeBaseInr,
      calc.feePercentage,
      calc.calculatedFeeInr,
      calc.illustrativeExecutionAllocationInr,
      nextStatus,
      (notes || '').trim() || null,
      req.user!.id,
      feeRow.id
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: 'finance_fee_basis_updated',
      targetType: 'janconnect_fee_record',
      targetId: feeRow.id,
      metadata: { feeBasis, feePercentage: calc.feePercentage, calculatedFeeInr: calc.calculatedFeeInr },
    });

    res.json({ ok: true, ...calc });
  });

  app.post('/api/finance/fees/:projectId/invoices', requireFinancialAdmin, (req: AuthedRequest, res) => {
    const { dueDate, notes } = req.body as { dueDate?: string; notes?: string };
    const feeRow = db
      .prepare(`
        SELECT jf.*, gp.department_name
        FROM janconnect_fee_records jf
        JOIN government_projects gp ON gp.id = jf.project_id
        WHERE jf.project_id = ?
      `)
      .get(req.params.projectId) as
      | {
          id: string;
          project_id: string;
          department_name: string;
          fee_status: FeeStatus;
          approved_fee_base_inr: number;
          fee_percentage: number;
          calculated_fee_inr: number;
        }
      | undefined;

    if (!feeRow) {
      res.status(404).json({ error: 'Fee record not found.' });
      return;
    }

    if (!canIssueFeeInvoice(feeRow.fee_status)) {
      res.status(403).json({
        error:
          'Cannot issue invoice: the 1% JanConnect fee must be officially approved in the government agreement first.',
      });
      return;
    }

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = generateInvoiceNumber();
    const today = new Date().toISOString().slice(0, 10);

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fee_invoices (
          id, fee_record_id, project_id, invoice_number, invoice_date, due_date,
          billed_to_department, fee_base_inr, fee_percentage, invoice_amount_inr,
          invoice_status, issued_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?)
      `).run(
        invoiceId,
        feeRow.id,
        feeRow.project_id,
        invoiceNumber,
        today,
        dueDate || null,
        feeRow.department_name,
        feeRow.approved_fee_base_inr,
        feeRow.fee_percentage,
        feeRow.calculated_fee_inr,
        req.user!.id,
        (notes || '').trim() || null
      );

      db.prepare(`
        UPDATE janconnect_fee_records
        SET fee_status = 'invoice_issued',
            latest_invoice_number = ?,
            updated_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(invoiceNumber, req.user!.id, feeRow.id);
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: 'finance_fee_invoice_issued',
      targetType: 'fee_invoice',
      targetId: invoiceId,
      metadata: { projectId: feeRow.project_id, invoiceNumber, amountInr: feeRow.calculated_fee_inr },
    });

    res.status(201).json({ invoiceId, invoiceNumber });
  });

  app.patch('/api/finance/fees/:projectId/status', requireFinancialAdmin, (req: AuthedRequest, res) => {
    const { feeStatus, notes } = req.body as { feeStatus?: FeeStatus; notes?: string };
    const allowedFinanceTransitions: FeeStatus[] = ['awaiting_invoice', 'payment_pending', 'cancelled', 'disputed'];

    if (!feeStatus || !allowedFinanceTransitions.includes(feeStatus)) {
      res.status(400).json({
        error:
          'Financial admins can set awaiting_invoice, payment_pending, cancelled, or disputed. Government approval and verified payment gateway settlement govern approved and payment_received states.',
      });
      return;
    }

    const feeRow = db
      .prepare(`SELECT id, fee_status FROM janconnect_fee_records WHERE project_id = ?`)
      .get(req.params.projectId) as { id: string; fee_status: FeeStatus } | undefined;
    if (!feeRow) {
      res.status(404).json({ error: 'Fee record not found.' });
      return;
    }

    if (feeStatus === 'awaiting_invoice' && feeRow.fee_status !== 'approved') {
      res.status(403).json({ error: 'Government approval is required before queuing for invoice.' });
      return;
    }
    if (feeStatus === 'payment_pending' && feeRow.fee_status !== 'invoice_issued') {
      res.status(400).json({ error: 'An invoice must be issued before marking payment pending.' });
      return;
    }

    db.prepare(`
      UPDATE janconnect_fee_records
      SET fee_status = ?, notes = COALESCE(?, notes), updated_by = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(feeStatus, (notes || '').trim() || null, req.user!.id, feeRow.id);

    writeAuditLog({
      actorId: req.user!.id,
      action: `finance_fee_status_${feeStatus}`,
      targetType: 'janconnect_fee_record',
      targetId: feeRow.id,
    });

    res.json({ ok: true, feeStatus });
  });

  // Payment Recording: STRICTLY BLOCKED unless Payment Gateway is configured & verified!
  app.post('/api/finance/fees/:projectId/payments', requireFinancialAdmin, (req: AuthedRequest, res) => {
    const { invoiceId, paymentReference, paymentChannel, amountInr, gatewayVerified } = req.body as {
      invoiceId?: string;
      paymentReference?: string;
      paymentChannel?: 'government_treasury_pfms' | 'neft_rtgs_verified' | 'gateway_verified';
      amountInr?: number;
      gatewayVerified?: boolean;
    };

    const feeRow = db
      .prepare(`SELECT id, fee_status FROM janconnect_fee_records WHERE project_id = ?`)
      .get(req.params.projectId) as { id: string; fee_status: FeeStatus } | undefined;

    if (!feeRow) {
      res.status(404).json({ error: 'Fee record not found.' });
      return;
    }

    const gatewayConfigured = isGatewayConfiguredOnServer();
    const check = canRecordFeePayment({
      feeStatus: feeRow.fee_status,
      gatewayEnabled: gatewayConfigured,
      gatewayVerified: Boolean(gatewayVerified),
    });

    if (!check.allowed) {
      res.status(400).json({ error: check.error });
      return;
    }

    if (!invoiceId || (paymentReference || '').trim().length < 4 || !Number.isInteger(Number(amountInr))) {
      res.status(400).json({ error: 'Valid invoice ID, verified payment reference, and INR amount are required.' });
      return;
    }

    const settings = db
      .prepare(`SELECT provider_name FROM payment_gateway_settings WHERE id = 'default'`)
      .get() as { provider_name: string } | undefined;

    const paymentId = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    const tx = db.transaction(() => {
      db.prepare(`
        INSERT INTO fee_payment_records (
          id, fee_record_id, invoice_id, project_id, payment_reference, payment_channel,
          amount_inr, payment_date, gateway_verified, gateway_provider, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).run(
        paymentId,
        feeRow.id,
        invoiceId,
        req.params.projectId,
        paymentReference!.trim(),
        paymentChannel || 'gateway_verified',
        Math.round(Number(amountInr)),
        today,
        settings?.provider_name || 'Verified Gateway',
        req.user!.id
      );

      db.prepare(`UPDATE fee_invoices SET invoice_status = 'paid', updated_at = datetime('now') WHERE id = ?`).run(
        invoiceId
      );

      db.prepare(`
        UPDATE janconnect_fee_records
        SET fee_status = 'payment_received',
            latest_payment_reference = ?,
            updated_by = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(paymentReference!.trim(), req.user!.id, feeRow.id);
    });
    tx();

    writeAuditLog({
      actorId: req.user!.id,
      action: 'finance_verified_payment_recorded',
      targetType: 'fee_payment_record',
      targetId: paymentId,
      metadata: { projectId: req.params.projectId, paymentReference: paymentReference!.trim() },
    });

    res.status(201).json({ paymentId });
  });

  // Payment Gateway Settings (Placeholders Only; Credentials Never Stored or Exposed)
  app.get('/api/finance/payment-settings', requireFinancialAdmin, (_req, res) => {
    const row = db
      .prepare(`SELECT * FROM payment_gateway_settings WHERE id = 'default'`)
      .get() as Record<string, unknown>;

    res.json({
      settings: {
        ...row,
        gateway_enabled: Boolean(row?.gateway_enabled),
        gateway_configured_on_server: isGatewayConfiguredOnServer(),
      },
    });
  });

  app.put('/api/finance/payment-settings', requireFinancialAdmin, (req: AuthedRequest, res) => {
    const {
      providerName,
      settlementMode,
      businessLegalName,
      businessAccountLabel,
      merchantIdPlaceholder,
      webhookEndpointPath,
    } = req.body as {
      providerName?: string;
      settlementMode?: 'government_agreement_treasury' | 'future_verified_gateway';
      businessLegalName?: string;
      businessAccountLabel?: string;
      merchantIdPlaceholder?: string;
      webhookEndpointPath?: string;
    };

    const hasSecrets = Boolean(
      (process.env.JANCONNECT_PAYMENT_GATEWAY_KEY || '').trim() &&
        (process.env.JANCONNECT_PAYMENT_GATEWAY_SECRET || '').trim()
    );

    db.prepare(`
      UPDATE payment_gateway_settings
      SET gateway_enabled = ?,
          provider_name = ?,
          settlement_mode = ?,
          business_legal_name = ?,
          business_account_label = ?,
          merchant_id_placeholder = ?,
          webhook_endpoint_path = ?,
          updated_by = ?,
          updated_at = datetime('now')
      WHERE id = 'default'
    `).run(
      hasSecrets ? 1 : 0,
      (providerName || 'Not Configured').trim(),
      settlementMode === 'future_verified_gateway' ? 'future_verified_gateway' : 'government_agreement_treasury',
      (businessLegalName || '').trim(),
      (businessAccountLabel || '').trim(),
      (merchantIdPlaceholder || '').trim(),
      (webhookEndpointPath || '/api/finance/payments/webhook').trim(),
      req.user!.id
    );

    writeAuditLog({
      actorId: req.user!.id,
      action: 'finance_payment_settings_updated',
      targetType: 'payment_gateway_settings',
      targetId: 'default',
    });

    res.json({ ok: true, gatewayConfiguredOnServer: isGatewayConfiguredOnServer() });
  });

  // =========================================================================
  // ADMINISTRATOR USER ROLE ASSIGNMENT
  // (Allows platform admin to designate government_authority / financial_admin)
  // =========================================================================

  app.get('/api/admin/users', requireAdministrator, (_req, res) => {
    const profiles = db
      .prepare(`
        SELECT id, username, display_name, account_status, identity_status, created_at
        FROM profiles
        ORDER BY created_at DESC
        LIMIT 100
      `)
      .all() as Array<{ id: string }>;

    const rolesStmt = db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`);
    const users = profiles.map((p) => ({
      ...p,
      roles: (rolesStmt.all(p.id) as Array<{ role: string }>).map((r) => r.role),
    }));

    res.json({ users });
  });

  app.post('/api/admin/users/:id/roles', requireAdministrator, (req: AuthedRequest, res) => {
    const { role, grant } = req.body as {
      role?: 'moderator' | 'government_authority' | 'financial_admin' | 'administrator';
      grant?: boolean;
    };

    const allowedRoles = ['moderator', 'government_authority', 'financial_admin', 'administrator'];
    if (!role || !allowedRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role specified.' });
      return;
    }

    const target = db.prepare(`SELECT id, username FROM profiles WHERE id = ?`).get(req.params.id) as
      | { id: string; username: string }
      | undefined;
    if (!target) {
      res.status(404).json({ error: 'User profile not found.' });
      return;
    }

    if (grant) {
      db.prepare(`INSERT OR IGNORE INTO user_roles (id, user_id, role, assigned_by) VALUES (?, ?, ?, ?)`).run(
        crypto.randomUUID(),
        target.id,
        role,
        req.user!.id
      );
    } else {
      if (target.id === req.user!.id && role === 'administrator') {
        res.status(400).json({ error: 'Cannot remove your own administrator role.' });
        return;
      }
      db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role = ?`).run(target.id, role);
    }

    writeAuditLog({
      actorId: req.user!.id,
      action: grant ? `role_granted_${role}` : `role_revoked_${role}`,
      targetType: 'profile',
      targetId: target.id,
      metadata: { targetUsername: target.username, role, grant: Boolean(grant) },
    });

    const roles = (db.prepare(`SELECT role FROM user_roles WHERE user_id = ?`).all(target.id) as Array<{ role: string }>).map(
      (r) => r.role
    );
    res.json({ ok: true, roles });
  });

  // =========================================================================
  // JANCONNECT TEAM CURATION: PIN TOP COMPLETED "WORK DONE" SHOWCASE
  // (Allows moderators/administrators to feature verified completed projects near Report a Problem)
  // =========================================================================

  app.get('/api/admin/completed-projects', requireModerator, (_req, res) => {
    const rows = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.complaint_id, gp.title, gp.description,
          gp.generalized_location, gp.department_name,
          gp.sanctioned_budget_inr, gp.actual_completion_date,
          gp.status, gp.public_transparency_published, gp.budget_funded_by,
          gp.is_pinned_work, gp.pinned_rank, gp.pinned_note, gp.pinned_at,
          pa.awarded_amount_inr,
          cp.registered_business_name AS awarded_contractor_name,
          cp.govt_registration_number AS awarded_contractor_reg
        FROM government_projects gp
        LEFT JOIN project_awards pa ON pa.project_id = gp.id
        LEFT JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        WHERE gp.status = 'completed' AND gp.public_transparency_published = 1
        ORDER BY gp.is_pinned_work DESC, COALESCE(gp.pinned_rank, 999) ASC, gp.actual_completion_date DESC
        LIMIT 80
      `)
      .all() as Array<Record<string, unknown>>;

    res.json({
      projects: rows.map((r) => {
        const awardedAmt = Number(r.awarded_amount_inr || 0);
        const sanctionedAmt = Number(r.sanctioned_budget_inr || 0);
        return {
          ...r,
          public_transparency_published: Boolean(r.public_transparency_published),
          is_pinned_work: Boolean(r.is_pinned_work),
          payment_breakdown: buildPaymentBreakdown(db, {
            projectId: String(r.id),
            allottedBudgetInr: awardedAmt > 0 ? awardedAmt : sanctionedAmt,
            isAllotted: awardedAmt > 0,
            contractorName: (r.awarded_contractor_name as string | null) ?? null,
            contractorReg: (r.awarded_contractor_reg as string | null) ?? null,
            includeTransfers: false,
          }),
        };
      }),
    });
  });

  // Unified Authority / Admin Payment Transfer Desk (Awarded Govt Projects + Awarded Community Bids)
  app.get('/api/admin/payment-transfers', requireAuthorityOrAdmin, (_req, res) => {
    const govProjects = db
      .prepare(`
        SELECT
          gp.id, gp.project_code, gp.complaint_id, gp.title, gp.generalized_location,
          gp.department_name, gp.status, gp.sanctioned_budget_inr, gp.budget_funded_by,
          pa.awarded_amount_inr, pa.award_order_number, pa.award_date,
          cp.registered_business_name AS contractor_name,
          cp.govt_registration_number AS contractor_reg
        FROM government_projects gp
        JOIN project_awards pa ON pa.project_id = gp.id
        JOIN contractor_profiles cp ON cp.id = pa.contractor_id
        ORDER BY gp.updated_at DESC
        LIMIT 100
      `)
      .all() as Array<Record<string, unknown>>;

    const awardedBids = db
      .prepare(`
        SELECT
          cb.id, cb.complaint_id, cb.company_name, cb.registration_number,
          cb.bid_amount_inr, cb.budget_funded_by, cb.reviewed_at, cb.created_at,
          c.title AS report_title, c.generalized_location, c.category AS report_category
        FROM contractor_bids cb
        JOIN complaints c ON c.id = cb.complaint_id
        WHERE cb.bid_status = 'awarded'
        ORDER BY cb.updated_at DESC
        LIMIT 100
      `)
      .all() as Array<Record<string, unknown>>;

    res.json({
      governmentProjects: govProjects.map((p) => ({
        ...p,
        payment_breakdown: buildPaymentBreakdown(db, {
          projectId: String(p.id),
          allottedBudgetInr: Number(p.awarded_amount_inr || 0),
          isAllotted: true,
          contractorName: String(p.contractor_name || ''),
          contractorReg: (p.contractor_reg as string | null) ?? null,
          includeTransfers: true,
        }),
      })),
      awardedBids: awardedBids.map((b) => ({
        ...b,
        payment_breakdown: buildPaymentBreakdown(db, {
          contractorBidId: String(b.id),
          allottedBudgetInr: Number(b.bid_amount_inr || 0),
          isAllotted: true,
          contractorName: String(b.company_name || ''),
          contractorReg: (b.registration_number as string | null) ?? null,
          includeTransfers: true,
        }),
      })),
    });
  });

  app.post('/api/admin/projects/:id/pin', requireModerator, (req: AuthedRequest, res) => {
    const { pinned, pinnedRank, pinnedNote } = req.body as {
      pinned?: boolean;
      pinnedRank?: number | null;
      pinnedNote?: string | null;
    };

    const project = db
      .prepare(`
        SELECT id, project_code, title, status, public_transparency_published
        FROM government_projects WHERE id = ?
      `)
      .get(req.params.id) as
      | { id: string; project_code: string; title: string; status: string; public_transparency_published: number }
      | undefined;

    if (!project) {
      res.status(404).json({ error: 'Government project not found.' });
      return;
    }
    if (project.status !== 'completed' || project.public_transparency_published !== 1) {
      res.status(400).json({
        error: 'Only officially completed and Public Transparency verified projects can be pinned to Work Done.',
      });
      return;
    }

    const shouldPin = Boolean(pinned);
    const cleanNote = (pinnedNote || '').replace(/[\r\n\t]+/g, ' ').trim();
    if (cleanNote.length > 160 || /[<>]/.test(cleanNote)) {
      res.status(400).json({ error: 'Pinned highlight note must be plain text under 160 characters.' });
      return;
    }

    let rankVal: number | null = null;
    if (shouldPin && pinnedRank !== undefined && pinnedRank !== null && String(pinnedRank).trim() !== '') {
      const n = Math.round(Number(pinnedRank));
      if (!Number.isInteger(n) || n < 1 || n > 6) {
        res.status(400).json({ error: 'Pinned display position must be between 1 and 6.' });
        return;
      }
      rankVal = n;
    }

    if (shouldPin) {
      db.prepare(`
        UPDATE government_projects
        SET is_pinned_work = 1,
            pinned_rank = ?,
            pinned_note = ?,
            pinned_by = ?,
            pinned_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(rankVal, cleanNote || null, req.user!.id, project.id);
    } else {
      db.prepare(`
        UPDATE government_projects
        SET is_pinned_work = 0,
            pinned_rank = NULL,
            pinned_note = NULL,
            pinned_by = NULL,
            pinned_at = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(project.id);
    }

    writeAuditLog({
      actorId: req.user!.id,
      action: shouldPin ? 'admin_project_work_pinned' : 'admin_project_work_unpinned',
      targetType: 'government_project',
      targetId: project.id,
      metadata: { projectCode: project.project_code, pinned: shouldPin, pinnedRank: rankVal, pinnedNote: cleanNote || null },
    });

    res.json({ ok: true, is_pinned_work: shouldPin, pinned_rank: rankVal, pinned_note: cleanNote || null });
  });

  // =========================================================================
  // SECURE MEDIA SERVING FOR CONTRACTOR LOGOS & PROJECT EXECUTION PHOTOS
  // =========================================================================

  app.get('/api/gov/media/contractor-logo/:id', (req: AuthedRequest, res) => {
    const row = db
      .prepare(`
        SELECT logo_storage_path, logo_media_type, verification_status, owner_user_id
        FROM contractor_profiles WHERE id = ?
      `)
      .get(req.params.id) as
      | {
          logo_storage_path: string | null;
          logo_media_type: string | null;
          verification_status: string;
          owner_user_id: string;
        }
      | undefined;

    if (!row || !row.logo_storage_path || !row.logo_media_type) {
      res.status(404).send('Not found');
      return;
    }

    const canAccess =
      row.verification_status === 'verified' ||
      (req.user && (req.user.id === row.owner_user_id || req.user.roles.includes('government_authority')));
    if (!canAccess) {
      res.status(403).send('Forbidden');
      return;
    }

    const filePath = resolveSafeMediaPath('published', row.logo_storage_path);
    if (!filePath) {
      res.status(404).send('Not found');
      return;
    }
    res.setHeader('Content-Type', row.logo_media_type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  });

  app.get('/api/gov/media/project/:id', (req: AuthedRequest, res) => {
    const row = db
      .prepare(`
        SELECT pm.storage_path, pm.media_type, pm.is_public, gp.public_transparency_published
        FROM project_media pm
        JOIN government_projects gp ON gp.id = pm.project_id
        WHERE pm.id = ?
      `)
      .get(req.params.id) as
      | {
          storage_path: string;
          media_type: string;
          is_public: number;
          public_transparency_published: number;
        }
      | undefined;

    if (!row) {
      res.status(404).send('Not found');
      return;
    }

    const isGov = Boolean(req.user?.roles.includes('government_authority'));
    const isPublic = row.is_public === 1 && row.public_transparency_published === 1;
    if (!isPublic && !isGov) {
      res.status(403).send('Forbidden');
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
}
