export const REPORT_CATEGORIES = [
  'Roads and Transportation',
  'Water Supply',
  'Electricity',
  'Drainage and Sanitation',
  'Government Hospitals',
  'Education',
  'Public Infrastructure',
  'Public Safety and Accessibility',
  'Environment and Public Spaces',
  'Government Services',
  'Other Civic Problems',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const PLATFORM_STATUSES = [
  'submitted',
  'under_review',
  'additional_information_required',
  'published',
  'rejected',
  'removed',
] as const;

export type PlatformStatus = (typeof PLATFORM_STATUSES)[number];

export type ModerationActionType =
  | 'start_review'
  | 'request_info'
  | 'publish'
  | 'reject'
  | 'remove';

export type UserRole = 'citizen' | 'moderator' | 'administrator' | 'government_authority' | 'financial_admin';

export interface StatusPresentation {
  label: string;
  description: string;
  tone: 'neutral' | 'amber' | 'teal' | 'crimson';
}

export const STATUS_LABELS: Record<PlatformStatus, StatusPresentation> = {
  submitted: {
    label: 'Submitted (Private Review Queue)',
    description: 'Received by जनConnect and awaiting human moderation before public visibility.',
    tone: 'neutral',
  },
  under_review: {
    label: 'Under जनConnect Review',
    description: 'A जनConnect moderator is reviewing privacy, safety, and clarity checks.',
    tone: 'amber',
  },
  additional_information_required: {
    label: 'More Context Requested',
    description: 'A moderator requested clarification or updated details before publication.',
    tone: 'amber',
  },
  published: {
    label: 'Published on जनConnect',
    description: 'Visible publicly on जनConnect for community awareness. Not an official government filing.',
    tone: 'teal',
  },
  rejected: {
    label: 'Not Published',
    description: 'Declined for public listing per जनConnect community and privacy guidelines.',
    tone: 'crimson',
  },
  removed: {
    label: 'Removed from Public View',
    description: 'Hidden from public feeds following moderation or safety review.',
    tone: 'crimson',
  },
};

export interface ReportDraftInput {
  title: string;
  description: string;
  category: string;
  stateId: string;
  districtId: string;
  blockId: string;
  localityId: string;
  approximateLat?: number | null;
  approximateLng?: number | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  piiWarnings: string[];
}

const PHONE_PATTERN = /\b(?:\+?91[\s-]?)?[6-9]\d{9}\b/;
const AADHAAR_PATTERN = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

export function detectPotentialPiiHints(text: string): string[] {
  const warnings: string[] = [];
  if (PHONE_PATTERN.test(text)) {
    warnings.push('Possible mobile number detected. Please remove personal phone numbers before submitting.');
  }
  if (AADHAAR_PATTERN.test(text)) {
    warnings.push('Possible 12-digit ID number detected. Never include Aadhaar or personal ID numbers.');
  }
  if (EMAIL_PATTERN.test(text)) {
    warnings.push('Possible email address detected. Avoid sharing private contact details publicly.');
  }
  return warnings;
}

export function validateReportDraft(input: ReportDraftInput): ValidationResult {
  const errors: Record<string, string> = {};
  const title = (input.title || '').trim();
  const description = (input.description || '').trim();

  if (title.length < 8 || title.length > 140) {
    errors.title = 'Title must be between 8 and 140 characters.';
  }
  if (description.length < 20 || description.length > 3000) {
    errors.description = 'Description must be between 20 and 3000 characters.';
  }
  if (!REPORT_CATEGORIES.includes(input.category as ReportCategory)) {
    errors.category = 'Please select a valid civic category.';
  }
  if (!input.stateId) {
    errors.stateId = 'Please select a state.';
  }
  if (!input.districtId) {
    errors.districtId = 'Please select a district.';
  }
  if (!input.blockId) {
    errors.blockId = 'Please select a block or municipality.';
  }
  if (!input.localityId) {
    errors.localityId = 'Please select a village or locality.';
  }

  if (input.approximateLat != null && (input.approximateLat < 6 || input.approximateLat > 38)) {
    errors.coordinates = 'Pinned location must fall within India.';
  }
  if (input.approximateLng != null && (input.approximateLng < 68 || input.approximateLng > 98)) {
    errors.coordinates = 'Pinned location must fall within India.';
  }

  const piiWarnings = detectPotentialPiiHints(`${title}\n${description}`);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    piiWarnings,
  };
}

