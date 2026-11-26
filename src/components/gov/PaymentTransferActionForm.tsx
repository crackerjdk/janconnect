import { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import type { BudgetPaymentBreakdown } from '../../types/gov';
import { apiFetch } from '../../services/api';
import { formatInrCurrency } from '../../utils/civicRules';
import {
  type BudgetTransferMode,
  PAYMENT_TRANSFER_CHANNELS,
  PAYMENT_TRANSFER_CHANNEL_LABELS,
  type PaymentTransferChannel,
} from '../../utils/govRules';

interface PaymentTransferActionFormProps {
  endpoint: string;
  breakdown: BudgetPaymentBreakdown;
  onTransferred: (nextBreakdown: BudgetPaymentBreakdown, message: string) => void;
  onError?: (errorMessage: string) => void;
}

export function PaymentTransferActionForm({
  endpoint,
  breakdown,
  onTransferred,
  onError,
}: PaymentTransferActionFormProps) {
  const creatorRemaining = breakdown.creator_remaining_inr;
  const contractorRemaining = breakdown.contractor_remaining_inr;
  const allSettled = creatorRemaining <= 0 && contractorRemaining <= 0;

  const defaultMode: BudgetTransferMode =
    creatorRemaining > 0 && contractorRemaining > 0
      ? 'full_split'
      : creatorRemaining > 0
      ? 'creator_1pct'
      : 'contractor_99pct';

  const [transferMode, setTransferMode] = useState<BudgetTransferMode>(defaultMode);
  const [amountInr, setAmountInr] = useState<string>(String(contractorRemaining || ''));
  const [transferChannel, setTransferChannel] = useState<PaymentTransferChannel>('treasury_pfms');
  const [transferReference, setTransferReference] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  if (allSettled) {
    return (
      <div className="rounded-lg bg-[#ECFDF5] px-4 py-3 text-xs text-[#065F46] font-medium">
        Allotted budget transfer complete: 1% Creator Reward ({formatInrCurrency(breakdown.creator_transferred_inr)}) to{' '}
        {breakdown.creator_account_name} and 99% Contractor Payment (
        {formatInrCurrency(breakdown.contractor_transferred_inr)}) have been fully transferred.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        transferMode,
        transferChannel,
        transferReference: transferReference.trim(),
        transferDate,
        note: note.trim() || undefined,
      };
      if (transferMode === 'contractor_99pct') {
        payload.amountInr = Number(amountInr);
      }

      const res = await apiFetch<{ ok: boolean; payment_breakdown: BudgetPaymentBreakdown }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const msg =
        transferMode === 'full_split'
          ? `First 1% transferred to ${breakdown.creator_account_name} and remaining 99% transferred to contractor.`
          : transferMode === 'creator_1pct'
          ? `1% Creator Reward transferred to ${breakdown.creator_account_name}.`
          : `Contractor payment tranche (${formatInrCurrency(Number(amountInr))}) transferred.`;

      setTransferReference('');
      setNote('');
      if (res.payment_breakdown.contractor_remaining_inr > 0) {
        setAmountInr(String(res.payment_breakdown.contractor_remaining_inr));
      }
      if (res.payment_breakdown.creator_remaining_inr <= 0 && transferMode === 'creator_1pct') {
        setTransferMode('contractor_99pct');
      }
      onTransferred(res.payment_breakdown, msg);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to execute payment transfer.';
      setLocalError(msg);
      onError?.(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-[#E2E6EC] bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#0F2942]">
          <ArrowRightLeft className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
          <span>Authority / Admin Payment Transfer</span>
        </div>
        <span className="text-[11px] font-mono text-[#4B5563] tabular-nums">
          1% Remaining: {formatInrCurrency(creatorRemaining)} · 99% Remaining: {formatInrCurrency(contractorRemaining)}
        </span>
      </div>

      {localError && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
          {localError}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-[#374151] sm:col-span-2">
          Disbursement Action *
          <select
            value={transferMode}
            onChange={(e) => {
              const next = e.target.value as BudgetTransferMode;
              setTransferMode(next);
              if (next === 'contractor_99pct') {
                setAmountInr(String(contractorRemaining || ''));
              }
            }}
            className="mt-1 w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-xs text-[#0F2942]"
          >
            {(creatorRemaining > 0 || contractorRemaining > 0) && (
              <option value="full_split">
                Deduct 1% ({formatInrCurrency(creatorRemaining)}) to {breakdown.creator_account_name} & Transfer 99% (
                {formatInrCurrency(contractorRemaining)}) to Contractor
              </option>
            )}
            {creatorRemaining > 0 && (
              <option value="creator_1pct">
                Step 1 Only: Deduct & Transfer 1% Reward ({formatInrCurrency(creatorRemaining)}) to{' '}
                {breakdown.creator_account_name}
              </option>
            )}
            {contractorRemaining > 0 && (
              <option value="contractor_99pct" disabled={creatorRemaining > 0}>
                Step 2: Transfer Contractor Payment (up to {formatInrCurrency(contractorRemaining)})
                {creatorRemaining > 0 ? ' — requires 1% transfer first' : ''}
              </option>
            )}
          </select>
        </label>

        {transferMode === 'contractor_99pct' ? (
          <label className="block text-xs font-medium text-[#374151]">
            Contractor Transfer Amount (INR) *
            <input
              type="number"
              min={1}
              max={contractorRemaining}
              required
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
            />
          </label>
        ) : (
          <label className="block text-xs font-medium text-[#374151]">
            Transfer Date *
            <input
              type="date"
              required
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
            />
          </label>
        )}

        <label className="block text-xs font-medium text-[#374151]">
          Transfer Channel *
          <select
            value={transferChannel}
            onChange={(e) => setTransferChannel(e.target.value as PaymentTransferChannel)}
            className="mt-1 w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-xs text-[#0F2942]"
          >
            {PAYMENT_TRANSFER_CHANNELS.map((ch) => (
              <option key={ch} value={ch}>
                {PAYMENT_TRANSFER_CHANNEL_LABELS[ch]}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-[#374151]">
          UTR / Transaction Reference *
          <input
            type="text"
            required
            minLength={4}
            maxLength={64}
            value={transferReference}
            onChange={(e) => setTransferReference(e.target.value)}
            placeholder="e.g., PFMS-UK-2026-9041"
            className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
          />
        </label>

        {transferMode === 'contractor_99pct' ? (
          <label className="block text-xs font-medium text-[#374151]">
            Transfer Date *
            <input
              type="date"
              required
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
            />
          </label>
        ) : (
          <label className="block text-xs font-medium text-[#374151]">
            Payment Remark (Optional)
            <input
              type="text"
              maxLength={240}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., First 1% deducted to Naman's Account, 99% paid to contractor"
              className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs"
            />
          </label>
        )}
      </div>

      {transferMode === 'contractor_99pct' && (
        <label className="block text-xs font-medium text-[#374151]">
          Payment Remark (Optional)
          <input
            type="text"
            maxLength={240}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., First tranche milestone payout to contractor"
            className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs"
          />
        </label>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-[11px] text-[#6B7280]">
          Recorded transfers become publicly visible under this project for full citizen transparency.
        </p>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50 whitespace-nowrap shrink-0"
        >
          {submitting ? 'Transferring...' : 'Transfer Money for Payment'}
        </button>
      </div>
    </form>
  );
}
