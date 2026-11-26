import type { FeeBasis, FeeStatus, GovProjectStatus } from '../utils/govRules';

export interface BudgetPaymentTransfer {
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

export interface BudgetPaymentBreakdown {
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
  transfers: BudgetPaymentTransfer[];
}

export interface ProjectApproval {
  id: string;
  complaint_id: string;
  reviewer_id: string;
  reviewer_username?: string;
  reviewer_display_name?: string;
  authority_department: string;
  authority_designation: string;
  decision: 'approved' | 'rejected' | 'more_info_requested';
  decision_reason: string;
  reference_number: string;
  created_at: string;
  updated_at: string;
}

export interface ContractorProfile {
  id: string;
  owner_user_id: string;
  owner_username?: string;
  registered_business_name: string;
  logo_url: string | null;
  authorised_representative: string;
  govt_registration_number: string;
  registration_authority: string;
  registration_class: string | null;
  certifications: string[];
  previous_project_history: string | null;
  district_coverage: string | null;
  verification_status: 'pending' | 'verified' | 'suspended';
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
  awarded_count?: number;
  completed_count?: number;
}

export interface GovernmentProject {
  id: string;
  project_code: string;
  complaint_id: string;
  complaint_title?: string;
  approval_id: string;
  title: string;
  description: string;
  location_id: string;
  generalized_location: string;
  department_name: string;
  sanctioned_budget_inr: number;
  estimated_cost_inr: number;
  tender_reference_number: string | null;
  approval_date: string;
  expected_completion_date: string;
  actual_completion_date: string | null;
  status: GovProjectStatus;
  public_transparency_published: boolean;
  created_by: string;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
  awarded_contractor_id?: string | null;
  awarded_contractor_name?: string | null;
  awarded_contractor_logo?: string | null;
  awarded_contractor_reg?: string | null;
  awarded_amount_inr?: number | null;
  fee_status?: FeeStatus | null;
  calculated_fee_inr?: number | null;
  budget_funded_by?: string | null;
  is_pinned_work?: boolean;
  pinned_rank?: number | null;
  pinned_note?: string | null;
  pinned_at?: string | null;
  payment_breakdown?: BudgetPaymentBreakdown;
}

export interface PinnedWorkDoneItem {
  id: string;
  project_code: string;
  complaint_id: string;
  title: string;
  description: string;
  generalized_location: string;
  department_name: string;
  sanctioned_budget_inr: number;
  awarded_amount_inr: number | null;
  actual_completion_date: string | null;
  budget_funded_by: string | null;
  awarded_contractor_id: string | null;
  awarded_contractor_name: string | null;
  awarded_contractor_reg: string | null;
  awarded_contractor_logo: string | null;
  pinned_rank: number | null;
  pinned_note: string | null;
  pinned_at: string | null;
  before_media_url: string | null;
  after_media_url: string | null;
  payment_breakdown?: BudgetPaymentBreakdown;
}

export interface ProjectTender {
  id: string;
  project_id: string;
  tender_reference_number: string;
  procurement_portal_name: string;
  procurement_mechanism: 'eprocurement_placeholder' | 'authorised_govt_portal';
  external_portal_url: string | null;
  is_official_integration_active: boolean;
  estimated_tender_value_inr: number;
  published_date: string | null;
  closing_date: string | null;
  tender_status: 'draft' | 'published_external_placeholder' | 'bidding_closed' | 'evaluated' | 'awarded' | 'cancelled';
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export interface OfficialProjectBid {
  id: string;
  tender_id: string;
  project_id: string;
  contractor_id: string;
  contractor_name?: string;
  govt_registration_number?: string;
  official_bid_reference: string;
  quoted_amount_inr: number;
  technical_score_note: string | null;
  bid_status: 'recorded' | 'technically_qualified' | 'lowest_evaluated' | 'awarded' | 'disqualified' | 'rejected';
  confidential_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectAward {
  id: string;
  project_id: string;
  tender_id: string | null;
  contractor_id: string;
  contractor_name?: string;
  contractor_logo?: string | null;
  govt_registration_number?: string;
  winning_bid_id: string | null;
  awarded_amount_inr: number;
  actual_paid_inr: number;
  award_order_number: string;
  award_date: string;
  commencement_date: string | null;
  awarded_by: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  progress_percent: number;
  milestone_status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  target_date: string | null;
  completed_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectInspection {
  id: string;
  project_id: string;
  inspector_id: string;
  inspector_name: string;
  inspector_designation: string;
  inspection_date: string;
  inspection_stage: 'commencement' | 'mid_term' | 'quality_test' | 'final_completion' | 'corrective_verification';
  inspection_outcome: 'satisfactory' | 'defects_noted' | 'corrective_verified' | 'rejected';
  summary: string;
  defects_found: string | null;
  corrective_action: string | null;
  corrective_status: 'none' | 'open' | 'resolved';
  created_at: string;
  updated_at: string;
}

export interface ProjectMediaItem {
  id: string;
  project_id: string;
  stage: 'before' | 'during' | 'after' | 'inspection';
  caption: string | null;
  media_type: string;
  url: string;
  is_public: boolean;
  created_at: string;
}

export interface JanConnectFeeRecord {
  id: string;
  project_id: string;
  project_code?: string;
  project_title?: string;
  department_name?: string;
  project_status?: GovProjectStatus;
  sanctioned_budget_inr: number;
  awarded_contract_amount_inr: number;
  actual_contractor_payments_inr: number;
  fee_basis: FeeBasis;
  approved_fee_base_inr: number;
  fee_percentage: number;
  calculated_fee_inr: number;
  illustrative_execution_allocation_inr: number;
  fee_status: FeeStatus;
  approval_authority: string | null;
  approval_reference: string | null;
  approval_date: string | null;
  latest_invoice_number: string | null;
  latest_payment_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeeApprovalRecord {
  id: string;
  fee_record_id: string;
  project_id: string;
  decision: 'approved' | 'not_applicable' | 'cancelled' | 'disputed';
  approved_fee_basis: FeeBasis;
  approved_fee_base_inr: number;
  approved_percentage: number;
  approved_fee_inr: number;
  approval_authority: string;
  approval_reference: string;
  agreement_clause: string | null;
  approval_date: string;
  remarks: string | null;
  actor_username?: string;
  created_at: string;
}

export interface FeeInvoice {
  id: string;
  fee_record_id: string;
  project_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  billed_to_department: string;
  fee_base_inr: number;
  fee_percentage: number;
  invoice_amount_inr: number;
  invoice_status: 'issued' | 'payment_pending' | 'paid' | 'cancelled' | 'disputed';
  notes: string | null;
  created_at: string;
}

export interface FeePaymentRecord {
  id: string;
  fee_record_id: string;
  invoice_id: string;
  project_id: string;
  payment_reference: string;
  payment_channel: 'government_treasury_pfms' | 'neft_rtgs_verified' | 'gateway_verified';
  amount_inr: number;
  payment_date: string;
  gateway_verified: boolean;
  gateway_provider: string;
  remarks: string | null;
  created_at: string;
}

export interface PaymentGatewaySettings {
  id: string;
  gateway_enabled: boolean;
  gateway_configured_on_server: boolean;
  provider_name: string;
  settlement_mode: 'government_agreement_treasury' | 'future_verified_gateway';
  business_legal_name: string;
  business_account_label: string;
  merchant_id_placeholder: string;
  webhook_endpoint_path: string;
  api_key_env_var: string;
  api_secret_env_var: string;
  updated_at: string;
}

export interface FinanceDashboardResponse {
  summary: {
    totalProjectsRegistered: number;
    totalEligibleProjects: number;
    totalProposedFeesInr: number;
    totalApprovedFeesInr: number;
    totalInvoicedFeesInr: number;
    totalPaymentsReceivedInr: number;
    totalPendingPaymentsInr: number;
    totalCancelledOrDisputedInr: number;
  };
  gatewayConfigured: boolean;
  records: JanConnectFeeRecord[];
  invoices: FeeInvoice[];
  payments: FeePaymentRecord[];
}
