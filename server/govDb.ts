import type Database from 'better-sqlite3';
import {
  calculateBudgetDisbursementSplit,
  CREATOR_REWARD_ACCOUNT_NAME,
} from '../src/utils/govRules';

export interface BudgetPaymentTransferRow {
  id: string;
  recipient_type: 'creator_naman' | 'contractor';
  recipient_name: string;
  recipient_account_ref: string | null;
  allotted_budget_inr: number;
  amount_inr: number;
  transfer_channel: string;
  transfer_reference: string;
  transfer_date: string;
  note: string | null;
  created_at: string;
}

export interface BudgetPaymentBreakdownResult {
  allotted_budget_inr: number;
  is_allotted: boolean;
  creator_account_name: string;
  creator_reward_1pct_inr: number;
  creator_transferred_inr: number;
  creator_remaining_inr: number;
  creator_reward_settled: boolean;
  contractor_name: string | null;
  contractor_reg: string | null;
  contractor_net_99pct_inr: number;
  contractor_transferred_inr: number;
  contractor_remaining_inr: number;
  contractor_settled: boolean;
  total_transferred_inr: number;
  transfers: BudgetPaymentTransferRow[];
}

export function buildPaymentBreakdown(
  db: Database.Database,
  params: {
    projectId?: string | null;
    contractorBidId?: string | null;
    allottedBudgetInr: number;
    isAllotted: boolean;
    contractorName?: string | null;
    contractorReg?: string | null;
    includeTransfers?: boolean;
  }
): BudgetPaymentBreakdownResult {
  const split = calculateBudgetDisbursementSplit(params.allottedBudgetInr);
  const whereCol = params.projectId ? 'project_id' : 'contractor_bid_id';
  const whereId = params.projectId || params.contractorBidId || '';

  const rows = whereId
    ? (db
        .prepare(`
          SELECT
            id, recipient_type, recipient_name, recipient_account_ref,
            allotted_budget_inr, amount_inr, transfer_channel,
            transfer_reference, transfer_date, note, created_at
          FROM budget_payment_transfers
          WHERE ${whereCol} = ?
          ORDER BY created_at ASC, rowid ASC
        `)
        .all(whereId) as BudgetPaymentTransferRow[])
    : [];

  let creatorTransferred = 0;
  let contractorTransferred = 0;
  for (const r of rows) {
    if (r.recipient_type === 'creator_naman') creatorTransferred += r.amount_inr;
    else if (r.recipient_type === 'contractor') contractorTransferred += r.amount_inr;
  }

  const creatorRemaining = Math.max(0, split.creatorRewardInr - creatorTransferred);
  const contractorRemaining = Math.max(0, split.contractorNetInr - contractorTransferred);

  return {
    allotted_budget_inr: split.allottedBudgetInr,
    is_allotted: params.isAllotted,
    creator_account_name: CREATOR_REWARD_ACCOUNT_NAME,
    creator_reward_1pct_inr: split.creatorRewardInr,
    creator_transferred_inr: creatorTransferred,
    creator_remaining_inr: creatorRemaining,
    creator_reward_settled: params.isAllotted && creatorRemaining === 0 && split.creatorRewardInr > 0,
    contractor_name: params.contractorName ?? null,
    contractor_reg: params.contractorReg ?? null,
    contractor_net_99pct_inr: split.contractorNetInr,
    contractor_transferred_inr: contractorTransferred,
    contractor_remaining_inr: contractorRemaining,
    contractor_settled: params.isAllotted && contractorRemaining === 0 && split.contractorNetInr > 0,
    total_transferred_inr: creatorTransferred + contractorTransferred,
    transfers: params.includeTransfers === false ? [] : rows,
  };
}

