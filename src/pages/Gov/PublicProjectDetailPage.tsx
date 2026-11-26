import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Info,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PaymentSplitTransparency } from '../../components/gov/PaymentSplitTransparency';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { apiFetch } from '../../services/api';
import type {
  BudgetPaymentBreakdown,
  GovernmentProject,
  ProjectInspection,
  ProjectMediaItem,
  ProjectMilestone,
  ProjectTender,
} from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import { GOV_PROJECT_STATUS_LABELS } from '../../utils/govRules';

interface PublicProjectDetailResponse {
  project: GovernmentProject & {
    authority_department?: string;
    authority_designation?: string;
    approval_reference_number?: string;
  };
  award: {
    id: string;
    contractor_id: string;
    awarded_amount_inr: number;
    award_order_number: string;
    award_date: string;
    commencement_date: string | null;
    contractor_name: string;
    govt_registration_number: string;
    registration_authority: string;
    verification_status: string;
    contractor_logo: string | null;
  } | null;
  tender: ProjectTender | null;
  milestones: ProjectMilestone[];
  inspections: ProjectInspection[];
  media: ProjectMediaItem[];
  payment_breakdown?: BudgetPaymentBreakdown;
}

export function PublicProjectDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<PublicProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<PublicProjectDetailResponse>(`/api/public/projects/${id}`)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError((err as Error).message || 'Unable to load project dossier.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <LoadingSkeleton rows={4} />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <EmptyState
            title="Project dossier unavailable"
            description={error || 'The requested government project record could not be found.'}
            actionLabel="Back to Public Projects"
            actionTo="/projects"
          />
        </div>
      </AppShell>
    );
  }

  const { project, award, tender, milestones, inspections, media } = data;
  const statusMeta = GOV_PROJECT_STATUS_LABELS[project.status] || GOV_PROJECT_STATUS_LABELS.approved;
  const beforePhotos = media.filter((m) => m.stage === 'before');
  const afterPhotos = media.filter((m) => m.stage === 'after');

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2942] hover:text-[#0D7A6F]"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>All Public Government Projects</span>
          </Link>
          <span className="font-mono text-xs text-[#6B7280]">
            Project ID: {project.project_code} · Original Issue:{' '}
            <Link to={`/reports/${project.complaint_id}`} className="underline text-[#0F2942]">
              {project.complaint_title || project.complaint_id.slice(0, 8)}
            </Link>
          </span>
        </div>

        {/* Project Header Card */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-[#0D7A6F]">{project.department_name}</p>
              <h1 className="font-display text-2xl font-bold text-[#0F2942]">{project.title}</h1>
              <p className="text-xs text-[#4B5563] flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#6B7280]" aria-hidden="true" />
                  {project.generalized_location}
                </span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-[#6B7280]" aria-hidden="true" />
                  Approved: {project.approval_date}
                </span>
                {project.approval_reference_number && (
                  <>
                    <span>·</span>
                    <span className="font-mono">Sanction Ref: {project.approval_reference_number}</span>
                  </>
                )}
              </p>
            </div>

            <div className="text-right space-y-1">
              <p className="text-xs font-semibold text-[#0F2942]">{statusMeta.label}</p>
              {project.public_transparency_published ? (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D7A6F]">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  Government Verified Completion
                </p>
              ) : (
                <p className="text-xs text-[#6B7280]">Execution & Verification Ongoing</p>
              )}
            </div>
          </div>

          <p className="text-sm text-[#374151] leading-relaxed">{project.description}</p>

          {/* Financial Transparency Strip */}
          <div className="grid gap-4 sm:grid-cols-4 pt-4 border-t border-[#E2E6EC]">
            <div>
              <p className="text-xs text-[#6B7280]">Original Sanctioned Budget</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#0F2942] tabular-nums">
                {formatInrCurrency(project.sanctioned_budget_inr)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Estimated Execution Cost</p>
              <p className="mt-1 font-mono text-lg font-semibold text-[#374151] tabular-nums">
                {formatInrCurrency(project.estimated_cost_inr)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Awarded Contract Amount</p>
              <p className="mt-1 font-mono text-lg font-bold text-[#0D7A6F] tabular-nums">
                {award ? formatInrCurrency(award.awarded_amount_inr) : 'Not Yet Awarded'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#6B7280]">Completion Timeline</p>
              <p className="mt-1 font-mono text-sm font-semibold text-[#0F2942] tabular-nums">
                {project.actual_completion_date
                  ? `Completed ${project.actual_completion_date}`
                  : `Expected ${project.expected_completion_date}`}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-[#F7F6F2] px-4 py-2.5 text-xs text-[#0F2942]">
            <span className="text-[#4B5563]">Budget funded by </span>
            <strong className="font-semibold">
              {project.budget_funded_by || 'Government / Public Allocation (Party Not Specified)'}
            </strong>
          </div>

          {data.payment_breakdown && <PaymentSplitTransparency breakdown={data.payment_breakdown} />}
        </section>

        {/* Awarded Contractor & Official Tender Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Awarded Contractor</h2>
            {!award ? (
              <p className="text-sm text-[#4B5563]">
                No contractor has been officially awarded for this project yet. Contract awards are recorded solely by
                authorised government authorities.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {award.contractor_logo ? (
                    <img
                      src={award.contractor_logo}
                      alt={`${award.contractor_name} logo`}
                      className="h-12 w-12 rounded-lg border border-[#E2E6EC] object-cover bg-white shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-[#0F2942]" aria-hidden="true" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-[#0F2942]">{award.contractor_name}</p>
                    <p className="text-xs text-[#4B5563] font-mono">
                      Reg: {award.govt_registration_number} · {award.registration_authority}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#0D7A6F]">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Identity & Registration Verified
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E2E6EC] text-xs">
                  <div>
                    <span className="text-[#6B7280]">Work Order Ref</span>
                    <p className="font-mono font-semibold text-[#0F2942]">{award.award_order_number}</p>
                  </div>
                  <div>
                    <span className="text-[#6B7280]">Award / Start Date</span>
                    <p className="font-mono font-semibold text-[#0F2942] tabular-nums">
                      {award.award_date}
                      {award.commencement_date ? ` · Started ${award.commencement_date}` : ''}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/contractor-registry?contractor=${award.contractor_id}`}
                  className="inline-block text-xs font-semibold text-[#0D7A6F] hover:underline"
                >
                  View Contractor Public Portfolio →
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Official Procurement & Tender</h2>
            {!tender ? (
              <p className="text-sm text-[#4B5563]">
                {project.tender_reference_number
                  ? `Tender Reference: ${project.tender_reference_number}. Detailed e-procurement link pending.`
                  : 'Official e-procurement tender record pending publication.'}
              </p>
            ) : (
              <div className="space-y-2.5 text-xs text-[#374151]">
                <p>
                  Tender Reference:{' '}
                  <strong className="font-mono text-[#0F2942]">{tender.tender_reference_number}</strong>
                </p>
                <p>
                  Mechanism: <strong className="text-[#0F2942]">{tender.procurement_portal_name}</strong>
                </p>
                <p>
                  Status: <strong className="text-[#0F2942]">{tender.tender_status.replace(/_/g, ' ')}</strong>
                  {tender.published_date ? ` · Published ${tender.published_date}` : ''}
                </p>
                {!tender.is_official_integration_active && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" aria-hidden="true" />
                    <span>
                      <strong>E-Procurement Integration Placeholder:</strong> Official government e-procurement API
                      integration is not active. JanConnect is not an authorised government tendering portal and only
                      mirrors verified official tender references.
                    </span>
                  </div>
                )}
                {tender.external_portal_url && (
                  <a
                    href={tender.external_portal_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#0D7A6F] hover:underline pt-1"
                  >
                    <span>Open Official Procurement Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Before-and-After Transparency Photos */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              Before & After Completion Verification Photographs
            </h2>
            <span className="text-xs text-[#6B7280]">
              {project.public_transparency_published
                ? 'Released publicly after official completion acceptance'
                : 'Photographs become public upon official project completion'}
            </span>
          </div>

          {beforePhotos.length === 0 && afterPhotos.length === 0 ? (
            <p className="text-sm text-[#4B5563]">
              No public before-and-after verification photographs have been released yet.
            </p>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#4B5563]">Before Commencement</p>
                {beforePhotos.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No pre-work photos published.</p>
                ) : (
                  <div className="grid gap-3">
                    {beforePhotos.map((m) => (
                      <figure key={m.id} className="space-y-1">
                        <img
                          src={m.url}
                          alt={m.caption || 'Before project execution'}
                          className="w-full h-56 object-cover rounded-lg border border-[#E2E6EC]"
                        />
                        {m.caption && <figcaption className="text-xs text-[#4B5563]">{m.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#0D7A6F]">After Completion & Acceptance</p>
                {afterPhotos.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No completion photos published.</p>
                ) : (
                  <div className="grid gap-3">
                    {afterPhotos.map((m) => (
                      <figure key={m.id} className="space-y-1">
                        <img
                          src={m.url}
                          alt={m.caption || 'After project completion'}
                          className="w-full h-56 object-cover rounded-lg border border-[#E2E6EC]"
                        />
                        {m.caption && <figcaption className="text-xs text-[#4B5563]">{m.caption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Milestones & Official Inspections */}
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">Execution Milestones</h2>
            {milestones.length === 0 ? (
              <p className="text-sm text-[#4B5563]">No milestones recorded yet.</p>
            ) : (
              <ul className="divide-y divide-[#E2E6EC]">
                {milestones.map((m) => (
                  <li key={m.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-semibold text-[#0F2942]">{m.title}</span>
                      <span className="font-mono text-xs font-semibold text-[#0D7A6F] tabular-nums">
                        {m.progress_percent}%
                      </span>
                    </div>
                    {m.description && <p className="text-xs text-[#4B5563]">{m.description}</p>}
                    <p className="text-xs text-[#6B7280] font-mono">
                      Status: {m.milestone_status}
                      {m.target_date ? ` · Target ${m.target_date}` : ''}
                      {m.completed_date ? ` · Done ${m.completed_date}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942] flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
              <span>Government Inspection Summary</span>
            </h2>
            {inspections.length === 0 ? (
              <p className="text-sm text-[#4B5563]">No official field inspections logged yet.</p>
            ) : (
              <ul className="divide-y divide-[#E2E6EC]">
                {inspections.map((ins) => (
                  <li key={ins.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#0F2942]">
                        {ins.inspection_stage.replace(/_/g, ' ')} · {ins.inspector_designation}
                      </span>
                      <span className="font-mono text-[#6B7280] tabular-nums">{ins.inspection_date}</span>
                    </div>
                    <p className="text-xs font-medium text-[#0D7A6F]">
                      Outcome: {ins.inspection_outcome.replace(/_/g, ' ')}
                      {ins.corrective_status !== 'none' ? ` · Corrective: ${ins.corrective_status}` : ''}
                    </p>
                    <p className="text-xs text-[#374151] leading-relaxed">{ins.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
