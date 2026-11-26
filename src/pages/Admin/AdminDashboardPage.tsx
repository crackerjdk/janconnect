import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Clock, CheckCircle2, Flag, History, BarChart3, Search, BadgeCheck, Eye, Briefcase, Users, Landmark, Receipt, Pin, ArrowRightLeft } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PaymentSplitTransparency } from '../../components/gov/PaymentSplitTransparency';
import { PaymentTransferActionForm } from '../../components/gov/PaymentTransferActionForm';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { apiFetch, getInMemoryToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminAnalyticsResponse, AdminContractorBidRow, AdminReportRow, AdminVerificationRow } from '../../types/civic';
import type { BudgetPaymentBreakdown } from '../../types/gov';
import { BID_STATUS_LABELS, formatInrCurrency, type UserRole } from '../../utils/civicRules';
import { getNationalIdLabel } from '../../utils/nationalId';

type AdminTab = 'overview' | 'pending' | 'published' | 'bids' | 'transfers' | 'work-done' | 'verifications' | 'users' | 'history' | 'analytics';

interface TransferGovProjectRow {
  id: string;
  project_code: string;
  complaint_id: string;
  title: string;
  generalized_location: string;
  department_name: string;
  status: string;
  awarded_amount_inr: number;
  award_order_number: string;
  contractor_name: string;
  contractor_reg: string | null;
  budget_funded_by: string | null;
  payment_breakdown: BudgetPaymentBreakdown;
}

interface TransferBidRow {
  id: string;
  complaint_id: string;
  company_name: string;
  registration_number: string | null;
  bid_amount_inr: number;
  budget_funded_by: string | null;
  report_title: string;
  generalized_location: string;
  payment_breakdown: BudgetPaymentBreakdown;
}

interface CompletedProjectPinRow {
  id: string;
  project_code: string;
  complaint_id: string;
  title: string;
  description: string;
  generalized_location: string;
  department_name: string;
  sanctioned_budget_inr: number;
  actual_completion_date: string | null;
  budget_funded_by: string | null;
  is_pinned_work: boolean;
  pinned_rank: number | null;
  pinned_note: string | null;
  pinned_at: string | null;
  awarded_amount_inr: number | null;
  awarded_contractor_name: string | null;
  awarded_contractor_reg: string | null;
}

interface AdminUserRow {
  id: string;
  username: string;
  display_name: string;
  account_status: string;
  identity_status: string;
  roles: UserRole[];
  created_at: string;
}