export function initGovDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_approvals (
      id TEXT PRIMARY KEY,
      complaint_id TEXT NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES profiles(id),
      authority_department TEXT NOT NULL,
      authority_designation TEXT NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'more_info_requested')),
      decision_reason TEXT NOT NULL,
      reference_number TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_approvals_complaint ON project_approvals(complaint_id);

    CREATE TABLE IF NOT EXISTS government_projects (
      id TEXT PRIMARY KEY,
      project_code TEXT UNIQUE NOT NULL,
      complaint_id TEXT UNIQUE NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      approval_id TEXT NOT NULL REFERENCES project_approvals(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      location_id TEXT NOT NULL REFERENCES locations(id),
      generalized_location TEXT NOT NULL,
      department_name TEXT NOT NULL,
      sanctioned_budget_inr INTEGER NOT NULL,
      estimated_cost_inr INTEGER NOT NULL,
      tender_reference_number TEXT,
      approval_date TEXT NOT NULL,
      expected_completion_date TEXT NOT NULL,
      actual_completion_date TEXT,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN (
        'approved',
        'tendering',
        'awarded',
        'in_progress',
        'inspection',
        'completed',
        'on_hold',
        'cancelled'
      )),
      public_transparency_published INTEGER NOT NULL DEFAULT 0,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      completed_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_gov_projects_status ON government_projects(status, public_transparency_published);
    CREATE INDEX IF NOT EXISTS idx_gov_projects_dept ON government_projects(department_name);

    CREATE TABLE IF NOT EXISTS contractor_profiles (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      registered_business_name TEXT NOT NULL,
      logo_storage_path TEXT,
      logo_media_type TEXT,
      authorised_representative TEXT NOT NULL,
      govt_registration_number TEXT NOT NULL,
      registration_authority TEXT NOT NULL,
      registration_class TEXT,
      certifications_json TEXT NOT NULL DEFAULT '[]',
      previous_project_history TEXT,
      district_coverage TEXT,
      verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'suspended')),
      verified_by TEXT REFERENCES profiles(id),
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contractor_profiles_status ON contractor_profiles(verification_status);

    CREATE TABLE IF NOT EXISTS project_tenders (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      tender_reference_number TEXT NOT NULL,
      procurement_portal_name TEXT NOT NULL DEFAULT 'Uttarakhand e-Procurement Integration Placeholder',
      procurement_mechanism TEXT NOT NULL DEFAULT 'eprocurement_placeholder' CHECK (procurement_mechanism IN ('eprocurement_placeholder', 'authorised_govt_portal')),
      external_portal_url TEXT,
      is_official_integration_active INTEGER NOT NULL DEFAULT 0,
      estimated_tender_value_inr INTEGER NOT NULL,
      published_date TEXT,
      closing_date TEXT,
      tender_status TEXT NOT NULL DEFAULT 'published_external_placeholder' CHECK (tender_status IN (
        'draft',
        'published_external_placeholder',
        'bidding_closed',
        'evaluated',
        'awarded',
        'cancelled'
      )),
      recorded_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_tenders_project ON project_tenders(project_id);

    CREATE TABLE IF NOT EXISTS project_bids (
      id TEXT PRIMARY KEY,
      tender_id TEXT NOT NULL REFERENCES project_tenders(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      contractor_id TEXT NOT NULL REFERENCES contractor_profiles(id) ON DELETE CASCADE,
      official_bid_reference TEXT NOT NULL,
      quoted_amount_inr INTEGER NOT NULL,
      technical_score_note TEXT,
      bid_status TEXT NOT NULL DEFAULT 'recorded' CHECK (bid_status IN (
        'recorded',
        'technically_qualified',
        'lowest_evaluated',
        'awarded',
        'disqualified',
        'rejected'
      )),
      confidential_flag INTEGER NOT NULL DEFAULT 1,
      recorded_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (tender_id, contractor_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_bids_project ON project_bids(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_bids_contractor ON project_bids(contractor_id);

    CREATE TABLE IF NOT EXISTS project_awards (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      tender_id TEXT REFERENCES project_tenders(id) ON DELETE SET NULL,
      contractor_id TEXT NOT NULL REFERENCES contractor_profiles(id),
      winning_bid_id TEXT REFERENCES project_bids(id) ON DELETE SET NULL,
      awarded_amount_inr INTEGER NOT NULL,
      actual_paid_inr INTEGER NOT NULL DEFAULT 0,
      award_order_number TEXT NOT NULL,
      award_date TEXT NOT NULL,
      commencement_date TEXT,
      awarded_by TEXT NOT NULL REFERENCES profiles(id),
      remarks TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_awards_contractor ON project_awards(contractor_id);

    CREATE TABLE IF NOT EXISTS project_milestones (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
      milestone_status TEXT NOT NULL DEFAULT 'pending' CHECK (milestone_status IN ('pending', 'in_progress', 'completed', 'delayed')),
      target_date TEXT,
      completed_date TEXT,
      updated_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_milestones_project ON project_milestones(project_id);

    CREATE TABLE IF NOT EXISTS project_inspections (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      inspector_id TEXT NOT NULL REFERENCES profiles(id),
      inspector_name TEXT NOT NULL,
      inspector_designation TEXT NOT NULL,
      inspection_date TEXT NOT NULL,
      inspection_stage TEXT NOT NULL CHECK (inspection_stage IN ('commencement', 'mid_term', 'quality_test', 'final_completion', 'corrective_verification')),
      inspection_outcome TEXT NOT NULL CHECK (inspection_outcome IN ('satisfactory', 'defects_noted', 'corrective_verified', 'rejected')),
      summary TEXT NOT NULL,
      defects_found TEXT,
      corrective_action TEXT,
      corrective_status TEXT NOT NULL DEFAULT 'none' CHECK (corrective_status IN ('none', 'open', 'resolved')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_inspections_project ON project_inspections(project_id);

    CREATE TABLE IF NOT EXISTS project_media (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      uploader_id TEXT NOT NULL REFERENCES profiles(id),
      stage TEXT NOT NULL CHECK (stage IN ('before', 'during', 'after', 'inspection')),
      caption TEXT,
      storage_path TEXT NOT NULL,
      media_type TEXT NOT NULL,
      is_public INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_media_project ON project_media(project_id);

    CREATE TABLE IF NOT EXISTS janconnect_fee_records (
      id TEXT PRIMARY KEY,
      project_id TEXT UNIQUE NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      sanctioned_budget_inr INTEGER NOT NULL,
      awarded_contract_amount_inr INTEGER NOT NULL DEFAULT 0,
      actual_contractor_payments_inr INTEGER NOT NULL DEFAULT 0,
      fee_basis TEXT NOT NULL DEFAULT 'sanctioned_budget' CHECK (fee_basis IN (
        'sanctioned_budget',
        'awarded_contract_amount',
        'actual_contractor_payments',
        'custom_approved_base'
      )),
      approved_fee_base_inr INTEGER NOT NULL DEFAULT 0,
      fee_percentage REAL NOT NULL DEFAULT 1.0,
      calculated_fee_inr INTEGER NOT NULL DEFAULT 0,
      illustrative_execution_allocation_inr INTEGER NOT NULL DEFAULT 0,
      fee_status TEXT NOT NULL DEFAULT 'awaiting_government_approval' CHECK (fee_status IN (
        'not_applicable',
        'awaiting_government_approval',
        'approved',
        'awaiting_invoice',
        'invoice_issued',
        'payment_pending',
        'payment_received',
        'cancelled',
        'disputed'
      )),
      approval_authority TEXT,
      approval_reference TEXT,
      approval_date TEXT,
      latest_invoice_number TEXT,
      latest_payment_reference TEXT,
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      updated_by TEXT REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fee_records_status ON janconnect_fee_records(fee_status);

    CREATE TABLE IF NOT EXISTS fee_approval_records (
      id TEXT PRIMARY KEY,
      fee_record_id TEXT NOT NULL REFERENCES janconnect_fee_records(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      decision TEXT NOT NULL CHECK (decision IN ('approved', 'not_applicable', 'cancelled', 'disputed')),
      approved_fee_basis TEXT NOT NULL,
      approved_fee_base_inr INTEGER NOT NULL,
      approved_percentage REAL NOT NULL,
      approved_fee_inr INTEGER NOT NULL,
      approval_authority TEXT NOT NULL,
      approval_reference TEXT NOT NULL,
      agreement_clause TEXT,
      approval_date TEXT NOT NULL,
      remarks TEXT,
      actor_id TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fee_approvals_project ON fee_approval_records(project_id);

    CREATE TABLE IF NOT EXISTS fee_invoices (
      id TEXT PRIMARY KEY,
      fee_record_id TEXT NOT NULL REFERENCES janconnect_fee_records(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      invoice_number TEXT UNIQUE NOT NULL,
      invoice_date TEXT NOT NULL,
      due_date TEXT,
      billed_to_department TEXT NOT NULL,
      fee_base_inr INTEGER NOT NULL,
      fee_percentage REAL NOT NULL,
      invoice_amount_inr INTEGER NOT NULL,
      invoice_status TEXT NOT NULL DEFAULT 'issued' CHECK (invoice_status IN ('issued', 'payment_pending', 'paid', 'cancelled', 'disputed')),
      issued_by TEXT NOT NULL REFERENCES profiles(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fee_invoices_project ON fee_invoices(project_id);

    CREATE TABLE IF NOT EXISTS fee_payment_records (
      id TEXT PRIMARY KEY,
      fee_record_id TEXT NOT NULL REFERENCES janconnect_fee_records(id) ON DELETE CASCADE,
      invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES government_projects(id) ON DELETE CASCADE,
      payment_reference TEXT NOT NULL,
      payment_channel TEXT NOT NULL CHECK (payment_channel IN ('government_treasury_pfms', 'neft_rtgs_verified', 'gateway_verified')),
      amount_inr INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      gateway_verified INTEGER NOT NULL DEFAULT 0,
      gateway_provider TEXT NOT NULL DEFAULT 'Not Configured',
      remarks TEXT,
      recorded_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_fee_payments_project ON fee_payment_records(project_id);

    CREATE TABLE IF NOT EXISTS payment_gateway_settings (
      id TEXT PRIMARY KEY,
      gateway_enabled INTEGER NOT NULL DEFAULT 0,
      provider_name TEXT NOT NULL DEFAULT 'Not Configured',
      settlement_mode TEXT NOT NULL DEFAULT 'government_agreement_treasury' CHECK (settlement_mode IN ('government_agreement_treasury', 'future_verified_gateway')),
      business_legal_name TEXT NOT NULL DEFAULT '',
      business_account_label TEXT NOT NULL DEFAULT '',
      merchant_id_placeholder TEXT NOT NULL DEFAULT '',
      webhook_endpoint_path TEXT NOT NULL DEFAULT '/api/finance/payments/webhook',
      api_key_env_var TEXT NOT NULL DEFAULT 'JANCONNECT_PAYMENT_GATEWAY_KEY',
      api_secret_env_var TEXT NOT NULL DEFAULT 'JANCONNECT_PAYMENT_GATEWAY_SECRET',
      updated_by TEXT REFERENCES profiles(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO payment_gateway_settings (id, gateway_enabled, provider_name, settlement_mode)
    VALUES ('default', 0, 'Not Configured', 'government_agreement_treasury');

    CREATE TRIGGER IF NOT EXISTS trg_fee_approval_no_update
      BEFORE UPDATE ON fee_approval_records
      BEGIN SELECT RAISE(ABORT, 'Append-only financial approval ledger'); END;
    CREATE TRIGGER IF NOT EXISTS trg_fee_approval_no_delete
      BEFORE DELETE ON fee_approval_records
      BEGIN SELECT RAISE(ABORT, 'Append-only financial approval ledger'); END;

    CREATE TRIGGER IF NOT EXISTS trg_fee_payment_no_update
      BEFORE UPDATE ON fee_payment_records
      BEGIN SELECT RAISE(ABORT, 'Append-only payment verification ledger'); END;
    CREATE TRIGGER IF NOT EXISTS trg_fee_payment_no_delete
      BEFORE DELETE ON fee_payment_records
      BEGIN SELECT RAISE(ABORT, 'Append-only payment verification ledger'); END;
  `);

  const existingGovProjectCols = new Set(
    (db.prepare(`PRAGMA table_info(government_projects)`).all() as Array<{ name: string }>).map((c) => c.name)
  );
  const govProjectColMigrations: Array<[string, string]> = [
    ['budget_funded_by', 'TEXT'],
    ['is_pinned_work', 'INTEGER NOT NULL DEFAULT 0'],
    ['pinned_rank', 'INTEGER'],
    ['pinned_note', 'TEXT'],
    ['pinned_by', 'TEXT REFERENCES profiles(id) ON DELETE SET NULL'],
    ['pinned_at', 'TEXT'],
  ];
  for (const [col, def] of govProjectColMigrations) {
    if (!existingGovProjectCols.has(col)) {
      db.exec(`ALTER TABLE government_projects ADD COLUMN ${col} ${def}`);
    }
  }
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_gov_projects_pinned
      ON government_projects(is_pinned_work, pinned_rank, pinned_at);

    CREATE TABLE IF NOT EXISTS budget_payment_transfers (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES government_projects(id) ON DELETE CASCADE,
      contractor_bid_id TEXT REFERENCES contractor_bids(id) ON DELETE CASCADE,
      recipient_type TEXT NOT NULL CHECK (recipient_type IN ('creator_naman', 'contractor')),
      recipient_name TEXT NOT NULL,
      recipient_account_ref TEXT,
      allotted_budget_inr INTEGER NOT NULL CHECK (allotted_budget_inr >= 0),
      amount_inr INTEGER NOT NULL CHECK (amount_inr > 0),
      transfer_channel TEXT NOT NULL CHECK (transfer_channel IN ('treasury_pfms', 'neft_rtgs', 'upi_verified', 'bank_transfer')),
      transfer_reference TEXT NOT NULL,
      transfer_date TEXT NOT NULL,
      note TEXT,
      transferred_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK ((project_id IS NOT NULL AND contractor_bid_id IS NULL) OR (project_id IS NULL AND contractor_bid_id IS NOT NULL))
    );
    CREATE INDEX IF NOT EXISTS idx_budget_transfers_project ON budget_payment_transfers(project_id, created_at ASC);
    CREATE INDEX IF NOT EXISTS idx_budget_transfers_bid ON budget_payment_transfers(contractor_bid_id, created_at ASC);

    CREATE TRIGGER IF NOT EXISTS trg_budget_transfers_no_update
      BEFORE UPDATE ON budget_payment_transfers
      BEGIN SELECT RAISE(ABORT, 'Append-only budget payment transfer ledger'); END;
    CREATE TRIGGER IF NOT EXISTS trg_budget_transfers_no_delete
      BEFORE DELETE ON budget_payment_transfers
      BEGIN SELECT RAISE(ABORT, 'Append-only budget payment transfer ledger'); END;
  `);
}
