import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard, Clock, CheckCircle2, Flag, History, BarChart3, Search, BadgeCheck, Eye } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { apiFetch, getInMemoryToken } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { AdminAnalyticsResponse, AdminReportRow, AdminVerificationRow } from '../../types/civic';
import { getNationalIdLabel } from '../../utils/nationalId';

type AdminTab = 'overview' | 'pending' | 'published' | 'verifications' | 'history' | 'analytics';

export function AdminDashboardPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<AdminAnalyticsResponse | null>(null);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [verifications, setVerifications] = useState<AdminVerificationRow[]>([]);
  const [verifReasons, setVerifReasons] = useState<Record<string, string>>({});
  const [verifBusyId, setVerifBusyId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; url: string; label: string } | null>(null);

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
      const [anRes, repRes, histRes, verifRes] = await Promise.all([
        apiFetch<AdminAnalyticsResponse>('/api/admin/analytics'),
        apiFetch<{ reports: AdminReportRow[] }>(
          `/api/admin/reports?status=${
            tab === 'pending' ? 'pending' : tab === 'published' ? 'published' : 'all'
          }&q=${encodeURIComponent(search)}`
        ),
        apiFetch<{ actions: typeof historyData.actions }>('/api/admin/moderation-history'),
        apiFetch<{ verifications: AdminVerificationRow[] }>('/api/admin/verifications'),
      ]);
      setAnalytics(anRes);
      setReports(repRes.reports);
      setHistoryData({ actions: histRes.actions });
      setVerifications(verifRes.verifications);
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

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

  const navItems: Array<{ key: AdminTab; label: string; icon: typeof LayoutDashboard }> = [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard },
    { key: 'pending', label: 'Pending Reports', icon: Clock },
    { key: 'published', label: 'Published Reports', icon: CheckCircle2 },
    { key: 'verifications', label: `Identity Verifications (${analytics?.metrics.pendingVerifications ?? 0})`, icon: BadgeCheck },
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
                      type="search"
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