export function AdminDashboardPage() {
  const { isAdministrator, isGovernmentAuthority, isFinancialAdmin } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [bids, setBids] = useState<AdminContractorBidRow[]>([]);
  const [bidNotes, setBidNotes] = useState<Record<string, string>>({});
  const [bidFunders, setBidFunders] = useState<Record<string, string>>({});
  const [bidBusyId, setBidBusyId] = useState<string | null>(null);
  const [completedProjects, setCompletedProjects] = useState<CompletedProjectPinRow[]>([]);
  const [pinRanks, setPinRanks] = useState<Record<string, string>>({});
  const [pinNotes, setPinNotes] = useState<Record<string, string>>({});
  const [pinBusyId, setPinBusyId] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<AdminVerificationRow[]>([]);
  const [verifReasons, setVerifReasons] = useState<Record<string, string>>({});
  const [verifBusyId, setVerifBusyId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; url: string; label: string } | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRow[]>([]);
  const [roleBusyKey, setRoleBusyKey] = useState<string | null>(null);
  const [transferGovProjects, setTransferGovProjects] = useState<TransferGovProjectRow[]>([]);
  const [transferBids, setTransferBids] = useState<TransferBidRow[]>([]);
  const canTransferPayments = isAdministrator || isGovernmentAuthority || isFinancialAdmin;

  const [historyData, setHistoryData] = useState<{
    actions: Array<{
      id: string;
      moderator_username: string;
      report_title: string;
      action: string;
      reason: string;
      previous_status: string;
      new_status: string;
      created_at: string;
    }>;
  }>({ actions: [] });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [anRes, repRes, histRes, verifRes, bidsRes, completedRes, usersRes, transferRes] = await Promise.all([
        apiFetch<AdminAnalyticsResponse>('/api/admin/analytics'),
        apiFetch<{ reports: AdminReportRow[] }>(
          `/api/admin/reports?status=${
            tab === 'pending' ? 'pending' : tab === 'published' ? 'published' : 'all'
          }&q=${encodeURIComponent(search)}`
        ),
        apiFetch<{ actions: typeof historyData.actions }>('/api/admin/moderation-history'),
        apiFetch<{ verifications: AdminVerificationRow[] }>('/api/admin/verifications'),
        apiFetch<{ bids: AdminContractorBidRow[] }>('/api/admin/bids'),
        apiFetch<{ projects: CompletedProjectPinRow[] }>('/api/admin/completed-projects'),
        isAdministrator ? apiFetch<{ users: AdminUserRow[] }>('/api/admin/users') : Promise.resolve({ users: [] }),
        canTransferPayments
          ? apiFetch<{ governmentProjects: TransferGovProjectRow[]; awardedBids: TransferBidRow[] }>(
              '/api/admin/payment-transfers'
            )
          : Promise.resolve({ governmentProjects: [], awardedBids: [] }),
      ]);
      setAnalytics(anRes);
      setReports(repRes.reports);
      setHistoryData({ actions: histRes.actions });
      setVerifications(verifRes.verifications);
      setBids(bidsRes.bids);
      setCompletedProjects(completedRes.projects);
      setAdminUsers(usersRes.users);
      setTransferGovProjects(transferRes.governmentProjects);
      setTransferBids(transferRes.awardedBids);
    } finally {
      setLoading(false);
    }
  }, [tab, search, isAdministrator, canTransferPayments]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (previewDoc?.url) {
        URL.revokeObjectURL(previewDoc.url);
      }
    };
  }, [previewDoc]);

  const handleOpenDocument = async (row: AdminVerificationRow) => {
    try {
      const token = getInMemoryToken();
      const res = await fetch(`/api/admin/verifications/${row.id}/document`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'same-origin',
      });
      if (!res.ok) {
        throw new Error('Could not load restricted ID document.');
      }
      const blob = await res.blob();
      if (previewDoc?.url) {
        URL.revokeObjectURL(previewDoc.url);
      }
      const url = URL.createObjectURL(blob);
      setPreviewDoc({
        id: row.id,
        url,
        label: `@${row.username} · ${getNationalIdLabel(row.id_type)} (${row.id_masked})`,
      });
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const handleReviewVerification = async (id: string, decision: 'approve' | 'reject') => {
    const reason = (verifReasons[id] || '').trim() || (decision === 'approve' ? 'National ID format and name match verified.' : '');
    if (reason.length < 5) {
      showToast('Please enter a reason (at least 5 characters) before rejecting.', 'error');
      return;
    }
    setVerifBusyId(id);
    try {
      await apiFetch(`/api/admin/verifications/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reason }),
      });
      showToast(decision === 'approve' ? 'National ID approved.' : 'National ID rejected.', 'success');
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setVerifBusyId(null);
    }
  };

  const handleReviewBid = async (bidId: string, decision: 'shortlist' | 'award' | 'reject') => {
    setBidBusyId(bidId);
    try {
      const payload: { decision: string; note: string; budgetFundedBy?: string } = {
        decision,
        note: bidNotes[bidId] || '',
      };
      if (bidFunders[bidId] !== undefined) {
        payload.budgetFundedBy = bidFunders[bidId];
      }
      await apiFetch(`/api/admin/bids/${bidId}/review`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast(
        decision === 'award'
          ? 'Work awarded to contractor.'
          : decision === 'shortlist'
          ? 'Contractor bid shortlisted.'
          : 'Contractor bid rejected.',
        'success'
      );
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBidBusyId(null);
    }
  };

  const handlePinWork = async (project: CompletedProjectPinRow, pinned: boolean) => {
    setPinBusyId(project.id);
    try {
      const rawRank = pinRanks[project.id] ?? (project.pinned_rank ? String(project.pinned_rank) : '');
      const rawNote = pinNotes[project.id] ?? (project.pinned_note || '');
      await apiFetch(`/api/admin/projects/${project.id}/pin`, {
        method: 'POST',
        body: JSON.stringify({
          pinned,
          pinnedRank: pinned && rawRank ? Number(rawRank) : null,
          pinnedNote: pinned ? rawNote : null,
        }),
      });
      showToast(
        pinned ? 'Completed work pinned to the Work Done showcase.' : 'Completed work removed from Work Done showcase.',
        'success'
      );
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setPinBusyId(null);
    }
  };

  const handleToggleUserRole = async (
    userId: string,
    role: 'moderator' | 'government_authority' | 'financial_admin' | 'administrator',
    grant: boolean
  ) => {
    const key = `${userId}:${role}`;
    setRoleBusyKey(key);
    try {
      await apiFetch(`/api/admin/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role, grant }),
      });
      showToast(`Role ${role.replace(/_/g, ' ')} ${grant ? 'granted' : 'revoked'}.`, 'success');
      await loadData();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setRoleBusyKey(null);
    }
  };

  const pinnedWorksCount = completedProjects.filter((p) => p.is_pinned_work).length;

  const navItems: Array<{ key: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'pending', label: 'Pending Reports', icon: Clock },
    { key: 'published', label: 'Published Reports', icon: CheckCircle2 },
    { key: 'bids', label: `Contractor Bids (${analytics?.metrics.activeBids ?? 0})`, icon: Briefcase },
    ...(canTransferPayments
      ? [
          {
            key: 'transfers' as AdminTab,
            label: `Payment Transfers (${transferGovProjects.length + transferBids.length})`,
            icon: ArrowRightLeft,
          },
        ]
      : []),
    { key: 'work-done', label: `Work Done Pins (${pinnedWorksCount})`, icon: Pin },
    { key: 'verifications', label: `Identity Verifications (${analytics?.metrics.pendingVerifications ?? 0})`, icon: BadgeCheck },
    ...(isAdministrator ? [{ key: 'users' as AdminTab, label: `Users & Authorities (${adminUsers.length})`, icon: Users }] : []),
    { key: 'history', label: 'Moderation History', icon: History },
    { key: 'analytics', label: 'Platform Analytics', icon: BarChart3 },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E2E6EC]">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2942]">Moderator Console</h1>
            <p className="text-xs text-[#4B5563]">
              Server-verified human moderation queue · All metrics come directly from database records.
            </p>
          </div>
          <Link
            to="/admin/content-reports"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-[#F7F6F2] whitespace-nowrap"
          >
            <Flag className="w-3.5 h-3.5 text-red-700" aria-hidden="true" />
            <span>Reported Content & Users ({analytics?.metrics.reportedContent ?? 0})</span>
          </Link>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-12 items-start">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-3 rounded-xl border border-[#E2E6EC] bg-white p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    active ? 'bg-[#0F2942] text-white' : 'text-[#374151] hover:bg-[#F7F6F2]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <Link
              to="/admin/content-reports"
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#374151] hover:bg-[#F7F6F2]"
            >
              <Flag className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Reported Content & Users</span>
            </Link>
            {isGovernmentAuthority && (
              <Link
                to="/gov"
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#0D7A6F] hover:bg-[#F7F6F2]"
              >
                <Landmark className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Gov Authority Console</span>
              </Link>
            )}
            {isFinancialAdmin && (
              <Link
                to="/finance"
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-[#0D7A6F] hover:bg-[#F7F6F2]"
              >
                <Receipt className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>1% Facilitation Fee</span>
              </Link>
            )}
          </aside>

          {/* Main Workspace */}
          <div className="lg:col-span-9 space-y-6">
            {/* Real Database Metrics Strip */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Total Submitted', analytics?.metrics.totalSubmitted ?? 0],
                ['Pending Queue', analytics?.metrics.pendingModeration ?? 0],
                ['Pending IDs', analytics?.metrics.pendingVerifications ?? 0],
                ['Published', analytics?.metrics.publishedReports ?? 0],
                ['Rejected', analytics?.metrics.rejectedReports ?? 0],
                ['Flagged Items', analytics?.metrics.reportedContent ?? 0],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-xl border border-[#E2E6EC] bg-white p-4">
                  <p className="text-xs text-[#4B5563]">{label}</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-[#0F2942] tabular-nums">{val}</p>
                </div>
              ))}
            </div>

            {(tab === 'overview' || tab === 'pending' || tab === 'published') && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    {tab === 'pending'
                      ? 'Pending Moderation Queue'
                      : tab === 'published'
                      ? 'Published Reports'
                      : 'All Submitted Reports'}
                  </h2>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                    <input
                      type="text"
                      role="searchbox"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter by title or area..."
                      className="w-full rounded-lg border border-[#E2E6EC] pl-8 pr-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                {loading ? (
                  <LoadingSkeleton rows={3} />
                ) : reports.length === 0 ? (
                  <EmptyState
                    title="No reports in this queue"
                    description="New citizen submissions appear here automatically as private items awaiting moderation."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-[#E2E6EC] text-xs text-[#4B5563]">
                          <th className="py-2.5 pr-4 font-medium">Report</th>
                          <th className="py-2.5 pr-4 font-medium">Area</th>
                          <th className="py-2.5 pr-4 font-medium">Status</th>
                          <th className="py-2.5 pr-4 font-medium text-right">Date</th>
                          <th className="py-2.5 font-medium text-right">Review</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E6EC]">
                        {reports.map((r) => (
                          <tr key={r.id} className="hover:bg-[#F7F6F2]/60">
                            <td className="py-3 pr-4">
                              <p className="font-medium text-[#0F2942]">{r.title}</p>
                              <p className="text-xs text-[#6B7280]">
                                {r.category} · @{r.author_username} · {r.media_count} files
                              </p>
                            </td>
                            <td className="py-3 pr-4 text-xs text-[#374151]">{r.generalized_location}</td>
                            <td className="py-3 pr-4">
                              <StatusLabel status={r.platform_status} />
                            </td>
                            <td className="py-3 pr-4 text-right font-mono text-xs text-[#6B7280] tabular-nums whitespace-nowrap">
                              {new Date(r.created_at).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <Link
                                to={`/admin/reports/${r.id}`}
                                className="inline-flex items-center rounded-md bg-[#0F2942] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#163A5C]"
                              >
                                Review
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === 'bids' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    Contractor Work Bids & Quotations Review
                  </h2>
                  <p className="text-xs text-[#4B5563] mt-0.5">
                    Review contractor quotations submitted on published Uttarakhand civic reports. Awarding a bid notifies
                    the contractor and report author and logs an append-only audit entry.
                  </p>
                </div>

                {loading ? (
                  <LoadingSkeleton rows={3} />
                ) : bids.length === 0 ? (
                  <EmptyState
                    title="No contractor bids submitted yet"
                    description="Contractor quotations placed on published reports will appear here for review."
                  />
                ) : (
                  <ul className="divide-y divide-[#E2E6EC]">
                    {bids.map((b) => {
                      const statusMeta = BID_STATUS_LABELS[b.bid_status];
                      return (
                        <li key={b.id} className="py-4 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#0F2942]">
                                {b.company_name}{' '}
                                <span className="font-mono text-xs font-normal text-[#6B7280]">
                                  ({b.registration_number} · @{b.contractor_username})
                                </span>
                              </p>
                              <p className="text-xs text-[#374151]">
                                For report:{' '}
                                <Link to={`/admin/reports/${b.complaint_id}`} className="font-medium text-[#0F2942] underline">
                                  {b.report_title}
                                </Link>{' '}
                                · {b.generalized_location}
                              </p>
                              <p className="text-xs text-[#4B5563] leading-relaxed">{b.proposal_summary}</p>
                              <div className="rounded bg-[#F7F6F2] px-2.5 py-1 text-[11px] text-[#0F2942] inline-block">
                                <span className="text-[#4B5563]">Budget funded by </span>
                                <strong className="font-semibold">
                                  {b.budget_funded_by || 'Pending Party / Public Attribution'}
                                </strong>
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-0.5">
                              <p className="font-mono text-base font-bold text-[#0F2942] tabular-nums">
                                {formatInrCurrency(b.bid_amount_inr)}
                              </p>
                              <p className="font-mono text-xs text-[#4B5563] tabular-nums">
                                {b.estimated_days} days · {b.warranty_months} mo warranty
                              </p>
                              <p className="text-xs font-semibold text-[#0D7A6F]">{statusMeta.label}</p>
                            </div>
                          </div>

                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="text"
                              value={bidFunders[b.id] ?? (b.budget_funded_by || '')}
                              onChange={(e) => setBidFunders((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              placeholder="Budget funded by (political party / fund, optional)..."
                              maxLength={120}
                              className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                            />
                            <input
                              type="text"
                              value={bidNotes[b.id] || ''}
                              onChange={(e) => setBidNotes((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              placeholder="Optional moderator note for contractor..."
                              className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                            />
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {b.bid_status !== 'shortlisted' && b.bid_status !== 'awarded' && (
                              <button
                                type="button"
                                disabled={bidBusyId === b.id}
                                onClick={() => handleReviewBid(b.id, 'shortlist')}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                              >
                                Shortlist
                              </button>
                            )}
                            {b.bid_status !== 'awarded' && (
                              <button
                                type="button"
                                disabled={bidBusyId === b.id}
                                onClick={() => handleReviewBid(b.id, 'award')}
                                className="rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                              >
                                Award Work
                              </button>
                            )}
                            {b.bid_status !== 'rejected' && b.bid_status !== 'awarded' && (
                              <button
                                type="button"
                                disabled={bidBusyId === b.id}
                                onClick={() => handleReviewBid(b.id, 'reject')}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            )}
                          </div>

                          {b.bid_status === 'awarded' && b.payment_breakdown && (
                            <div className="space-y-3 pt-2">
                              <PaymentSplitTransparency breakdown={b.payment_breakdown} />
                              {canTransferPayments && (
                                <PaymentTransferActionForm
                                  endpoint={`/api/admin/bids/${b.id}/transfers`}
                                  breakdown={b.payment_breakdown}
                                  onTransferred={(_next, msg) => {
                                    showToast(msg, 'success');
                                    void loadData();
                                  }}
                                  onError={(msg) => showToast(msg, 'error')}
                                />
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {tab === 'transfers' && canTransferPayments && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-6">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    Allotted Budget Split (1% Naman&apos;s Account / 99% Contractor) & Payment Transfers
                  </h2>
                  <p className="text-xs text-[#4B5563] mt-0.5">
                    Transfer payments for awarded government projects and awarded community contractor bids. The first 1%
                    from the allotted budget is deducted to Naman&apos;s Account as creator reward before the remaining
                    99% is sent to the contractor account. Every transfer appears publicly under each project.
                  </p>
                </div>

                {loading ? (
                  <LoadingSkeleton rows={3} />
                ) : transferGovProjects.length === 0 && transferBids.length === 0 ? (
                  <EmptyState
                    title="No awarded contracts ready for payment transfer"
                    description="Once a government project or contractor bid is awarded, its 1% / 99% disbursement and transfer controls appear here."
                  />
                ) : (
                  <div className="space-y-6">
                    {transferGovProjects.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-[#0F2942] border-b border-[#E2E6EC] pb-2">
                          Awarded Government Projects ({transferGovProjects.length})
                        </h3>
                        <div className="space-y-4">
                          {transferGovProjects.map((gp) => (
                            <div key={gp.id} className="rounded-xl border border-[#E2E6EC] p-4 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-mono text-xs font-semibold text-[#0D7A6F]">
                                    {gp.project_code} · Work Order {gp.award_order_number}
                                  </p>
                                  <Link
                                    to={`/projects/${gp.id}`}
                                    className="font-display text-base font-semibold text-[#0F2942] hover:underline"
                                  >
                                    {gp.title}
                                  </Link>
                                  <p className="text-xs text-[#4B5563]">
                                    {gp.department_name} · {gp.generalized_location} · Contractor:{' '}
                                    <strong className="text-[#0F2942]">{gp.contractor_name}</strong>
                                  </p>
                                </div>
                                <span className="font-mono text-sm font-bold text-[#0F2942] tabular-nums">
                                  {formatInrCurrency(gp.awarded_amount_inr)}
                                </span>
                              </div>
                              <PaymentSplitTransparency breakdown={gp.payment_breakdown} />
                              <PaymentTransferActionForm
                                endpoint={`/api/gov/projects/${gp.id}/transfers`}
                                breakdown={gp.payment_breakdown}
                                onTransferred={(_next, msg) => {
                                  showToast(msg, 'success');
                                  void loadData();
                                }}
                                onError={(msg) => showToast(msg, 'error')}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {transferBids.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-[#0F2942] border-b border-[#E2E6EC] pb-2">
                          Awarded Community Contractor Bids ({transferBids.length})
                        </h3>
                        <div className="space-y-4">
                          {transferBids.map((tb) => (
                            <div key={tb.id} className="rounded-xl border border-[#E2E6EC] p-4 space-y-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-mono text-xs font-semibold text-[#0D7A6F]">
                                    Awarded Contractor Bid · {tb.company_name}
                                  </p>
                                  <Link
                                    to={`/reports/${tb.complaint_id}#bidding`}
                                    className="font-display text-base font-semibold text-[#0F2942] hover:underline"
                                  >
                                    {tb.report_title}
                                  </Link>
                                  <p className="text-xs text-[#4B5563]">{tb.generalized_location}</p>
                                </div>
                                <span className="font-mono text-sm font-bold text-[#0F2942] tabular-nums">
                                  {formatInrCurrency(tb.bid_amount_inr)}
                                </span>
                              </div>
                              <PaymentSplitTransparency breakdown={tb.payment_breakdown} />
                              <PaymentTransferActionForm
                                endpoint={`/api/admin/bids/${tb.id}/transfers`}
                                breakdown={tb.payment_breakdown}
                                onTransferred={(_next, msg) => {
                                  showToast(msg, 'success');
                                  void loadData();
                                }}
                                onError={(msg) => showToast(msg, 'error')}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {tab === 'work-done' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    Top Completed Works Pinned by जनConnect Team
                  </h2>
                  <p className="text-xs text-[#4B5563] mt-0.5">
                    Feature up to 6 officially completed and Public Transparency-verified projects in the Work Done
                    section displayed next to Report a Problem.
                  </p>
                </div>

                {loading ? (
                  <LoadingSkeleton rows={3} />
                ) : completedProjects.length === 0 ? (
                  <EmptyState
                    title="No officially completed projects ready to pin"
                    description="Once a government authority marks a sanctioned project officially completed and publishes it to Public Transparency, it appears here for pinning."
                    actionLabel="View Public Projects"
                    actionTo="/projects"
                  />
                ) : (
                  <ul className="divide-y divide-[#E2E6EC]">
                    {completedProjects.map((p) => {
                      const rankValue = pinRanks[p.id] ?? (p.pinned_rank ? String(p.pinned_rank) : '');
                      const noteValue = pinNotes[p.id] ?? (p.pinned_note || '');
                      return (
                        <li key={p.id} className="py-4 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-mono text-xs font-semibold text-[#0D7A6F]">
                                {p.project_code} · {p.department_name}
                                {p.is_pinned_work
                                  ? ` · Pinned${p.pinned_rank ? ` #${p.pinned_rank}` : ' on Home'}`
                                  : ''}
                              </p>
                              <Link to={`/projects/${p.id}`} className="font-display text-sm font-semibold text-[#0F2942] hover:underline">
                                {p.title}
                              </Link>
                              <p className="text-xs text-[#4B5563]">
                                {p.generalized_location}
                                {p.awarded_contractor_name ? ` · Contractor: ${p.awarded_contractor_name}` : ''}
                                {p.actual_completion_date ? ` · Completed ${p.actual_completion_date}` : ''}
                              </p>
                              <div className="rounded bg-[#F7F6F2] px-2.5 py-1 text-[11px] text-[#0F2942] inline-block">
                                <span className="text-[#4B5563]">Budget funded by </span>
                                <strong className="font-semibold">
                                  {p.budget_funded_by || 'Government / Public Allocation (Party Not Specified)'}
                                </strong>
                              </div>
                            </div>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <p className="text-sm font-bold text-[#0F2942]">
                                {formatInrCurrency(p.awarded_amount_inr ?? p.sanctioned_budget_inr)}
                              </p>
                              <p className="text-[11px] text-[#6B7280]">
                                Sanctioned {formatInrCurrency(p.sanctioned_budget_inr)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <select
                              aria-label={`Pin position for ${p.project_code}`}
                              value={rankValue}
                              onChange={(e) => setPinRanks((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              className="sm:w-36 rounded-lg border border-[#E2E6EC] bg-white px-2.5 py-1.5 text-xs"
                            >
                              <option value="">Auto position</option>
                              <option value="1">#1 Position</option>
                              <option value="2">#2 Position</option>
                              <option value="3">#3 Position</option>
                              <option value="4">#4 Position</option>
                              <option value="5">#5 Position</option>
                              <option value="6">#6 Position</option>
                            </select>
                            <input
                              type="text"
                              maxLength={160}
                              value={noteValue}
                              onChange={(e) => setPinNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                              placeholder="Optional plain-text Work Done summary note (max 160 chars)..."
                              className="flex-1 rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                            />
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                disabled={pinBusyId === p.id}
                                onClick={() => handlePinWork(p, true)}
                                className="rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                              >
                                {p.is_pinned_work ? 'Update Pin' : 'Pin to Work Done'}
                              </button>
                              {p.is_pinned_work && (
                                <button
                                  type="button"
                                  disabled={pinBusyId === p.id}
                                  onClick={() => handlePinWork(p, false)}
                                  className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:bg-[#F7F6F2] disabled:opacity-50"
                                >
                                  Unpin
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            )}

            {tab === 'verifications' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    National ID Verification Queue
                  </h2>
                  <p className="text-xs text-[#4B5563] mt-0.5">
                    Only masked ID digits and restricted verification records are shown. Duplicate National IDs across
                    multiple accounts are blocked automatically on submission.
                  </p>
                </div>

                {previewDoc && (
                  <div className="rounded-lg border border-[#0F2942]/30 bg-[#F7F6F2] p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[#0F2942]">{previewDoc.label}</p>
                      <button
                        type="button"
                        onClick={() => {
                          URL.revokeObjectURL(previewDoc.url);
                          setPreviewDoc(null);
                        }}
                        className="text-xs font-medium text-[#4B5563] hover:text-[#111827] underline"
                      >
                        Close Preview
                      </button>
                    </div>
                    <img
                      src={previewDoc.url}
                      alt="Restricted National ID submission"
                      className="max-h-72 rounded-lg border border-[#E2E6EC] object-contain bg-white"
                    />
                  </div>
                )}

                {loading ? (
                  <LoadingSkeleton rows={3} />
                ) : verifications.length === 0 ? (
                  <EmptyState
                    title="No National ID submissions yet"
                    description="Citizen National ID verifications awaiting review will appear here."
                  />
                ) : (
                  <ul className="divide-y divide-[#E2E6EC]">
                    {verifications.map((v) => (
                      <li key={v.id} className="py-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#0F2942]">
                              {v.legal_name || v.display_name}{' '}
                              <span className="font-normal text-xs text-[#6B7280]">
                                (@{v.username} · {v.phone_verified ? 'Phone Verified' : 'Phone Unverified'})
                              </span>
                            </p>
                            <p className="text-xs text-[#374151]">
                              {getNationalIdLabel(v.id_type)} · Masked ID:{' '}
                              <span className="font-mono font-semibold">{v.id_masked}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {v.has_document && (
                              <button
                                type="button"
                                onClick={() => handleOpenDocument(v)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-[#E2E6EC] bg-[#F7F6F2] px-2.5 py-1 text-xs font-medium text-[#0F2942] hover:bg-[#E2E6EC]/50"
                              >
                                <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>View ID Photo</span>
                              </button>
                            )}
                            <span
                              className={`text-xs font-semibold uppercase tracking-wide ${
                                v.verification_status === 'verified'
                                  ? 'text-[#0D7A6F]'
                                  : v.verification_status === 'rejected'
                                  ? 'text-red-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {v.verification_status}
                            </span>
                          </div>
                        </div>

                        {v.verification_status === 'pending' ? (
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={verifReasons[v.id] || ''}
                              onChange={(e) => setVerifReasons((prev) => ({ ...prev, [v.id]: e.target.value }))}
                              placeholder="Review note (required for rejection, e.g., ID matches legal name)"
                              className="flex-1 rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={verifBusyId === v.id}
                                onClick={() => handleReviewVerification(v.id, 'approve')}
                                className="rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                              >
                                Approve ID
                              </button>
                              <button
                                type="button"
                                disabled={verifBusyId === v.id}
                                onClick={() => handleReviewVerification(v.id, 'reject')}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          </div>
                        ) : (
                          v.review_note && (
                            <p className="text-xs text-[#4B5563]">Review note: {v.review_note}</p>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab === 'users' && isAdministrator && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">
                    Users & Authority Role Assignment
                  </h2>
                  <p className="text-xs text-[#4B5563] mt-0.5">
                    Designate verified government officials (`government_authority`) or financial administrators
                    (`financial_admin`). Note: JanConnect administrators without `government_authority` cannot approve
                    projects or manipulate government tender results.
                  </p>
                </div>

                {adminUsers.length === 0 ? (
                  <EmptyState title="No registered users found" description="Registered user accounts appear here." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E6EC] text-[#6B7280]">
                          <th className="py-2 pr-3 font-medium">User</th>
                          <th className="py-2 pr-3 font-medium">Current Roles</th>
                          <th className="py-2 font-medium text-right">Authority Role Toggles</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E6EC]">
                        {adminUsers.map((u) => {
                          const roleList: Array<{ key: 'moderator' | 'government_authority' | 'financial_admin'; label: string }> = [
                            { key: 'government_authority', label: 'Gov Authority' },
                            { key: 'financial_admin', label: 'Financial Admin' },
                            { key: 'moderator', label: 'Moderator' },
                          ];
                          return (
                            <tr key={u.id}>
                              <td className="py-3 pr-3">
                                <p className="font-semibold text-[#0F2942]">{u.display_name}</p>
                                <p className="font-mono text-[#6B7280]">@{u.username}</p>
                              </td>
                              <td className="py-3 pr-3 font-mono text-[#374151]">{u.roles.join(', ')}</td>
                              <td className="py-3 text-right">
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  {roleList.map((rl) => {
                                    const hasRole = u.roles.includes(rl.key);
                                    const busy = roleBusyKey === `${u.id}:${rl.key}`;
                                    return (
                                      <button
                                        key={rl.key}
                                        type="button"
                                        disabled={busy}
                                        onClick={() => handleToggleUserRole(u.id, rl.key, !hasRole)}
                                        className={`rounded px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                                          hasRole
                                            ? 'bg-[#0D7A6F] text-white hover:bg-[#0A635A]'
                                            : 'border border-[#E2E6EC] bg-white text-[#374151] hover:bg-[#F7F6F2]'
                                        }`}
                                      >
                                        {hasRole ? `✓ ${rl.label}` : `+ ${rl.label}`}
                                      </button>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {tab === 'history' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-semibold text-[#0F2942]">Append-Only Moderation History</h2>
                {historyData.actions.length === 0 ? (
                  <EmptyState
                    title="No moderation actions recorded yet"
                    description="Every publish, reject, info-request, or removal action is permanently logged here."
                  />
                ) : (
                  <ul className="divide-y divide-[#E2E6EC]">
                    {historyData.actions.map((a) => (
                      <li key={a.id} className="py-3 text-xs space-y-1">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-semibold text-[#0F2942]">
                            @{a.moderator_username} · {a.action} ({a.previous_status} → {a.new_status})
                          </span>
                          <span className="font-mono text-[#6B7280] tabular-nums">
                            {new Date(a.created_at).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <p className="text-[#374151]">Report: {a.report_title}</p>
                        <p className="text-[#4B5563]">Reason: {a.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab === 'analytics' && (
              <section className="grid gap-6 md:grid-cols-2">
                <div className="rounded-xl border border-[#E2E6EC] bg-white p-5">
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">Reports by Category</h2>
                  {!analytics || analytics.byCategory.length === 0 ? (
                    <p className="mt-3 text-xs text-[#6B7280]">No submitted reports in database yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2.5">
                      {analytics.byCategory.map((c) => (
                        <li key={c.category} className="flex items-center justify-between text-xs">
                          <span className="text-[#374151]">{c.category}</span>
                          <span className="font-mono font-semibold text-[#0F2942] tabular-nums">{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-[#E2E6EC] bg-white p-5">
                  <h2 className="font-display text-base font-semibold text-[#0F2942]">Reports by District</h2>
                  {!analytics || analytics.byDistrict.length === 0 ? (
                    <p className="mt-3 text-xs text-[#6B7280]">No submitted reports in database yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-2.5">
                      {analytics.byDistrict.map((d) => (
                        <li key={d.district} className="flex items-center justify-between text-xs">
                          <span className="text-[#374151]">{d.district}</span>
                          <span className="font-mono font-semibold text-[#0F2942] tabular-nums">{d.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