export function validateCommentContent(content: string): { valid: boolean; error?: string; piiWarnings: string[] } {
  const trimmed = (content || '').trim();
  if (trimmed.length < 2) {
    return { valid: false, error: 'Comment must be at least 2 characters.', piiWarnings: [] };
  }
  if (trimmed.length > 1000) {
    return { valid: false, error: 'Comment cannot exceed 1000 characters.', piiWarnings: [] };
  }
  const piiWarnings = detectPotentialPiiHints(trimmed);
  return { valid: true, piiWarnings };
}

export function validateUsername(username: string): string | null {
  const clean = (username || '').trim().toLowerCase();
  if (clean.length < 3 || clean.length > 32) {
    return 'Username must be between 3 and 32 characters.';
  }
  if (!/^[a-z0-9_]+$/.test(clean)) {
    return 'Username may only contain lowercase letters, numbers, and underscores.';
  }
  return null;
}

export function formatGeneralizedLocation(parts: {
  locality?: string | null;
  block?: string | null;
  district?: string | null;
  state?: string | null;
}): string {
  const list = [parts.locality, parts.block, parts.district, parts.state]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return list.join(', ');
}

export function isPubliclyVisible(status: PlatformStatus, visibility: 'private' | 'public'): boolean {
  return status === 'published' && visibility === 'public';
}

export function canModeratorTransition(
  currentStatus: PlatformStatus,
  action: ModerationActionType
): { allowed: boolean; nextStatus: PlatformStatus; nextVisibility: 'private' | 'public'; reason?: string } {
  switch (action) {
    case 'start_review':
      if (currentStatus === 'submitted' || currentStatus === 'additional_information_required') {
        return { allowed: true, nextStatus: 'under_review', nextVisibility: 'private' };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: 'private', reason: 'Report is not awaiting initial review.' };
    case 'request_info':
      if (currentStatus === 'submitted' || currentStatus === 'under_review') {
        return { allowed: true, nextStatus: 'additional_information_required', nextVisibility: 'private' };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: 'private', reason: 'Cannot request info from current status.' };
    case 'publish':
      if (
        currentStatus === 'submitted' ||
        currentStatus === 'under_review' ||
        currentStatus === 'additional_information_required' ||
        currentStatus === 'removed'
      ) {
        return { allowed: true, nextStatus: 'published', nextVisibility: 'public' };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: 'private', reason: 'Rejected reports cannot be directly published without resubmission.' };
    case 'reject':
      if (currentStatus === 'submitted' || currentStatus === 'under_review' || currentStatus === 'additional_information_required') {
        return { allowed: true, nextStatus: 'rejected', nextVisibility: 'private' };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: 'private', reason: 'Only pending reports can be rejected.' };
    case 'remove':
      if (currentStatus === 'published') {
        return { allowed: true, nextStatus: 'removed', nextVisibility: 'private' };
      }
      return { allowed: false, nextStatus: currentStatus, nextVisibility: 'private', reason: 'Only published reports can be removed.' };
  }
}

export const MAX_ATTACHMENT_MB = 50;
export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * 1024 * 1024;

export function formatFileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function validateAttachmentMetadata(file: { size: number; mimeType: string }): string | null {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4'];
  if (!allowed.includes(file.mimeType)) {
    return 'Only JPEG, PNG, WebP images and MP4 videos are allowed.';
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return `Each attachment must be ${MAX_ATTACHMENT_MB} MB or smaller.`;
  }
  return null;
}

export function isAgeConsentGateApproved(): boolean {
  // Configurable gate: defaults to gated pending legal and child-safety counsel approval.
  const mode = typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_AGE_CONSENT_GATE_MODE;
  return mode === 'approved';
}

export function validateResetEmail(rawEmail: string): { valid: boolean; email: string; error?: string } {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) {
    return { valid: false, email: '', error: 'Please enter your email address.' };
  }
  if (/[\r\n]/.test(rawEmail) || email.length > 254) {
    return { valid: false, email: '', error: 'Please enter a valid email address.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { valid: false, email: '', error: 'Please enter a valid email address (e.g., citizen@example.com).' };
  }
  return { valid: true, email };
}

