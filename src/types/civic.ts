import type { BidStatus, PlatformStatus, UserRole } from '../utils/civicRules';
import type { BudgetPaymentBreakdown } from './gov';

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  location_id: string | null;
  account_status: 'active' | 'restricted' | 'suspended';
  phone_verified: boolean;
  identity_status: 'unverified' | 'pending' | 'verified' | 'rejected' | 'expired';
  roles: UserRole[];
  created_at: string;
}

export interface RuntimeHealth {
  ok: boolean;
  backendMode: 'supabase-configured' | 'local-sqlite-v01';
  supabaseConfigured: boolean;
  mapsConfigured: boolean;
  geminiConfigured: boolean;
  identityProviderConfigured: boolean;
  ageConsentGateMode: string;
}

export interface LocationNode {
  id: string;
  parent_id: string | null;
  name: string;
  type: 'country' | 'state' | 'district' | 'block' | 'locality';
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LocationSearchResult extends LocationNode {
  district_id: string | null;
  district_name: string | null;
  block_id: string | null;
  block_name: string | null;
  state_id: string | null;
  generalized_label: string;
}

export interface PublicReportSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  location_id: string;
  generalized_location: string;
  district_id: string | null;
  district_name: string | null;
  platform_status: PlatformStatus;
  created_at: string;
  published_at: string | null;
  support_count: number;
  comment_count: number;
  bid_count?: number;
  lowest_bid_inr?: number | null;
  awarded_bid_id?: string | null;
  awarded_amount_inr?: number | null;
  awarded_contractor_company?: string | null;
  awarded_budget_funded_by?: string | null;
  awarded_payment_breakdown?: BudgetPaymentBreakdown | null;
  preview_media_url: string | null;
  preview_media_type: string | null;
  user_has_supported: boolean;
}

export interface ContractorBid {
  id: string;
  complaint_id: string;
  contractor_id: string;
  contractor_username: string;
  contractor_display_name: string;
  company_name: string;
  registration_number: string;
  bid_amount_inr: number;
  estimated_days: number;
  warranty_months: number;
  proposal_summary: string;
  budget_funded_by?: string | null;
  bid_status: BidStatus;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  payment_breakdown?: BudgetPaymentBreakdown;
}

export interface MyContractorBid extends ContractorBid {
  report_title: string;
  report_category: string;
  generalized_location: string;
}

export interface AdminContractorBidRow extends ContractorBid {
  report_title: string;
  report_category: string;
  generalized_location: string;
}

export interface MediaAsset {
  id: string;
  media_type: string;
  url: string;
  review_status?: string;
}

export interface ReportComment {
  id: string;
  content: string;
  created_at: string;
  author_username: string;
  author_display_name: string;
}

export interface StatusHistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: PlatformStatus;
  reason: string | null;
  created_at: string;
}

export interface MyReportSummary {
  id: string;
  title: string;
  description: string;
  category: string;
  generalized_location: string;
  platform_status: PlatformStatus;
  visibility: 'private' | 'public';
  created_at: string;
  updated_at: string;
  published_at: string | null;
  support_count: number;
}

export interface NotificationItem {
  id: string;
  type: string;
  related_id: string | null;
  message: string;
  is_read: number;
  created_at: string;
}

export interface VerificationSummary {
  id: string;
  provider_name: string;
  provider_reference: string;
  id_type: 'voter_id' | 'driving_licence' | 'passport' | 'pan' | 'aadhaar_vid' | null;
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

export interface AdminVerificationRow extends VerificationSummary {
  user_id: string;
  username: string;
  display_name: string;
  account_status: string;
  phone_verified: boolean;
}

export interface AdminAnalyticsResponse {
  metrics: {
    totalSubmitted: number;
    pendingModeration: number;
    publishedReports: number;
    rejectedReports: number;
    removedReports: number;
    reportedContent: number;
    pendingVerifications?: number;
    activeBids?: number;
  };
  byCategory: Array<{ category: string; count: number }>;
  byDistrict: Array<{ district: string; count: number }>;
}

export interface AdminReportRow {
  id: string;
  title: string;
  category: string;
  generalized_location: string;
  platform_status: PlatformStatus;
  visibility: 'private' | 'public';
  created_at: string;
  published_at: string | null;
  author_username: string;
  author_display_name: string;
  media_count: number;
}
