export const GOV_PROJECT_STATUSES = [
  'approved',
  'tendering',
  'awarded',
  'in_progress',
  'inspection',
  'completed',
  'on_hold',
  'cancelled',
] as const;

export type GovProjectStatus = (typeof GOV_PROJECT_STATUSES)[number];

export const GOV_PROJECT_STATUS_LABELS: Record<
  GovProjectStatus,
  { label: string; tone: 'neutral' | 'amber' | 'teal' | 'crimson' }
> = {
  approved: { label: 'Project Approved', tone: 'neutral' },
  tendering: { label: 'Tender / E-Procurement', tone: 'amber' },
  awarded: { label: 'Contract Awarded', tone: 'teal' },
  in_progress: { label: 'Execution In Progress', tone: 'amber' },
  inspection: { label: 'Under Govt Inspection', tone: 'amber' },
  completed: { label: 'Officially Completed', tone: 'teal' },
  on_hold: { label: 'On Hold', tone: 'crimson' },
  cancelled: { label: 'Cancelled', tone: 'crimson' },
};

export const FEE_STATUSES = [
  'not_applicable',
  'awaiting_government_approval',
  'approved',
  'awaiting_invoice',
  'invoice_issued',
  'payment_pending',
  'payment_received',
  'cancelled',
  'disputed',
] as const;

export type FeeStatus = (typeof FEE_STATUSES)[number];

export const FEE_STATUS_LABELS: Record<
  FeeStatus,
  { label: string; description: string; tone: 'neutral' | 'amber' | 'teal' | 'crimson' }
> = {
  not_applicable: {
    label: 'Not Applicable',
    description: 'Project excluded from JanConnect Digital Project Facilitation Fee.',
    tone: 'neutral',
  },
  awaiting_government_approval: {
    label: 'Awaiting Government Approval',
    description: 'Proposed 1% fee pending explicit government agreement and financial sanction.',
    tone: 'amber',
  },
  approved: {
    label: 'Approved',
    description: 'Legally approved by the competent government authority with sanctioned fee basis.',
    tone: 'teal',
  },
  awaiting_invoice: {
    label: 'Awaiting Invoice',
    description: 'Approved fee ready for JanConnect invoice generation.',
    tone: 'amber',
  },
  invoice_issued: {
    label: 'Invoice Issued',
    description: 'Formal fee invoice issued to the responsible government department.',
    tone: 'amber',
  },
  payment_pending: {
    label: 'Payment Pending',
    description: 'Invoice acknowledged; awaiting verified treasury or gateway settlement.',
    tone: 'amber',
  },
  payment_received: {
    label: 'Payment Received',
    description: 'Verified payment settlement recorded against the issued invoice.',
    tone: 'teal',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Fee levy cancelled by government or financial administration.',
    tone: 'crimson',
  },
  disputed: {
    label: 'Disputed',
    description: 'Fee calculation or billing is under formal review or dispute.',
    tone: 'crimson',
  },
};

export const FEE_BASES = [
  'sanctioned_budget',
  'awarded_contract_amount',
  'actual_contractor_payments',
  'custom_approved_base',
] as const;

export type FeeBasis = (typeof FEE_BASES)[number];

export const FEE_BASIS_LABELS: Record<FeeBasis, string> = {
  sanctioned_budget: 'Original Sanctioned Budget',
  awarded_contract_amount: 'Final Awarded Contractor Amount',
  actual_contractor_payments: 'Actual Contractor Payments',
  custom_approved_base: 'Custom Approved Fee Base',
};

export const DEFAULT_JANCONNECT_FEE_PERCENT = 1;

