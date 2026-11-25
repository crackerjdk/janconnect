import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canModeratorTransition,
  detectPotentialPiiHints,
  formatGeneralizedLocation,
  formatInrCurrency,
  isPubliclyVisible,
  STATUS_LABELS,
  validateAttachmentMetadata,
  validateCommentContent,
  validateContractorBid,
  validateNewPassword,
  validateReportDraft,
  validateResetEmail,
  validateUsername,
  buildSafePasswordResetRedirectUrl,
  normalizePinnedCoordinates,
} from './civicRules';
import { validateLegalName, validateNationalIdFormat } from './nationalId';

test('validateReportDraft rejects missing required fields and validates valid Uttarakhand report', () => {
  const invalid = validateReportDraft({
    title: 'Short',
    description: 'Too short',
    category: 'InvalidCategory',
    stateId: '',
    districtId: '',
    blockId: '',
    localityId: '',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.title);
  assert.ok(invalid.errors.description);
  assert.ok(invalid.errors.category);
  assert.ok(invalid.errors.districtId);

  const valid = validateReportDraft({
    title: 'Broken culvert near Rajpur Canal Road',
    description: 'Stormwater drainage culvert has collapsed along the main pedestrian edge causing waterlogging.',
    category: 'Drainage and Sanitation',
    stateId: 'uk-state',
    districtId: 'uk-dehradun',
    blockId: 'uk-dehradun-raipur',
    localityId: 'uk-dehradun-raipur-rajpur',
  });
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.errors, {});
});

test('detectPotentialPiiHints catches mobile numbers, Aadhaar-like numbers, and emails', () => {
  const hints = detectPotentialPiiHints('Call me at 9876543210 or email citizen@example.com or 1234 5678 9012');
  assert.equal(hints.length, 3);
});

test('formatGeneralizedLocation never includes coordinates and formats hierarchical text', () => {
  const loc = formatGeneralizedLocation({
    locality: 'Rajpur',
    block: 'Raipur',
    district: 'Dehradun',
    state: 'Uttarakhand',
  });
  assert.equal(loc, 'Rajpur, Raipur, Dehradun, Uttarakhand');
});

test('moderation transitions and public visibility enforce private-until-published invariant', () => {
  assert.equal(isPubliclyVisible('submitted', 'private'), false);
  assert.equal(isPubliclyVisible('submitted', 'public'), false);
  assert.equal(isPubliclyVisible('under_review', 'public'), false);
  assert.equal(isPubliclyVisible('published', 'public'), true);

  const review = canModeratorTransition('submitted', 'start_review');
  assert.equal(review.allowed, true);
  assert.equal(review.nextStatus, 'under_review');
  assert.equal(review.nextVisibility, 'private');

  const pub = canModeratorTransition('under_review', 'publish');
  assert.equal(pub.allowed, true);
  assert.equal(pub.nextStatus, 'published');
  assert.equal(pub.nextVisibility, 'public');

  const invalidReject = canModeratorTransition('published', 'reject');
  assert.equal(invalidReject.allowed, false);
});

test('STATUS_LABELS never claims official government approval', () => {
  for (const status of Object.values(STATUS_LABELS)) {
    assert.equal(status.label.toLowerCase().includes('approved by government'), false);
  }
});

test('validateCommentContent, validateUsername, and validateAttachmentMetadata enforce bounds', () => {
  assert.equal(validateCommentContent('a').valid, false);
  assert.equal(validateCommentContent('Needs urgent footpath repair before monsoon.').valid, true);
  assert.equal(validateUsername('ab'), 'Username must be between 3 and 32 characters.');
  assert.equal(validateUsername('Bad-Name'), 'Username may only contain lowercase letters, numbers, and underscores.');
  assert.equal(validateUsername('pahadi_citizen_24'), null);
  assert.equal(validateAttachmentMetadata({ size: 1024, mimeType: 'image/jpeg' }), null);
  assert.equal(validateAttachmentMetadata({ size: 25 * 1024 * 1024, mimeType: 'video/mp4' }), null);
  assert.equal(validateAttachmentMetadata({ size: 50 * 1024 * 1024, mimeType: 'video/mp4' }), null);
  assert.ok(validateAttachmentMetadata({ size: 1024, mimeType: 'application/pdf' }));
  assert.ok(validateAttachmentMetadata({ size: 51 * 1024 * 1024, mimeType: 'video/mp4' }));
});