export function validateNewPassword(
  password: string,
  confirmPassword: string
): { valid: boolean; error?: string } {
  if (!password || password.length < 8 || password.length > 128) {
    return { valid: false, error: 'Password must be between 8 and 128 characters.' };
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one letter and one number.' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }
  return { valid: true };
}

export function buildSafePasswordResetRedirectUrl(origin: string): string {
  const cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(cleanOrigin);
    const isAllowed =
      parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'));
    if (!isAllowed) {
      throw new Error('Unsupported redirect origin protocol.');
    }
    return `${parsed.origin}/reset-password`;
  } catch {
    return 'http://localhost:3000/reset-password';
  }
}

export function normalizePinnedCoordinates(
  lat: number,
  lng: number
): { valid: boolean; lat: string; lng: string; error?: string } {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, lat: '', lng: '', error: 'Invalid map pin coordinates.' };
  }
  if (lat < 6 || lat > 38 || lng < 68 || lng > 98) {
    return { valid: false, lat: '', lng: '', error: 'Pinned location must fall within India.' };
  }
  return {
    valid: true,
    lat: lat.toFixed(5),
    lng: lng.toFixed(5),
  };
}

export const BID_STATUSES = ['submitted', 'shortlisted', 'awarded', 'rejected', 'withdrawn'] as const;
export type BidStatus = (typeof BID_STATUSES)[number];

export interface BidStatusPresentation {
  label: string;
  tone: 'neutral' | 'amber' | 'teal' | 'crimson';
}

export const BID_STATUS_LABELS: Record<BidStatus, BidStatusPresentation> = {
  submitted: { label: 'Bid Submitted', tone: 'neutral' },
  shortlisted: { label: 'Shortlisted', tone: 'amber' },
  awarded: { label: 'Work Awarded', tone: 'teal' },
  rejected: { label: 'Not Selected', tone: 'crimson' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export interface ContractorBidInput {
  companyName: string;
  registrationNumber: string;
  bidAmountInr: number;
  estimatedDays: number;
  warrantyMonths: number;
  proposalSummary: string;
  budgetFundedBy?: string | null;
}

export function validateBudgetFundedBy(raw?: string | null): { valid: boolean; value: string | null; error?: string } {
  const cleaned = (raw || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!cleaned) {
    return { valid: true, value: null };
  }
  if (cleaned.length < 2 || cleaned.length > 120) {
    return {
      valid: false,
      value: null,
      error: 'Budget funding party or sponsor attribution must be between 2 and 120 characters.',
    };
  }
  if (/[<>]/.test(cleaned)) {
    return {
      valid: false,
      value: null,
      error: 'Budget funding attribution cannot contain HTML characters.',
    };
  }
  return { valid: true, value: cleaned };
}

export function formatInrCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function validateContractorBid(input: ContractorBidInput): ValidationResult {
  const errors: Record<string, string> = {};
  const companyName = (input.companyName || '').trim();
  const registrationNumber = (input.registrationNumber || '').trim();
  const proposalSummary = (input.proposalSummary || '').trim();
  const bidAmountInr = Number(input.bidAmountInr);
  const estimatedDays = Number(input.estimatedDays);
  const warrantyMonths = Number(input.warrantyMonths);

  if (companyName.length < 3 || companyName.length > 100) {
    errors.companyName = 'Contractor or firm name must be between 3 and 100 characters.';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9\-\/\s]{2,38}[A-Za-z0-9]$/.test(registrationNumber)) {
    errors.registrationNumber = 'Enter a valid contractor registration or GSTIN/license reference (4–40 alphanumeric characters).';
  }
  if (!Number.isInteger(bidAmountInr) || bidAmountInr < 1000 || bidAmountInr > 500000000) {
    errors.bidAmountInr = 'Bid amount must be a whole rupee amount between ₹1,000 and ₹50,00,00,000.';
  }
  if (!Number.isInteger(estimatedDays) || estimatedDays < 1 || estimatedDays > 730) {
    errors.estimatedDays = 'Estimated completion timeline must be between 1 and 730 days.';
  }
  if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 120) {
    errors.warrantyMonths = 'Workmanship warranty must be between 0 and 120 months.';
  }
  if (proposalSummary.length < 20 || proposalSummary.length > 1500) {
    errors.proposalSummary = 'Work execution & materials proposal must be between 20 and 1,500 characters.';
  }

  const fundingCheck = validateBudgetFundedBy(input.budgetFundedBy);
  if (!fundingCheck.valid && fundingCheck.error) {
    errors.budgetFundedBy = fundingCheck.error;
  }

  const piiWarnings = detectPotentialPiiHints(`${companyName}\n${proposalSummary}`);

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    piiWarnings,
  };
}