export function calculateJanConnectFee(params: {
  sanctionedBudgetInr: number;
  awardedContractAmountInr?: number | null;
  actualContractorPaymentsInr?: number | null;
  feeBasis: FeeBasis;
  customApprovedBaseInr?: number | null;
  feePercentage?: number;
}): {
  approvedFeeBaseInr: number;
  feePercentage: number;
  calculatedFeeInr: number;
  illustrativeExecutionAllocationInr: number;
} {
  const pct = Number.isFinite(params.feePercentage)
    ? Math.max(0, Math.min(10, Number(params.feePercentage)))
    : DEFAULT_JANCONNECT_FEE_PERCENT;

  const sanctioned = Math.max(0, Math.round(Number(params.sanctionedBudgetInr) || 0));
  const awarded = Math.max(0, Math.round(Number(params.awardedContractAmountInr) || 0));
  const actualPaid = Math.max(0, Math.round(Number(params.actualContractorPaymentsInr) || 0));
  const customBase = Math.max(0, Math.round(Number(params.customApprovedBaseInr) || 0));

  let base = sanctioned;
  if (params.feeBasis === 'awarded_contract_amount') {
    base = awarded;
  } else if (params.feeBasis === 'actual_contractor_payments') {
    base = actualPaid;
  } else if (params.feeBasis === 'custom_approved_base') {
    base = customBase;
  }

  const calculatedFeeInr = Math.round((base * pct) / 100);
  const illustrativeExecutionAllocationInr = Math.max(0, sanctioned - calculatedFeeInr);

  return {
    approvedFeeBaseInr: base,
    feePercentage: Number(pct.toFixed(2)),
    calculatedFeeInr,
    illustrativeExecutionAllocationInr,
  };
}

export function canIssueFeeInvoice(feeStatus: FeeStatus): boolean {
  return feeStatus === 'approved' || feeStatus === 'awaiting_invoice';
}

export function canRecordFeePayment(params: {
  feeStatus: FeeStatus;
  gatewayEnabled: boolean;
  gatewayVerified: boolean;
}): { allowed: boolean; error?: string } {
  if (
    params.feeStatus !== 'invoice_issued' &&
    params.feeStatus !== 'payment_pending'
  ) {
    return {
      allowed: false,
      error: 'An approved and issued invoice is required before recording a payment.',
    };
  }
  if (!params.gatewayEnabled) {
    return {
      allowed: false,
      error: 'Payment Gateway Not Configured. Payment collection is disabled until verified credentials are set.',
    };
  }
  if (!params.gatewayVerified) {
    return {
      allowed: false,
      error: 'Payment records can only be stored after verified payment gateway confirmation.',
    };
  }
  return { allowed: true };
}

