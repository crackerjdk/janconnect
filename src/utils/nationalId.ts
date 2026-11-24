export type NationalIdType =
  | 'voter_id'
  | 'driving_licence'
  | 'passport'
  | 'pan'
  | 'aadhaar_vid';

export interface NationalIdTypeOption {
  value: NationalIdType;
  label: string;
  placeholder: string;
  formatHint: string;
}

export const NATIONAL_ID_OPTIONS: NationalIdTypeOption[] = [
  {
    value: 'voter_id',
    label: 'Voter ID (EPIC)',
    placeholder: 'e.g. UKD1234567',
    formatHint: '3 uppercase letters followed by 7 digits.',
  },
  {
    value: 'driving_licence',
    label: 'Driving Licence',
    placeholder: 'e.g. UK0720190012345',
    formatHint: '2-letter state code + 13 digits (spaces/hyphens ignored).',
  },
  {
    value: 'passport',
    label: 'Indian Passport',
    placeholder: 'e.g. A1234567',
    formatHint: '1 uppercase letter followed by 7 digits.',
  },
  {
    value: 'pan',
    label: 'PAN Card',
    placeholder: 'e.g. ABCDE1234F',
    formatHint: '5 letters + 4 digits + 1 letter.',
  },
  {
    value: 'aadhaar_vid',
    label: 'Aadhaar / Virtual ID (VID)',
    placeholder: '12-digit Aadhaar or 16-digit VID',
    formatHint: 'Only a salted cryptographic hash and last 4 digits are stored — never the raw number.',
  },
];

const ID_LABEL_MAP: Record<NationalIdType, string> = {
  voter_id: 'Voter ID (EPIC)',
  driving_licence: 'Driving Licence',
  passport: 'Indian Passport',
  pan: 'PAN Card',
  aadhaar_vid: 'Aadhaar / Virtual ID',
};

export function getNationalIdLabel(type: string | null | undefined): string {
  if (!type || !(type in ID_LABEL_MAP)) return 'Identity Record';
  return ID_LABEL_MAP[type as NationalIdType];
}

export function normalizeNationalId(raw: string): string {
  return raw.replace(/[\s-]+/g, '').trim().toUpperCase();
}

export function maskNationalId(type: NationalIdType, normalized: string): string {
  const last4 = normalized.slice(-4);
  if (type === 'aadhaar_vid') {
    return normalized.length === 16 ? `XXXX-XXXX-XXXX-${last4}` : `XXXX-XXXX-${last4}`;
  }
  const hiddenLen = Math.max(4, normalized.length - 4);
  return `${'•'.repeat(hiddenLen)}${last4}`;
}

export function validateLegalName(name: string): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = name.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || cleaned.length > 80) {
    return { valid: false, cleaned, error: 'Legal name must be between 2 and 80 characters.' };
  }
  if (!/^[\p{L}\s.'-]+$/u.test(cleaned)) {
    return { valid: false, cleaned, error: 'Legal name may only contain letters, spaces, dots, hyphens, and apostrophes.' };
  }
  return { valid: true, cleaned };
}

export function validateNationalIdFormat(
  type: NationalIdType,
  rawInput: string
): { valid: boolean; normalized: string; masked: string; error?: string } {
  const normalized = normalizeNationalId(rawInput);

  if (!normalized) {
    return { valid: false, normalized: '', masked: '', error: 'Please enter your National ID number.' };
  }

  let pattern: RegExp;
  let errorMsg: string;

  switch (type) {
    case 'voter_id':
      pattern = /^[A-Z]{3}[0-9]{7}$/;
      errorMsg = 'Voter ID (EPIC) must be 3 letters followed by 7 digits (e.g., UKD1234567).';
      break;
    case 'driving_licence':
      pattern = /^[A-Z]{2}[0-9]{13}$/;
      errorMsg = 'Driving Licence must be 2 state letters followed by 13 digits (e.g., UK0720190012345).';
      break;
    case 'passport':
      pattern = /^[A-PR-WY][0-9]{7}$/;
      errorMsg = 'Indian Passport must be 1 valid letter followed by 7 digits.';
      break;
    case 'pan':
      pattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
      errorMsg = 'PAN Card must match the 10-character format (e.g., ABCDE1234F).';
      break;
    case 'aadhaar_vid':
      pattern = /^(?:[0-9]{12}|[0-9]{16})$/;
      errorMsg = 'Enter a valid 12-digit Aadhaar or 16-digit Virtual ID (VID).';
      break;
    default:
      return { valid: false, normalized: '', masked: '', error: 'Unsupported National ID type.' };
  }

  if (!pattern.test(normalized)) {
    return { valid: false, normalized, masked: '', error: errorMsg };
  }

  if (type === 'aadhaar_vid') {
    if (/^(\d)\1+$/.test(normalized) || normalized === '123456789012' || normalized === '1234567890123456') {
      return { valid: false, normalized, masked: '', error: 'Please enter a valid non-placeholder Aadhaar or VID number.' };
    }
    if (normalized.length === 12 && (normalized.startsWith('0') || normalized.startsWith('1'))) {
      return { valid: false, normalized, masked: '', error: 'Valid 12-digit Aadhaar numbers cannot start with 0 or 1.' };
    }
  }

  return {
    valid: true,
    normalized,
    masked: maskNationalId(type, normalized),
  };
}
