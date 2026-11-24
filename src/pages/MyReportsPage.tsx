import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { StatusLabel } from '../components/ui/StatusLabel';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { apiFetch } from '../services/api';
import type { MyReportSummary, StatusHistoryEntry } from '../types/civic';
import { STATUS_LABELS } from '../utils/civicRules';

export function MyReportsPage() {
  const [reports, setReports] = useState<MyReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyMap, setHistoryMap] = useState<Record<string, StatusHistoryEntry[]>>({});

  useEffect(() => {
    apiFetch<{ reports: MyReportSummary[] }>('/api/reports/my')
      .then((res) => setReports(res.reports))
      .finally(() => setLoading(false));
  }, []);

  const toggleHistory = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!historyMap[id]) {
      const res = await apiFetch<{ history: StatusHistoryEntry[] }>(`/api/reports/my/${id}`);
      setHistoryMap((prev) => ({ ...prev, [id]: res.history }));
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">My Submitted Reports</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Track जनConnect moderation progress and community visibility for your submissions.
            </p>
          </div>
          <Link
            to="/reports/create"
            className="inline-flex items-center justify-center rounded-lg bg-[#0D7A6F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A635A] whitespace-nowrap"
          >
            New Report
          </Link>
        </div>

        <IndependentNotice compact />

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="You haven’t submitted any reports yet"
            description="When you submit a civic problem, it enters our private moderation queue first and appears here for tracking."
            actionLabel="Report a Problem"
            actionTo="/reports/create"
          />
        ) : (
          <div className="space-y-4">
            {reports.map((r) => {
              const statusDesc = STATUS_LABELS[r.platform_status]?.description;
              const history = historyMap[r.id] || [];
              return (
                <article key={r.id} className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-[#0F2942]">{r.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Submitted {new Date(r.created_at).toLocaleDateString('en-IN')}</span>
                      <span aria-hidden="true">·</span>
                      <StatusLabel status={r.platform_status} />
                    </div>
                    <span className="font-mono text-xs tabular-nums">
                      Visibility: {r.visibility}
                    </span>
                  </div>

                  <h2 className="font-display text-lg font-semibold text-[#0F2942]">{r.title}</h2>
                  <p className="text-xs text-[#4B5563]">{r.generalized_location}</p>
                  {statusDesc && <p className="text-xs text-[#374151] bg-[#F7F6F2] rounded-lg px-3 py-2">{statusDesc}</p>}

                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <button
                      type="button"
                      onClick={() => toggleHistory(r.id)}
                      className="font-medium text-[#0F2942] hover:underline"
                    >
                      {expandedId === r.id ? 'Hide Moderation Progress' : 'View Moderation Progress'}
                    </button>

                    {r.platform_status === 'published' && r.visibility === 'public' && (
                      <Link
                        to={`/reports/${r.id}`}
                        className="font-semibold text-[#0D7A6F] hover:underline"
                      >
                        View Public Report ({r.support_count} support) →
                      </Link>
                    )}
                  </div>

                  {expandedId === r.id && (
                    <div className="pt-3 border-t border-[#E2E6EC] space-y-2">
                      <p className="text-xs font-semibold text-[#0F2942]">Status History</p>
                      {history.length === 0 ? (
                        <p className="text-xs text-[#6B7280]">Loading history...</p>
                      ) : (
                        <ul className="space-y-2">
                          {history.map((h) => (
                            <li key={h.id} className="flex flex-col sm:flex-row sm:justify-between gap-1 text-xs">
                              <div>
                                <StatusLabel status={h.new_status} />
                                {h.reason && <p className="text-[#4B5563] mt-0.5">{h.reason}</p>}
                              </div>
                              <span className="font-mono text-[#6B7280] tabular-nums">
                                {new Date(h.created_at).toLocaleString('en-IN')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
