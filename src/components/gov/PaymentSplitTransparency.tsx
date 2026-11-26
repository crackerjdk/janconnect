import { CheckCircle2, Clock } from 'lucide-react';
import type { BudgetPaymentBreakdown } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import {
  PAYMENT_TRANSFER_CHANNEL_LABELS,
  type PaymentTransferChannel,
} from '../../utils/govRules';

interface PaymentSplitTransparencyProps {
  breakdown: BudgetPaymentBreakdown | null | undefined;
  compact?: boolean;
  showLedger?: boolean;
}

export function PaymentSplitTransparency({
  breakdown,
  compact = false,
  showLedger = true,
}: PaymentSplitTransparencyProps) {
  if (!breakdown || breakdown.allotted_budget_inr <= 0) {
    return null;
  }

  const creatorStatusLabel = !breakdown.is_allotted
    ? 'Scheduled on Contract Award'
    : breakdown.creator_reward_settled
    ? 'Transferred'
    : breakdown.creator_transferred_inr > 0
    ? 'Partially Transferred'
    : 'Pending Deduction';

  const contractorStatusLabel = !breakdown.is_allotted
    ? 'Pending Award'
    : breakdown.contractor_settled
    ? 'Transferred'
    : breakdown.contractor_transferred_inr > 0
    ? 'Partially Transferred'
    : 'Awaiting Transfer';

  if (compact) {
    return (
      <div className="rounded-lg bg-[#F7F6F2] px-3 py-2.5 text-[11px] space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[#4B5563]">
          <span className="font-semibold text-[#0F2942]">
            {breakdown.is_allotted ? 'Allotted Budget Split (1% / 99%)' : 'Projected Budget Split (1% / 99%)'}
          </span>
          <span className="font-mono font-semibold text-[#0F2942] tabular-nums">
            {formatInrCurrency(breakdown.allotted_budget_inr)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-[#E2E6EC]">
          <div className="min-w-0">
            <p className="text-[#6B7280] truncate">
              1% Creator Reward · <strong className="text-[#0F2942]">{breakdown.creator_account_name}</strong>
            </p>
            <p className="font-mono font-semibold text-[#0F2942] tabular-nums">
              {formatInrCurrency(breakdown.creator_reward_1pct_inr)}
            </p>
            <p className={breakdown.creator_reward_settled ? 'text-[#0D7A6F] font-medium' : 'text-[#92400E]'}>
              {breakdown.is_allotted
                ? `Transferred: ${formatInrCurrency(breakdown.creator_transferred_inr)} · ${creatorStatusLabel}`
                : 'Deducted first upon allotment'}
            </p>
          </div>

          <div className="min-w-0">
            <p className="text-[#6B7280] truncate">
              99% Contractor{breakdown.contractor_name ? ` · ${breakdown.contractor_name}` : ''}
            </p>
            <p className="font-mono font-semibold text-[#0D7A6F] tabular-nums">
              {formatInrCurrency(breakdown.contractor_net_99pct_inr)}
            </p>
            <p className={breakdown.contractor_settled ? 'text-[#0D7A6F] font-medium' : 'text-[#4B5563]'}>
              {breakdown.is_allotted
                ? `Sent: ${formatInrCurrency(breakdown.contractor_transferred_inr)} · ${contractorStatusLabel}`
                : 'Sent after 1% reward deduction'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#F7F6F2] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E2E6EC] pb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#0F2942]">
            {breakdown.is_allotted
              ? 'Public Payment Disbursement Split (1% Creator Reward → 99% Contractor)'
              : 'Sanctioned Budget Split Preview (1% Creator Reward → 99% Contractor)'}
          </h3>
          <p className="text-xs text-[#4B5563]">
            First 1% from the allotted budget is deducted to {breakdown.creator_account_name} as creator reward, and the remaining 99% is transferred to the contractor account.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-[#6B7280]">Total Transferred</p>
          <p className="font-mono text-base font-bold text-[#0D7A6F] tabular-nums">
            {formatInrCurrency(breakdown.total_transferred_inr)} / {formatInrCurrency(breakdown.allotted_budget_inr)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 text-xs">
        <div className="space-y-1">
          <p className="text-[#6B7280]">Allotted Contractor Budget (100%)</p>
          <p className="font-mono text-base font-bold text-[#0F2942] tabular-nums">
            {formatInrCurrency(breakdown.allotted_budget_inr)}
          </p>
          <p className="text-[11px] text-[#4B5563]">
            {breakdown.is_allotted ? 'Officially allotted contract amount' : 'Awaiting final contractor award'}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[#6B7280]">
            1. First 1% Reward → <strong className="text-[#0F2942]">{breakdown.creator_account_name}</strong>
          </p>
          <p className="font-mono text-base font-bold text-[#0F2942] tabular-nums">
            {formatInrCurrency(breakdown.creator_reward_1pct_inr)}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] font-medium">
            {breakdown.creator_reward_settled ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-[#B45309] shrink-0" aria-hidden="true" />
            )}
            <span className={breakdown.creator_reward_settled ? 'text-[#0D7A6F]' : 'text-[#92400E]'}>
              Transferred: <span className="font-mono tabular-nums">{formatInrCurrency(breakdown.creator_transferred_inr)}</span> ·{' '}
              {creatorStatusLabel}
            </span>
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-[#6B7280] truncate">
            2. Remaining 99% →{' '}
            <strong className="text-[#0F2942]">{breakdown.contractor_name || 'Awarded Contractor Account'}</strong>
          </p>
          <p className="font-mono text-base font-bold text-[#0D7A6F] tabular-nums">
            {formatInrCurrency(breakdown.contractor_net_99pct_inr)}
          </p>
          <p className="flex items-center gap-1.5 text-[11px] font-medium">
            {breakdown.contractor_settled ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0" aria-hidden="true" />
            ) : (
              <Clock className="w-3.5 h-3.5 text-[#6B7280] shrink-0" aria-hidden="true" />
            )}
            <span className={breakdown.contractor_settled ? 'text-[#0D7A6F]' : 'text-[#374151]'}>
              Sent to Contractor:{' '}
              <span className="font-mono tabular-nums">{formatInrCurrency(breakdown.contractor_transferred_inr)}</span> ·{' '}
              {contractorStatusLabel}
            </span>
          </p>
        </div>
      </div>

      {showLedger && breakdown.transfers.length > 0 && (
        <div className="pt-3 border-t border-[#E2E6EC] space-y-2">
          <p className="text-xs font-semibold text-[#0F2942]">
            Public Payment Transfer Ledger ({breakdown.transfers.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E2E6EC] text-[11px] text-[#6B7280]">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Date</th>
                  <th className="py-1.5 pr-3 font-medium">Recipient Account</th>
                  <th className="py-1.5 pr-3 font-medium">Channel & Reference</th>
                  <th className="py-1.5 text-right font-medium">Transferred (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E6EC]">
                {breakdown.transfers.map((tr) => {
                  const channelLabel =
                    PAYMENT_TRANSFER_CHANNEL_LABELS[tr.transfer_channel as PaymentTransferChannel] ||
                    tr.transfer_channel;
                  return (
                    <tr key={tr.id}>
                      <td className="py-2 pr-3 font-mono text-[#4B5563] whitespace-nowrap">{tr.transfer_date}</td>
                      <td className="py-2 pr-3">
                        <span className="font-semibold text-[#0F2942]">{tr.recipient_name}</span>
                        <span className="block text-[11px] text-[#6B7280]">
                          {tr.recipient_type === 'creator_naman'
                            ? '1% Creator Reward Deduction'
                            : tr.recipient_account_ref || '99% Contractor Payment'}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-[#374151]">
                        <span>{channelLabel}</span>
                        <span className="block font-mono text-[11px] text-[#6B7280]">
                          Ref: {tr.transfer_reference}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono font-semibold text-[#0D7A6F] tabular-nums whitespace-nowrap">
                        {formatInrCurrency(tr.amount_inr)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
