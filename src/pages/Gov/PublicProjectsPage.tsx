import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CheckCircle2, Clock, FileCheck2, MapPin, Search, ShieldCheck, ArrowRight } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PaymentSplitTransparency } from '../../components/gov/PaymentSplitTransparency';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { apiFetch } from '../../services/api';
import type { GovernmentProject } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import { GOV_PROJECT_STATUS_LABELS, type GovProjectStatus } from '../../utils/govRules';

function GovStatusText({ status }: { status: GovProjectStatus }) {
  const meta = GOV_PROJECT_STATUS_LABELS[status] || GOV_PROJECT_STATUS_LABELS.approved;
  const cls =
    meta.tone === 'teal'
      ? 'text-[#0D7A6F]'
      : meta.tone === 'amber'
      ? 'text-amber-800'
      : meta.tone === 'crimson'
      ? 'text-red-700'
      : 'text-[#374151]';
  const Icon = status === 'completed' ? CheckCircle2 : Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${cls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </span>
  );
}

export function PublicProjectsPage() {
  const [projects, setProjects] = useState<GovernmentProject[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (query.trim()) params.set('q', query.trim());
      const res = await apiFetch<{ projects: GovernmentProject[] }>(`/api/public/projects?${params.toString()}`);
      setProjects(res.projects);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const completedCount = projects.filter((p) => p.status === 'completed' && p.public_transparency_published).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-[#E2E6EC]">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#0D7A6F]">
              Public Infrastructure & Contractor Transparency
            </p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
              Government Projects & Execution Ledger
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#4B5563]">
              Track official government projects created from verified citizen reports, sanctioned budgets, awarded
              contractors, inspection outcomes, and before-and-after completion evidence.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              to="/contractor-registry"
              className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-[#F7F6F2] whitespace-nowrap"
            >
              <Building2 className="w-3.5 h-3.5 text-[#0D7A6F]" aria-hidden="true" />
              <span>Contractor Registry & Portfolios</span>
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163A5C] whitespace-nowrap"
            >
              <span>Citizen Reports</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Summary & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 rounded-xl border border-[#E2E6EC] bg-white p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#4B5563]">
            <span>
              Visible Projects:{' '}
              <strong className="font-mono text-[#0F2942] tabular-nums">{projects.length}</strong>
            </span>
            <span>·</span>
            <span>
              Officially Completed & Verified:{' '}
              <strong className="font-mono text-[#0D7A6F] tabular-nums">{completedCount}</strong>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                role="searchbox"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search project, code, dept..."
                className="w-full rounded-lg border border-[#E2E6EC] pl-8 pr-3 py-1.5 text-xs text-[#111827] bg-white"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter government projects by status"
              className="rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-xs text-[#0F2942] font-medium"
            >
              <option value="all">All Project Stages</option>
              <option value="completed">Officially Completed (Verified)</option>
              <option value="in_progress">Execution In Progress</option>
              <option value="inspection">Under Govt Inspection</option>
              <option value="awarded">Contract Awarded</option>
              <option value="tendering">Tender / E-Procurement</option>
              <option value="approved">Project Approved</option>
            </select>
          </div>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : projects.length === 0 ? (
          <EmptyState
            title="No government projects recorded yet"
            description="Once an authorised government official approves a verified citizen report and sanctions a project, its public transparency record appears here."
            actionLabel="Browse Citizen Reports"
            actionTo="/explore"
            icon={<FileCheck2 className="w-8 h-8 text-[#0F2942]" />}
          />
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {projects.map((p) => (
              <article
                key={p.id}
                className="rounded-xl border border-[#E2E6EC] bg-white p-5 flex flex-col justify-between gap-4 hover:border-[#0D7A6F]/50 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-[#0F2942]">{p.project_code}</span>
                    <GovStatusText status={p.status} />
                  </div>

                  <div>
                    <h2 className="font-display text-lg font-semibold text-[#0F2942] leading-snug">
                      <Link to={`/projects/${p.id}`} className="hover:underline">
                        {p.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-[#4B5563]">
                      {p.department_name} · <MapPin className="inline w-3 h-3 mr-0.5 text-[#6B7280]" aria-hidden="true" />
                      {p.generalized_location}
                    </p>
                  </div>

                  <p className="text-sm text-[#374151] line-clamp-2 leading-relaxed">{p.description}</p>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E2E6EC] text-xs">
                    <div>
                      <p className="text-[#6B7280]">Sanctioned Budget</p>
                      <p className="mt-0.5 font-mono font-semibold text-[#0F2942] tabular-nums">
                        {formatInrCurrency(p.sanctioned_budget_inr)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[#6B7280]">Awarded Contract</p>
                      <p className="mt-0.5 font-mono font-semibold text-[#0D7A6F] tabular-nums">
                        {p.awarded_amount_inr ? formatInrCurrency(p.awarded_amount_inr) : 'Pending Official Award'}
                      </p>
                    </div>
                  </div>

                  {p.awarded_contractor_name && (
                    <div className="flex items-center gap-2.5 pt-2 text-xs text-[#374151]">
                      {p.awarded_contractor_logo ? (
                        <img
                          src={p.awarded_contractor_logo}
                          alt={`${p.awarded_contractor_name} logo`}
                          className="h-7 w-7 rounded border border-[#E2E6EC] object-cover bg-white"
                        />
                      ) : (
                        <Building2 className="w-4 h-4 text-[#0F2942] shrink-0" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        Contractor: <strong className="text-[#0F2942]">{p.awarded_contractor_name}</strong>
                        {p.awarded_contractor_reg ? ` (${p.awarded_contractor_reg})` : ''}
                      </span>
                    </div>
                  )}

                  <div className="rounded-lg bg-[#F7F6F2] px-3 py-2 text-xs text-[#0F2942]">
                    <span className="text-[#4B5563]">Budget funded by </span>
                    <strong className="font-semibold">
                      {p.budget_funded_by || 'Government / Public Allocation (Party Not Specified)'}
                    </strong>
                  </div>

                  {p.payment_breakdown && (
                    <PaymentSplitTransparency breakdown={p.payment_breakdown} compact showLedger={false} />
                  )}
                </div>

                <div className="pt-3 border-t border-[#E2E6EC] flex items-center justify-between gap-3 text-xs">
                  <div className="text-[#6B7280]">
                    {p.public_transparency_published && p.actual_completion_date ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0D7A6F]">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Verified Complete · {p.actual_completion_date}
                      </span>
                    ) : (
                      <span className="font-mono tabular-nums">Target: {p.expected_completion_date}</span>
                    )}
                  </div>
                  <Link
                    to={`/projects/${p.id}`}
                    className="inline-flex items-center gap-1 font-semibold text-[#0F2942] hover:text-[#0D7A6F] whitespace-nowrap"
                  >
                    <span>View Transparency Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
