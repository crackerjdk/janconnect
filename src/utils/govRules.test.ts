import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBudgetDisbursementSplit,
  calculateJanConnectFee,
  canIssueFeeInvoice,
  canRecordFeePayment,
  CREATOR_REWARD_ACCOUNT_NAME,
  FEE_STATUSES,
  validateContractorProfileInput,
  validateGovernmentProjectInput,
  validatePaymentTransferInput,
} from './govRules';

test('calculateJanConnectFee computes 1% fee and illustrative allocation accurately', () => {
  const res = calculateJanConnectFee({
    sanctionedBudgetInr: 1000000,
    feeBasis: 'sanctioned_budget',
    feePercentage: 1,
  });
  assert.equal(res.approvedFeeBaseInr, 1000000);
  assert.equal(res.feePercentage, 1);
  assert.equal(res.calculatedFeeInr, 10000);
  assert.equal(res.illustrativeExecutionAllocationInr, 990000);
});

test('calculateJanConnectFee switches cleanly between awarded contract amount and actual payments', () => {
  const awarded = calculateJanConnectFee({
    sanctionedBudgetInr: 1000000,
    awardedContractAmountInr: 850000,
    actualContractorPaymentsInr: 400000,
    feeBasis: 'awarded_contract_amount',
    feePercentage: 1,
  });
  assert.equal(awarded.approvedFeeBaseInr, 850000);
  assert.equal(awarded.calculatedFeeInr, 8500);
  assert.equal(awarded.illustrativeExecutionAllocationInr, 991500);

  const actual = calculateJanConnectFee({
    sanctionedBudgetInr: 1000000,
    awardedContractAmountInr: 850000,
    actualContractorPaymentsInr: 400000,
    feeBasis: 'actual_contractor_payments',
    feePercentage: 1,
  });
  assert.equal(actual.approvedFeeBaseInr, 400000);
  assert.equal(actual.calculatedFeeInr, 4000);
});

test('fee statuses and invoicing/payment safeguards prevent unapproved collection', () => {
  assert.equal(FEE_STATUSES.length, 9);
  assert.equal(canIssueFeeInvoice('awaiting_government_approval'), false);
  assert.equal(canIssueFeeInvoice('not_applicable'), false);
  assert.equal(canIssueFeeInvoice('approved'), true);
  assert.equal(canIssueFeeInvoice('awaiting_invoice'), true);

  const blockedGateway = canRecordFeePayment({
    feeStatus: 'invoice_issued',
    gatewayEnabled: false,
    gatewayVerified: true,
  });
  assert.equal(blockedGateway.allowed, false);
  assert.match(blockedGateway.error || '', /Not Configured/);

  const blockedUnverified = canRecordFeePayment({
    feeStatus: 'invoice_issued',
    gatewayEnabled: true,
    gatewayVerified: false,
  });
  assert.equal(blockedUnverified.allowed, false);

  const allowed = canRecordFeePayment({
    feeStatus: 'invoice_issued',
    gatewayEnabled: true,
    gatewayVerified: true,
  });
  assert.equal(allowed.allowed, true);
});

test('validateGovernmentProjectInput and validateContractorProfileInput enforce clean field bounds', () => {
  const badProj = validateGovernmentProjectInput({
    title: 'Short',
    description: 'Too short',
    departmentName: 'PW',
    sanctionedBudgetInr: 500,
    estimatedCostInr: 0,
    expectedCompletionDate: 'bad-date',
  });
  assert.equal(badProj.valid, false);
  assert.ok(badProj.errors.title);
  assert.ok(badProj.errors.sanctionedBudgetInr);

  const goodContractor = validateContractorProfileInput({
    registeredBusinessName: 'Garhwal Himalayan Infra Pvt Ltd',
    authorisedRepresentative: 'Vikram Singh Negi',
    govtRegistrationNumber: 'UK-PWD-A-2049',
    registrationAuthority: 'Uttarakhand PWD Class-A',
  });
  assert.equal(goodContractor.valid, true);
});

test('calculateBudgetDisbursementSplit enforces exact 1% Naman Account + 99% contractor sum', () => {
  const even = calculateBudgetDisbursementSplit(1000000);
  assert.equal(even.creatorAccountName, CREATOR_REWARD_ACCOUNT_NAME);
  assert.equal(even.creatorRewardInr, 10000);
  assert.equal(even.contractorNetInr, 990000);
  assert.equal(even.creatorRewardInr + even.contractorNetInr, 1000000);

  const odd = calculateBudgetDisbursementSplit(1234567);
  assert.equal(odd.creatorRewardInr, 12346);
  assert.equal(odd.contractorNetInr, 1222221);
  assert.equal(odd.creatorRewardInr + odd.contractorNetInr, 1234567);
});

test('validatePaymentTransferInput rejects XSS, bad references, and missing contractor amounts', () => {
  const badRef = validatePaymentTransferInput({
    transferMode: 'full_split',
    transferChannel: 'treasury_pfms',
    transferReference: 'ab',
  });
  assert.equal(badRef.valid, false);

  const missingAmt = validatePaymentTransferInput({
    transferMode: 'contractor_99pct',
    transferChannel: 'neft_rtgs',
    transferReference: 'UTR-2026-9910',
  });
  assert.equal(missingAmt.valid, false);

  const good = validatePaymentTransferInput({
    transferMode: 'full_split',
    transferChannel: 'treasury_pfms',
    transferReference: 'PFMS-UK-2026-8841',
    transferDate: '2026-11-26',
    note: 'First 1% deducted to Naman Account and 99% released to contractor',
  });
  assert.equal(good.valid, true);
  assert.equal(good.value?.transferReference, 'PFMS-UK-2026-8841');
});