test('validateNationalIdFormat validates supported Indian National IDs and masks output', () => {
  const voter = validateNationalIdFormat('voter_id', 'ukd 1234567');
  assert.equal(voter.valid, true);
  assert.equal(voter.normalized, 'UKD1234567');
  assert.equal(voter.masked, '••••••4567');

  const dl = validateNationalIdFormat('driving_licence', 'UK07-20190012345');
  assert.equal(dl.valid, true);
  assert.equal(dl.masked, '•••••••••••2345');

  const passport = validateNationalIdFormat('passport', 'A1234567');
  assert.equal(passport.valid, true);

  const pan = validateNationalIdFormat('pan', 'abcde1234f');
  assert.equal(pan.valid, true);
  assert.equal(pan.normalized, 'ABCDE1234F');

  const aadhaar = validateNationalIdFormat('aadhaar_vid', '4912 3456 7890');
  assert.equal(aadhaar.valid, true);
  assert.equal(aadhaar.masked, 'XXXX-XXXX-7890');

  assert.equal(validateNationalIdFormat('aadhaar_vid', '000000000000').valid, false);
  assert.equal(validateNationalIdFormat('aadhaar_vid', '123456789012').valid, false);
  assert.equal(validateNationalIdFormat('voter_id', '1234567890').valid, false);

  assert.equal(validateLegalName('Asha Rawat').valid, true);
  assert.equal(validateLegalName('A').valid, false);
  assert.equal(validateLegalName('User <script>').valid, false);
});

test('validateResetEmail, validateNewPassword, and buildSafePasswordResetRedirectUrl enforce security rules', () => {
  const okEmail = validateResetEmail('  Asha.UK@Example.COM ');
  assert.equal(okEmail.valid, true);
  assert.equal(okEmail.email, 'asha.uk@example.com');

  assert.equal(validateResetEmail('not-an-email').valid, false);
  assert.equal(validateResetEmail('bad\n@example.com').valid, false);

  assert.equal(validateNewPassword('short1', 'short1').valid, false);
  assert.equal(validateNewPassword('onlyletters', 'onlyletters').valid, false);
  assert.equal(validateNewPassword('StrongPass1', 'Mismatch1').valid, false);
  assert.equal(validateNewPassword('StrongPass1', 'StrongPass1').valid, true);

  assert.equal(
    buildSafePasswordResetRedirectUrl('https://janconnect.example.org/'),
    'https://janconnect.example.org/reset-password'
  );
  assert.equal(
    buildSafePasswordResetRedirectUrl('javascript:alert(1)'),
    'http://localhost:3000/reset-password'
  );
});

test('normalizePinnedCoordinates formats valid Uttarakhand pins and rejects out-of-bounds pins', () => {
  const ukPin = normalizePinnedCoordinates(30.3164947, 78.0321918);
  assert.equal(ukPin.valid, true);
  assert.equal(ukPin.lat, '30.31649');
  assert.equal(ukPin.lng, '78.03219');

  const outside = normalizePinnedCoordinates(51.5074, -0.1278);
  assert.equal(outside.valid, false);
  assert.ok(outside.error);

  const invalidNum = normalizePinnedCoordinates(Number.NaN, 78.0);
  assert.equal(invalidNum.valid, false);
});

test('validateContractorBid validates firm quotation fields and formatInrCurrency formats INR cleanly', () => {
  const validBid = validateContractorBid({
    companyName: 'Garhwal Civil Works & Infra',
    registrationNumber: 'UK-PWD-C-4821',
    bidAmountInr: 145000,
    estimatedDays: 14,
    warrantyMonths: 24,
    proposalSummary: 'Full excavation, M25 RCC slab replacement, stone pitching, and stormwater grating.',
  });
  assert.equal(validBid.valid, true);
  assert.deepEqual(validBid.errors, {});
  assert.equal(formatInrCurrency(145000), '₹1,45,000');

  const invalidBid = validateContractorBid({
    companyName: 'AB',
    registrationNumber: '!',
    bidAmountInr: 100,
    estimatedDays: 0,
    warrantyMonths: -1,
    proposalSummary: 'Too short',
  });
  assert.equal(invalidBid.valid, false);
  assert.ok(invalidBid.errors.companyName);
  assert.ok(invalidBid.errors.registrationNumber);
  assert.ok(invalidBid.errors.bidAmountInr);
  assert.ok(invalidBid.errors.estimatedDays);
  assert.ok(invalidBid.errors.warrantyMonths);
  assert.ok(invalidBid.errors.proposalSummary);
});