export function validateGovernmentProjectInput(input: {
  title: string;
  description: string;
  departmentName: string;
  sanctionedBudgetInr: number;
  estimatedCostInr: number;
  expectedCompletionDate: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if ((input.title || '').trim().length < 6 || (input.title || '').trim().length > 160) {
    errors.title = 'Project title must be between 6 and 160 characters.';
  }
  if ((input.description || '').trim().length < 20 || (input.description || '').trim().length > 4000) {
    errors.description = 'Project description must be between 20 and 4,000 characters.';
  }
  if ((input.departmentName || '').trim().length < 3 || (input.departmentName || '').trim().length > 120) {
    errors.departmentName = 'Responsible government department must be between 3 and 120 characters.';
  }
  if (!Number.isInteger(input.sanctionedBudgetInr) || input.sanctionedBudgetInr < 10000 || input.sanctionedBudgetInr > 5000000000) {
    errors.sanctionedBudgetInr = 'Sanctioned budget must be a whole INR amount between ₹10,000 and ₹500,00,00,000.';
  }
  if (!Number.isInteger(input.estimatedCostInr) || input.estimatedCostInr < 1000 || input.estimatedCostInr > 5000000000) {
    errors.estimatedCostInr = 'Estimated execution cost must be a whole INR amount.';
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.expectedCompletionDate || '').trim())) {
    errors.expectedCompletionDate = 'Select a valid expected completion date (YYYY-MM-DD).';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateContractorProfileInput(input: {
  registeredBusinessName: string;
  authorisedRepresentative: string;
  govtRegistrationNumber: string;
  registrationAuthority: string;
}): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if ((input.registeredBusinessName || '').trim().length < 3 || (input.registeredBusinessName || '').trim().length > 140) {
    errors.registeredBusinessName = 'Registered business name must be between 3 and 140 characters.';
  }
  if ((input.authorisedRepresentative || '').trim().length < 2 || (input.authorisedRepresentative || '').trim().length > 100) {
    errors.authorisedRepresentative = 'Authorised representative name is required.';
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9\-\/\s]{3,48}[A-Za-z0-9]$/.test((input.govtRegistrationNumber || '').trim())) {
    errors.govtRegistrationNumber = 'Enter a valid government contractor registration reference.';
  }
  if ((input.registrationAuthority || '').trim().length < 2 || (input.registrationAuthority || '').trim().length > 120) {
    errors.registrationAuthority = 'Registration authority (e.g., Uttarakhand PWD / CPWD) is required.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export const CREATOR_REWARD_ACCOUNT_NAME = "Naman's Account";
export const CREATOR_REWARD_PERCENT = 1;
export const CONTRACTOR_NET_PERCENT = 99;

export const PAYMENT_TRANSFER_CHANNELS = [
  'treasury_pfms',
  'neft_rtgs',
  'upi_verified',
  'bank_transfer',
] as const;

export type PaymentTransferChannel = (typeof PAYMENT_TRANSFER_CHANNELS)[number];

export const PAYMENT_TRANSFER_CHANNEL_LABELS: Record<PaymentTransferChannel, string> = {
  treasury_pfms: 'PFMS / Govt Treasury',
  neft_rtgs: 'NEFT / RTGS Bank Transfer',
  upi_verified: 'Verified UPI Settlement',
  bank_transfer: 'Direct Bank Transfer (IMPS/Account)',
};

export type BudgetTransferMode = 'full_split' | 'creator_1pct' | 'contractor_99pct';

export function calculateBudgetDisbursementSplit(allottedBudgetInr: number): {
  allottedBudgetInr: number;
  creatorAccountName: string;
  creatorRewardPercent: number;
  creatorRewardInr: number;
  contractorNetPercent: number;
  contractorNetInr: number;
} {
  const safeAllotted = Math.max(0, Math.round(Number(allottedBudgetInr) || 0));
  const creatorRewardInr = Math.round((safeAllotted * CREATOR_REWARD_PERCENT) / 100);
  const contractorNetInr = Math.max(0, safeAllotted - creatorRewardInr);

  return {
    allottedBudgetInr: safeAllotted,
    creatorAccountName: CREATOR_REWARD_ACCOUNT_NAME,
    creatorRewardPercent: CREATOR_REWARD_PERCENT,
    creatorRewardInr,
    contractorNetPercent: CONTRACTOR_NET_PERCENT,
    contractorNetInr,
  };
}

export function validatePaymentTransferInput(input: {
  transferMode?: string;
  amountInr?: number | null;
  transferChannel?: string;
  transferReference?: string;
  transferDate?: string;
  note?: string;
}): {
  valid: boolean;
  error?: string;
  value?: {
    transferMode: BudgetTransferMode;
    amountInr: number | null;
    transferChannel: PaymentTransferChannel;
    transferReference: string;
    transferDate: string;
    note: string | null;
  };
} {
  const mode = input.transferMode;
  if (mode !== 'full_split' && mode !== 'creator_1pct' && mode !== 'contractor_99pct') {
    return { valid: false, error: 'Select a valid transfer mode (Full Split, 1% Creator Reward, or 99% Contractor Payment).' };
  }

  const channel = input.transferChannel as PaymentTransferChannel;
  if (!channel || !PAYMENT_TRANSFER_CHANNELS.includes(channel)) {
    return { valid: false, error: 'Select a valid payment transfer channel.' };
  }

  const ref = (input.transferReference || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (ref.length < 4 || ref.length > 64 || /[<>]/.test(ref) || !/^[A-Za-z0-9\-_/.:\s]+$/.test(ref)) {
    return {
      valid: false,
      error: 'Enter a valid transaction / UTR / treasury reference (4–64 characters, letters, numbers, -, _, /).',
    };
  }

  const dateStr = (input.transferDate || '').trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: 'Enter a valid transfer date (YYYY-MM-DD).' };
  }

  const cleanNote = (input.note || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (cleanNote.length > 240 || /[<>]/.test(cleanNote)) {
    return { valid: false, error: 'Transfer note must be plain text under 240 characters.' };
  }

  let parsedAmount: number | null = null;
  if (input.amountInr !== undefined && input.amountInr !== null && String(input.amountInr).trim() !== '') {
    const num = Math.round(Number(input.amountInr));
    if (!Number.isInteger(num) || num <= 0 || num > 5000000000) {
      return { valid: false, error: 'Transfer amount must be a positive whole INR figure.' };
    }
    parsedAmount = num;
  }

  if (mode === 'contractor_99pct' && parsedAmount === null) {
    return { valid: false, error: 'Specify the INR amount to transfer to the contractor account.' };
  }

  return {
    valid: true,
    value: {
      transferMode: mode,
      amountInr: parsedAmount,
      transferChannel: channel,
      transferReference: ref,
      transferDate: dateStr,
      note: cleanNote || null,
    },
  };
}

