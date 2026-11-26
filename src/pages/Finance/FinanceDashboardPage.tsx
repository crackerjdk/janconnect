import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Download, FileText, Lock, Receipt, Settings2 } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../services/api';
import type { FinanceDashboardResponse, JanConnectFeeRecord } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import {
  canIssueFeeInvoice,
  FEE_BASES,
  FEE_BASIS_LABELS,
  FEE_STATUSES,
  FEE_STATUS_LABELS,
  type FeeBasis,
  type FeeStatus,
} from '../../utils/govRules';

export function FinanceDashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<FinanceDashboardResponse | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Basis editor state
  const [editingRecord, setEditingRecord] = useState<JanConnectFeeRecord | null>(null);
  const [basisForm, setBasisForm] = useState({
    feeBasis: 'sanctioned_budget' as FeeBasis,
    feePercentage: '1',
    customApprovedBaseInr: '0',
    notes: '',
  });

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await apiFetch<FinanceDashboardResponse>(`/api/finance/dashboard?${params.toString()}`);
      setData(res);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, statusFilter, showToast]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleOpenBasisEditor = (r: JanConnectFeeRecord) => {
    setEditingRecord(r);
    setBasisForm({
      feeBasis: r.fee_basis,
      feePercentage: String(r.fee_percentage),
      customApprovedBaseInr: String(r.approved_fee_base_inr),
      notes: r.notes || '',
    });
  };

  const handleSaveBasis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setBusyId(editingRecord.project_id);
    try {
      await apiFetch(`/api/finance/fees/${editingRecord.project_id}/basis`, {
        method: 'PATCH',
        body: JSON.stringify({
          feeBasis: basisForm.feeBasis,
          feePercentage: Number(basisForm.feePercentage),
          customApprovedBaseInr: Number(basisForm.customApprovedBaseInr) || 0,
          notes: basisForm.notes,
        }),
      });
      showToast('Fee calculation basis updated. Government approval rules remain enforced.', 'success');
      setEditingRecord(null);
      await loadDashboard();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleIssueInvoice = async (projectId: string) => {
    setBusyId(projectId);
    try {
      const res = await apiFetch<{ invoiceNumber: string }>(`/api/finance/fees/${projectId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({ dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) }),
      });
      showToast(`Invoice ${res.invoiceNumber} issued to responsible department.`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleTransitionStatus = async (projectId: string, feeStatus: FeeStatus) => {
    setBusyId(projectId);
    try {
      await apiFetch(`/api/finance/fees/${projectId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ feeStatus }),
      });
      showToast(`Fee status updated to ${FEE_STATUS_LABELS[feeStatus].label}.`, 'success');
      await loadDashboard();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = () => {
    if (!data || data.records.length === 0) return;
    const headers = [
      'Project Code',
      'Project Title',
      'Department',
      'Sanctioned Budget INR',
      'Awarded Contract INR',
      'Actual Contractor Paid INR',
      'Fee Basis',
      'Approved Fee Base INR',
      'Fee %',
      'JanConnect Fee INR',
      'Illustrative Execution Allocation INR',
      'Fee Status',
      'Approval Reference',
      'Invoice Number',
      'Payment Reference',
    ];
    const rows = data.records.map((r) => [
      r.project_code || '',
      `"${(r.project_title || '').replace(/"/g, '""')}"`,
      `"${(r.department_name || '').replace(/"/g, '""')}"`,
      r.sanctioned_budget_inr,
      r.awarded_contract_amount_inr,
      r.actual_contractor_payments_inr,
      r.fee_basis,
      r.approved_fee_base_inr,
      r.fee_percentage,
      r.calculated_fee_inr,
      r.illustrative_execution_allocation_inr,
      r.fee_status,
      r.approval_reference || '',
      r.latest_invoice_number || '',
      r.latest_payment_reference || '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `janconnect-facilitation-fee-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-[#E2E6EC]">
          <div>
            <p className="text-xs font-semibold text-[#0D7A6F]">Financial Administration & Compliance</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
              JanConnect Digital Project Facilitation Fee
            </h1>
            <p className="mt-1.5 max-w-2xl text-xs sm:text-sm text-[#4B5563]">
              Proposed 1% platform facilitation fee tracking. Fees remain pending until explicitly sanctioned in the
              government agreement and are never automatically deducted from contractors or execution budgets.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!data || data.records.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-[#F7F6F2] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV Report</span>
            </button>
            <Link
              to="/finance/payment-settings"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163A5C]"
            >
              <Settings2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Payment Settings</span>
            </Link>
          </div>
        </div>

        {/* Gateway Status Notice */}
        {data && !data.gatewayConfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" aria-hidden="true" />
              <div>
                <p className="font-semibold">Payment Gateway Not Configured</p>
                <p className="mt-0.5">
                  Automated fee collection is disabled. Invoices can be issued after government approval, and payment
                  receipts can only be stored once verified payment gateway confirmation is enabled.
                </p>
              </div>
            </div>
            <Link to="/finance/payment-settings" className="font-semibold underline whitespace-nowrap">
              Configure Placeholder Settings →
            </Link>
          </div>
        )}

        {/* 8 Required Revenue & Fee KPIs */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          {[
            ['Total Projects Registered', data?.summary.totalProjectsRegistered ?? 0, false],
            ['Total Eligible Projects', data?.summary.totalEligibleProjects ?? 0, false],
            ['Total Proposed Fees (Pending)', formatInrCurrency(data?.summary.totalProposedFeesInr ?? 0), true],
            ['Government-Approved Fees', formatInrCurrency(data?.summary.totalApprovedFeesInr ?? 0), true],
            ['Total Invoiced Fees', formatInrCurrency(data?.summary.totalInvoicedFeesInr ?? 0), true],
            ['Total Payments Received', formatInrCurrency(data?.summary.totalPaymentsReceivedInr ?? 0), true],
            ['Pending Payments', formatInrCurrency(data?.summary.totalPendingPaymentsInr ?? 0), true],
            ['Cancelled / Disputed Fees', formatInrCurrency(data?.summary.totalCancelledOrDisputedInr ?? 0), true],
          ].map(([label, value, isMoney]) => (
            <div key={String(label)} className="rounded-xl border border-[#E2E6EC] bg-white p-4">
              <p className="text-xs text-[#4B5563]">{label}</p>
              <p
                className={`mt-1 font-mono font-bold tabular-nums ${
                  isMoney ? 'text-xl text-[#0F2942]' : 'text-2xl text-[#0D7A6F]'
                }`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Date & Status Filters */}
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs font-medium text-[#374151]">
              From Date
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              To Date
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 block rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Fee Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-1 block rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="all">All 9 Fee Statuses</option>
                {FEE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {FEE_STATUS_LABELS[s].label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(fromDate || toDate || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setFromDate('');
                setToDate('');
                setStatusFilter('all');
              }}
              className="text-xs font-semibold text-[#0D7A6F] underline"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Fee Basis Editor Drawer */}
        {editingRecord && (
          <form onSubmit={handleSaveBasis} className="rounded-xl border border-[#0F2942]/30 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#0F2942]">
                Configure Approved Fee Calculation Basis — {editingRecord.project_code}
              </h2>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="text-xs font-semibold text-[#4B5563] underline"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-xs font-medium text-[#374151]">
                Fee Calculation Basis
                <select
                  value={basisForm.feeBasis}
                  onChange={(e) => setBasisForm((f) => ({ ...f, feeBasis: e.target.value as FeeBasis }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                >
                  {FEE_BASES.map((b) => (
                    <option key={b} value={b}>
                      {FEE_BASIS_LABELS[b]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#374151]">
                Fee Percentage (%)
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={basisForm.feePercentage}
                  onChange={(e) => setBasisForm((f) => ({ ...f, feePercentage: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
              </label>
              {basisForm.feeBasis === 'custom_approved_base' && (
                <label className="block text-xs font-medium text-[#374151]">
                  Custom Approved Fee Base (INR)
                  <input
                    type="number"
                    min="0"
                    value={basisForm.customApprovedBaseInr}
                    onChange={(e) => setBasisForm((f) => ({ ...f, customApprovedBaseInr: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                  />
                </label>
              )}
              <label className="sm:col-span-3 block text-xs font-medium text-[#374151]">
                Financial Administration Notes
                <input
                  type="text"
                  value={basisForm.notes}
                  onChange={(e) => setBasisForm((f) => ({ ...f, notes: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                disabled={busyId === editingRecord.project_id}
                className="rounded-lg bg-[#0D7A6F] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A]"
              >
                Save Calculation Basis
              </button>
            </div>
          </form>
        )}

        {/* Project-Wise Financial Ledger */}
        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : !data || data.records.length === 0 ? (
          <EmptyState
            title="No project facilitation fee records match this filter"
            description="When government officials sanction projects from verified citizen reports, their separate 1% technology fee ledger appears here."
          />
        ) : (
          <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Project-Wise Financial Allocations & 1% Fee Ledger
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E6EC] text-[#6B7280]">
                    <th className="py-2.5 pr-3 font-medium">Project & Department</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Sanctioned Budget</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Awarded / Paid Contractor</th>
                    <th className="py-2.5 pr-3 font-medium text-right">Approved Fee Base</th>
                    <th className="py-2.5 pr-3 font-medium text-right">JanConnect Fee</th>
                    <th className="py-2.5 pr-3 font-medium">Status & References</th>
                    <th className="py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E6EC]">
                  {data.records.map((r) => {
                    const st = FEE_STATUS_LABELS[r.fee_status];
                    const canInvoice = canIssueFeeInvoice(r.fee_status);
                    return (
                      <tr key={r.id} className="align-top hover:bg-[#F7F6F2]/50">
                        <td className="py-3 pr-3">
                          <p className="font-semibold text-[#0F2942]">{r.project_title}</p>
                          <p className="font-mono text-[#6B7280]">
                            {r.project_code} · {r.department_name}
                          </p>
                          <p className="text-[11px] text-[#4B5563]">
                            Illustrative Execution Allocation:{' '}
                            <span className="font-mono tabular-nums">
                              {formatInrCurrency(r.illustrative_execution_allocation_inr)}
                            </span>
                          </p>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-[#0F2942]">
                          {formatInrCurrency(r.sanctioned_budget_inr)}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums text-[#374151]">
                          <div>{r.awarded_contract_amount_inr ? formatInrCurrency(r.awarded_contract_amount_inr) : '—'}</div>
                          <div className="text-[11px] text-[#6B7280]">
                            Paid: {formatInrCurrency(r.actual_contractor_payments_inr)}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono tabular-nums">
                          <div>{formatInrCurrency(r.approved_fee_base_inr)}</div>
                          <div className="text-[11px] text-[#6B7280]">
                            {r.fee_percentage}% · {r.fee_basis.replace(/_/g, ' ')}
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-right font-mono font-bold tabular-nums text-[#0D7A6F]">
                          {formatInrCurrency(r.calculated_fee_inr)}
                        </td>
                        <td className="py-3 pr-3 space-y-0.5">
                          <p
                            className={`font-semibold ${
                              st.tone === 'teal'
                                ? 'text-[#0D7A6F]'
                                : st.tone === 'crimson'
                                ? 'text-red-700'
                                : st.tone === 'amber'
                                ? 'text-amber-800'
                                : 'text-[#374151]'
                            }`}
                          >
                            {st.label}
                          </p>
                          {r.approval_reference && (
                            <p className="font-mono text-[11px] text-[#4B5563]">
                              Sanction: {r.approval_reference} ({r.approval_date})
                            </p>
                          )}
                          {r.latest_invoice_number && (
                            <p className="font-mono text-[11px] text-[#0F2942]">Invoice: {r.latest_invoice_number}</p>
                          )}
                          {r.latest_payment_reference && (
                            <p className="font-mono text-[11px] text-[#0D7A6F]">Paid Ref: {r.latest_payment_reference}</p>
                          )}
                        </td>
                        <td className="py-3 text-right space-y-1.5 whitespace-nowrap">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {r.fee_status !== 'payment_received' && (
                              <button
                                type="button"
                                onClick={() => handleOpenBasisEditor(r)}
                                className="rounded border border-[#E2E6EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F2942] hover:bg-[#F7F6F2]"
                              >
                                Basis
                              </button>
                            )}
                            {canInvoice && (
                              <button
                                type="button"
                                disabled={busyId === r.project_id}
                                onClick={() => handleIssueInvoice(r.project_id)}
                                className="inline-flex items-center gap-1 rounded bg-[#0D7A6F] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                              >
                                <Receipt className="w-3 h-3" aria-hidden="true" />
                                <span>Issue Invoice</span>
                              </button>
                            )}
                            {r.fee_status === 'approved' && (
                              <button
                                type="button"
                                disabled={busyId === r.project_id}
                                onClick={() => handleTransitionStatus(r.project_id, 'awaiting_invoice')}
                                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-950"
                              >
                                Queue Invoice
                              </button>
                            )}
                            {r.fee_status === 'invoice_issued' && (
                              <button
                                type="button"
                                disabled={busyId === r.project_id}
                                onClick={() => handleTransitionStatus(r.project_id, 'payment_pending')}
                                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-950"
                              >
                                Mark Payment Pending
                              </button>
                            )}
                          </div>
                          {(r.fee_status === 'invoice_issued' || r.fee_status === 'payment_pending') &&
                            !data.gatewayConfigured && (
                              <p className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
                                <Lock className="w-3 h-3" aria-hidden="true" />
                                Collection Disabled (Gateway Not Configured)
                              </p>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Invoices & Payments Summary */}
        {data && (data.invoices.length > 0 || data.payments.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[#0F2942] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                <span>Issued Fee Invoices ({data.invoices.length})</span>
              </h3>
              <ul className="divide-y divide-[#E2E6EC] text-xs">
                {data.invoices.map((inv) => (
                  <li key={inv.id} className="py-2 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-mono font-semibold text-[#0F2942]">{inv.invoice_number}</p>
                      <p className="text-[#4B5563]">
                        {inv.billed_to_department} · {inv.invoice_date}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-[#0D7A6F] tabular-nums">
                        {formatInrCurrency(inv.invoice_amount_inr)}
                      </p>
                      <p className="text-[11px] text-[#6B7280]">{inv.invoice_status}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
              <h3 className="font-display text-sm font-semibold text-[#0F2942]">
                Verified Fee Payment Records ({data.payments.length})
              </h3>
              {data.payments.length === 0 ? (
                <p className="text-xs text-[#4B5563]">
                  No verified gateway payments recorded. Payment collection remains disabled until gateway credentials
                  are configured.
                </p>
              ) : (
                <ul className="divide-y divide-[#E2E6EC] text-xs">
                  {data.payments.map((pay) => (
                    <li key={pay.id} className="py-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold text-[#0F2942]">{pay.payment_reference}</p>
                        <p className="text-[#4B5563]">
                          {pay.gateway_provider} · {pay.payment_date}
                        </p>
                      </div>
                      <p className="font-mono font-semibold text-[#0D7A6F] tabular-nums">
                        {formatInrCurrency(pay.amount_inr)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
