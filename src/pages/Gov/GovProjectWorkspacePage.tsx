import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, ClipboardCheck, ShieldCheck, Upload, AlertTriangle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { PaymentSplitTransparency } from '../../components/gov/PaymentSplitTransparency';
import { PaymentTransferActionForm } from '../../components/gov/PaymentTransferActionForm';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../context/ToastContext';
import { apiFetch, uploadFormDataWithProgress } from '../../services/api';
import type {
  BudgetPaymentBreakdown,
  ContractorProfile,
  FeeApprovalRecord,
  GovernmentProject,
  JanConnectFeeRecord,
  OfficialProjectBid,
  ProjectAward,
  ProjectInspection,
  ProjectMediaItem,
  ProjectMilestone,
  ProjectTender,
} from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import {
  calculateJanConnectFee,
  FEE_BASES,
  FEE_BASIS_LABELS,
  FEE_STATUS_LABELS,
  GOV_PROJECT_STATUS_LABELS,
  type FeeBasis,
} from '../../utils/govRules';

interface GovProjectDetailPayload {
  project: GovernmentProject;
  tender: ProjectTender | null;
  bids: OfficialProjectBid[];
  award: ProjectAward | null;
  milestones: ProjectMilestone[];
  inspections: ProjectInspection[];
  media: ProjectMediaItem[];
  feeRecord: JanConnectFeeRecord | null;
  feeApprovals: FeeApprovalRecord[];
  payment_breakdown?: BudgetPaymentBreakdown;
}

export function GovProjectWorkspacePage() {
  const { id } = useParams();
  const { showToast } = useToast();

  const [data, setData] = useState<GovProjectDetailPayload | null>(null);
  const [verifiedContractors, setVerifiedContractors] = useState<ContractorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Tender Form
  const [tenderForm, setTenderForm] = useState({
    tenderReferenceNumber: '',
    procurementPortalName: 'Uttarakhand e-Procurement Integration Placeholder',
    procurementMechanism: 'eprocurement_placeholder' as 'eprocurement_placeholder' | 'authorised_govt_portal',
    externalPortalUrl: '',
    estimatedTenderValueInr: '',
    publishedDate: new Date().toISOString().slice(0, 10),
    closingDate: '',
    tenderStatus: 'published_external_placeholder' as
      | 'draft'
      | 'published_external_placeholder'
      | 'bidding_closed'
      | 'evaluated'
      | 'awarded'
      | 'cancelled',
  });

  // Official Bid Form
  const [bidForm, setBidForm] = useState({
    contractorId: '',
    officialBidReference: '',
    quotedAmountInr: '',
    technicalScoreNote: '',
    bidStatus: 'recorded' as 'recorded' | 'technically_qualified' | 'lowest_evaluated' | 'disqualified' | 'rejected',
  });

  // Award Form
  const [awardForm, setAwardForm] = useState({
    contractorId: '',
    winningBidId: '',
    awardedAmountInr: '',
    awardOrderNumber: '',
    awardDate: new Date().toISOString().slice(0, 10),
    commencementDate: '',
    budgetFundedBy: '',
    remarks: '',
  });

  // Execution Update Form
  const [execForm, setExecForm] = useState({
    status: 'in_progress' as 'in_progress' | 'inspection' | 'on_hold' | 'awarded',
    commencementDate: new Date().toISOString().slice(0, 10),
    actualPaidInr: '0',
    budgetFundedBy: '',
  });

  // Milestone Form
  const [milestoneForm, setMilestoneForm] = useState({
    title: '',
    description: '',
    progressPercent: '50',
    milestoneStatus: 'in_progress' as 'pending' | 'in_progress' | 'completed' | 'delayed',
    targetDate: '',
  });

  // Inspection Form
  const [inspectForm, setInspectForm] = useState({
    inspectorName: '',
    inspectorDesignation: 'Assistant Engineer (PWD)',
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectionStage: 'mid_term' as 'commencement' | 'mid_term' | 'quality_test' | 'final_completion' | 'corrective_verification',
    inspectionOutcome: 'satisfactory' as 'satisfactory' | 'defects_noted' | 'corrective_verified' | 'rejected',
    summary: '',
    defectsFound: '',
    correctiveAction: '',
    correctiveStatus: 'none' as 'none' | 'open' | 'resolved',
  });

  // Media Upload Form
  const [mediaStage, setMediaStage] = useState<'before' | 'during' | 'after' | 'inspection'>('before');
  const [mediaCaption, setMediaCaption] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);

  // Completion Date
  const [completionDate, setCompletionDate] = useState(new Date().toISOString().slice(0, 10));

  // 1% Fee Govt Sanction Form
  const [feeForm, setFeeForm] = useState({
    decision: 'approved' as 'approved' | 'not_applicable' | 'cancelled' | 'disputed',
    feeBasis: 'sanctioned_budget' as FeeBasis,
    feePercentage: '1',
    customApprovedBaseInr: '',
    approvalAuthority: 'State Project Sanctioning Committee',
    approvalReference: '',
    agreementClause: 'Clause 7.2 — JanConnect Digital Project Facilitation Fee (1%)',
    approvalDate: new Date().toISOString().slice(0, 10),
    remarks: '',
  });

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, contRes] = await Promise.all([
        apiFetch<GovProjectDetailPayload>(`/api/gov/projects/${id}`),
        apiFetch<{ contractors: ContractorProfile[] }>('/api/gov/contractors'),
      ]);
      setData(projRes);
      const verified = contRes.contractors.filter((c) => c.verification_status === 'verified');
      setVerifiedContractors(verified);

      if (projRes.tender) {
        setTenderForm({
          tenderReferenceNumber: projRes.tender.tender_reference_number,
          procurementPortalName: projRes.tender.procurement_portal_name,
          procurementMechanism: projRes.tender.procurement_mechanism,
          externalPortalUrl: projRes.tender.external_portal_url || '',
          estimatedTenderValueInr: String(projRes.tender.estimated_tender_value_inr),
          publishedDate: projRes.tender.published_date || '',
          closingDate: projRes.tender.closing_date || '',
          tenderStatus: projRes.tender.tender_status,
        });
      } else {
        setTenderForm((prev) => ({
          ...prev,
          tenderReferenceNumber: projRes.project.tender_reference_number || '',
          estimatedTenderValueInr: String(projRes.project.estimated_cost_inr),
        }));
      }

      setAwardForm((prev) => ({
        ...prev,
        budgetFundedBy: projRes.project.budget_funded_by || prev.budgetFundedBy,
      }));

      setExecForm({
        status:
          projRes.project.status === 'inspection' || projRes.project.status === 'on_hold'
            ? projRes.project.status
            : projRes.project.status === 'awarded'
            ? 'awarded'
            : 'in_progress',
        commencementDate: projRes.award?.commencement_date || new Date().toISOString().slice(0, 10),
        actualPaidInr: String(projRes.award?.actual_paid_inr ?? 0),
        budgetFundedBy: projRes.project.budget_funded_by || '',
      });

      if (projRes.feeRecord) {
        setFeeForm((prev) => ({
          ...prev,
          feeBasis: projRes.feeRecord!.fee_basis,
          feePercentage: String(projRes.feeRecord!.fee_percentage),
          customApprovedBaseInr: String(projRes.feeRecord!.approved_fee_base_inr),
          approvalAuthority: projRes.feeRecord!.approval_authority || prev.approvalAuthority,
          approvalReference: projRes.feeRecord!.approval_reference || '',
        }));
      }

      if (verified[0]) {
        setBidForm((prev) => ({ ...prev, contractorId: prev.contractorId || verified[0].id }));
        setAwardForm((prev) => ({ ...prev, contractorId: prev.contractorId || verified[0].id }));
      }
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const runAction = async (fn: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    try {
      await fn();
      showToast(successMessage, 'success');
      await loadWorkspace();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <LoadingSkeleton rows={4} />
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <EmptyState
            title="Project workspace not found"
            description="Verify the project ID or return to the Government Authority Console."
            actionLabel="Back to Gov Console"
            actionTo="/gov"
          />
        </div>
      </AppShell>
    );
  }

  const { project, tender, bids, award, milestones, inspections, media, feeRecord, feeApprovals } = data;
  const pStatus = GOV_PROJECT_STATUS_LABELS[project.status];
  const fStatus = feeRecord ? FEE_STATUS_LABELS[feeRecord.fee_status] : null;

  const previewFee = calculateJanConnectFee({
    sanctionedBudgetInr: project.sanctioned_budget_inr,
    awardedContractAmountInr: award?.awarded_amount_inr || 0,
    actualContractorPaymentsInr: award?.actual_paid_inr || 0,
    feeBasis: feeForm.feeBasis,
    customApprovedBaseInr: Number(feeForm.customApprovedBaseInr) || 0,
    feePercentage: Number(feeForm.feePercentage) || 1,
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/gov" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F2942] hover:text-[#0D7A6F]">
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Government Console</span>
          </Link>
          <Link to={`/projects/${project.id}`} className="text-xs font-semibold text-[#0D7A6F] underline">
            View Public Transparency Dossier →
          </Link>
        </div>

        {/* Project Header & Financial Summary */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold text-[#0D7A6F]">
                {project.project_code} · {project.department_name} · {project.generalized_location}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-[#0F2942]">{project.title}</h1>
              <p className="mt-1 text-xs text-[#4B5563]">
                Original Complaint ID: <span className="font-mono">{project.complaint_id}</span> · Approval Date:{' '}
                <span className="font-mono">{project.approval_date}</span> · Expected Completion:{' '}
                <span className="font-mono">{project.expected_completion_date}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[#0F2942]">{pStatus?.label || project.status}</p>
              {project.public_transparency_published && (
                <p className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D7A6F]">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Published to Public Transparency
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-5 pt-4 border-t border-[#E2E6EC] text-xs">
            <div>
              <p className="text-[#6B7280]">Sanctioned Budget</p>
              <p className="mt-1 font-mono text-base font-bold text-[#0F2942] tabular-nums">
                {formatInrCurrency(project.sanctioned_budget_inr)}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">Estimated Cost</p>
              <p className="mt-1 font-mono text-base font-semibold text-[#374151] tabular-nums">
                {formatInrCurrency(project.estimated_cost_inr)}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">Awarded Contract</p>
              <p className="mt-1 font-mono text-base font-bold text-[#0D7A6F] tabular-nums">
                {award ? formatInrCurrency(award.awarded_amount_inr) : 'Not Awarded'}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">Actual Paid to Contractor</p>
              <p className="mt-1 font-mono text-base font-semibold text-[#0F2942] tabular-nums">
                {award ? formatInrCurrency(award.actual_paid_inr) : '₹0'}
              </p>
            </div>
            <div>
              <p className="text-[#6B7280]">JanConnect 1% Fee (Separate)</p>
              <p className="mt-1 font-mono text-base font-semibold text-amber-800 tabular-nums">
                {feeRecord ? formatInrCurrency(feeRecord.calculated_fee_inr) : '—'}
              </p>
              <p className="text-[11px] text-[#4B5563]">{fStatus?.label}</p>
            </div>
          </div>

          <div className="rounded-lg bg-[#F7F6F2] px-4 py-2.5 text-xs text-[#0F2942]">
            <span className="text-[#4B5563]">Budget funded by </span>
            <strong className="font-semibold">
              {project.budget_funded_by || 'Government / Public Allocation (Party Not Specified)'}
            </strong>
          </div>
        </section>

        {/* Section A: Official Tender & E-Procurement Placeholder */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">
              1. Official E-Procurement & Tender Reference
            </h2>
            <span className="text-xs font-medium text-amber-800">
              {tender?.is_official_integration_active
                ? 'Authorised Govt Portal Linked'
                : 'Integration Placeholder — Not an Authorised Tendering Platform'}
            </span>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-800" aria-hidden="true" />
            <span>
              Official government e-procurement bidding operates solely through the authorised procurement mechanism.
              JanConnect platform administrators cannot modify or override government tender results.
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction(
                () =>
                  apiFetch(`/api/gov/projects/${project.id}/tenders`, {
                    method: 'POST',
                    body: JSON.stringify({
                      ...tenderForm,
                      estimatedTenderValueInr: Number(tenderForm.estimatedTenderValueInr),
                    }),
                  }),
                'Official tender reference saved.'
              );
            }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <label className="block text-xs font-medium text-[#374151]">
              Tender Reference Number *
              <input
                type="text"
                required
                value={tenderForm.tenderReferenceNumber}
                onChange={(e) => setTenderForm((t) => ({ ...t, tenderReferenceNumber: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                placeholder="UK-EPROC-2026-0091"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Procurement Mechanism *
              <select
                value={tenderForm.procurementMechanism}
                onChange={(e) =>
                  setTenderForm((t) => ({
                    ...t,
                    procurementMechanism: e.target.value as 'eprocurement_placeholder' | 'authorised_govt_portal',
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="eprocurement_placeholder">E-Procurement Integration Placeholder</option>
                <option value="authorised_govt_portal">Authorised Government E-Procurement Portal</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Tender Status
              <select
                value={tenderForm.tenderStatus}
                onChange={(e) =>
                  setTenderForm((t) => ({
                    ...t,
                    tenderStatus: e.target.value as typeof tenderForm.tenderStatus,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="draft">Draft</option>
                <option value="published_external_placeholder">Published (External Placeholder)</option>
                <option value="bidding_closed">Bidding Closed</option>
                <option value="evaluated">Evaluated</option>
                <option value="awarded">Awarded</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Procurement Portal Name
              <input
                type="text"
                value={tenderForm.procurementPortalName}
                onChange={(e) => setTenderForm((t) => ({ ...t, procurementPortalName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Estimated Tender Value (INR)
              <input
                type="number"
                min={1000}
                value={tenderForm.estimatedTenderValueInr}
                onChange={(e) => setTenderForm((t) => ({ ...t, estimatedTenderValueInr: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              External Portal URL (Optional HTTPS)
              <input
                type="url"
                value={tenderForm.externalPortalUrl}
                onChange={(e) => setTenderForm((t) => ({ ...t, externalPortalUrl: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                placeholder="https://uktenders.gov.in/..."
              />
            </label>
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-50"
              >
                Save Official Tender Reference
              </button>
            </div>
          </form>
        </section>

        {/* Section B: Confidential Official Bids & Contract Award */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">
              2. Confidential Procurement Bids (Authority Only)
            </h2>
            {bids.length > 0 && (
              <ul className="divide-y divide-[#E2E6EC] text-xs">
                {bids.map((b) => (
                  <li key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[#0F2942]">
                        {b.contractor_name} ({b.govt_registration_number})
                      </p>
                      <p className="font-mono text-[#6B7280]">
                        Bid Ref: {b.official_bid_reference} · {b.bid_status}
                      </p>
                    </div>
                    <p className="font-mono font-bold text-[#0F2942] tabular-nums">
                      {formatInrCurrency(b.quoted_amount_inr)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(
                  () =>
                    apiFetch(`/api/gov/projects/${project.id}/bids`, {
                      method: 'POST',
                      body: JSON.stringify({
                        ...bidForm,
                        quotedAmountInr: Number(bidForm.quotedAmountInr),
                      }),
                    }),
                  'Confidential procurement bid recorded.'
                );
              }}
              className="space-y-3 pt-3 border-t border-[#E2E6EC]"
            >
              <p className="text-xs font-semibold text-[#374151]">Log Official Procurement Bid</p>
              {verifiedContractors.length === 0 ? (
                <p className="text-xs text-amber-800">
                  No government-verified contractors available yet. Verify a contractor in the Gov Console first.
                </p>
              ) : (
                <>
                  <select
                    required
                    value={bidForm.contractorId}
                    onChange={(e) => setBidForm((b) => ({ ...b, contractorId: e.target.value }))}
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                  >
                    {verifiedContractors.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.registered_business_name} ({c.govt_registration_number})
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={bidForm.officialBidReference}
                      onChange={(e) => setBidForm((b) => ({ ...b, officialBidReference: e.target.value }))}
                      placeholder="Bid Ref ID (e.g., BID-101)"
                      className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                    />
                    <input
                      type="number"
                      min={1000}
                      required
                      value={bidForm.quotedAmountInr}
                      onChange={(e) => setBidForm((b) => ({ ...b, quotedAmountInr: e.target.value }))}
                      placeholder="Quoted INR"
                      className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !tender}
                    className="rounded-lg bg-[#0F2942] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-50"
                  >
                    Record Confidential Bid
                  </button>
                </>
              )}
            </form>
          </section>

          <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#0F2942]">3. Official Contract Award</h2>
            {award ? (
              <div className="space-y-2 text-xs text-[#374151]">
                <p className="text-sm font-semibold text-[#0D7A6F]">
                  Awarded to: {award.contractor_name} ({award.govt_registration_number})
                </p>
                <p className="font-mono">
                  Awarded Amount: <strong>{formatInrCurrency(award.awarded_amount_inr)}</strong> · Order Ref:{' '}
                  {award.award_order_number}
                </p>
                <p className="font-mono">
                  Award Date: {award.award_date}
                  {award.commencement_date ? ` · Commenced: ${award.commencement_date}` : ''}
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void runAction(
                    () =>
                      apiFetch(`/api/gov/projects/${project.id}/award`, {
                        method: 'POST',
                        body: JSON.stringify({
                          ...awardForm,
                          awardedAmountInr: Number(awardForm.awardedAmountInr),
                        }),
                      }),
                    'Official contract award recorded.'
                  );
                }}
                className="space-y-3"
              >
                <select
                  required
                  value={awardForm.contractorId}
                  onChange={(e) => setAwardForm((a) => ({ ...a, contractorId: e.target.value }))}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                >
                  {verifiedContractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.registered_business_name} ({c.govt_registration_number})
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min={1000}
                    required
                    value={awardForm.awardedAmountInr}
                    onChange={(e) => setAwardForm((a) => ({ ...a, awardedAmountInr: e.target.value }))}
                    placeholder="Awarded Contract INR"
                    className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="text"
                    required
                    value={awardForm.awardOrderNumber}
                    onChange={(e) => setAwardForm((a) => ({ ...a, awardOrderNumber: e.target.value }))}
                    placeholder="Work Order # (WO-2026-14)"
                    className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="date"
                    required
                    value={awardForm.awardDate}
                    onChange={(e) => setAwardForm((a) => ({ ...a, awardDate: e.target.value }))}
                    className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                  />
                  <input
                    type="date"
                    value={awardForm.commencementDate}
                    onChange={(e) => setAwardForm((a) => ({ ...a, commencementDate: e.target.value }))}
                    className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                    title="Commencement Date"
                  />
                </div>
                <input
                  type="text"
                  maxLength={120}
                  value={awardForm.budgetFundedBy}
                  onChange={(e) => setAwardForm((a) => ({ ...a, budgetFundedBy: e.target.value }))}
                  placeholder="Budget funded by (e.g., ABC Political Party, State PWD Fund — optional)"
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  disabled={busy || verifiedContractors.length === 0}
                  className="rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                >
                  Record Official Contract Award
                </button>
              </form>
            )}
          </section>
        </div>

        {/* Section C: Execution, Milestones, Inspections & Media */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E6EC] pb-4">
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">
              4. Execution Tracking, Field Inspections & Official Completion
            </h2>
            {project.status !== 'completed' && award && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={completionDate}
                  onChange={(e) => setCompletionDate(e.target.value)}
                  className="rounded-lg border border-[#E2E6EC] px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      () =>
                        apiFetch(`/api/gov/projects/${project.id}/complete`, {
                          method: 'POST',
                          body: JSON.stringify({ actualCompletionDate: completionDate }),
                        }),
                      'Project marked officially completed and published to Public Transparency.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Mark Officially Completed</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Execution Status & Paid */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(
                  () =>
                    apiFetch(`/api/gov/projects/${project.id}/execution`, {
                      method: 'PATCH',
                      body: JSON.stringify({
                        status: execForm.status,
                        commencementDate: execForm.commencementDate,
                        actualPaidInr: Number(execForm.actualPaidInr),
                        budgetFundedBy: execForm.budgetFundedBy,
                      }),
                    }),
                  'Execution progress and contractor payment amount updated.'
                );
              }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold text-[#0F2942]">Execution Status & Contractor Payments</p>
              <select
                value={execForm.status}
                onChange={(e) => setExecForm((f) => ({ ...f, status: e.target.value as typeof execForm.status }))}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="in_progress">Execution In Progress</option>
                <option value="inspection">Under Govt Inspection</option>
                <option value="on_hold">On Hold</option>
                <option value="awarded">Awarded (Pre-Start)</option>
              </select>
              <label className="block text-[11px] text-[#4B5563]">
                Work Commencement Date
                <input
                  type="date"
                  value={execForm.commencementDate}
                  onChange={(e) => setExecForm((f) => ({ ...f, commencementDate: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
              </label>
              <label className="block text-[11px] text-[#4B5563]">
                Actual Paid to Contractor (INR)
                <input
                  type="number"
                  min={0}
                  value={execForm.actualPaidInr}
                  onChange={(e) => setExecForm((f) => ({ ...f, actualPaidInr: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
              </label>
              <label className="block text-[11px] text-[#4B5563]">
                Budget Funded By (Party / Scheme / Fund)
                <input
                  type="text"
                  maxLength={120}
                  value={execForm.budgetFundedBy}
                  onChange={(e) => setExecForm((f) => ({ ...f, budgetFundedBy: e.target.value }))}
                  placeholder="e.g., ABC Political Party"
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                />
              </label>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C]"
              >
                Update Execution
              </button>
            </form>

            {/* Add Milestone */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(
                  () =>
                    apiFetch(`/api/gov/projects/${project.id}/milestones`, {
                      method: 'POST',
                      body: JSON.stringify({
                        ...milestoneForm,
                        progressPercent: Number(milestoneForm.progressPercent),
                      }),
                    }),
                  'Project milestone recorded.'
                );
                setMilestoneForm((m) => ({ ...m, title: '', description: '' }));
              }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold text-[#0F2942]">Add Progress Milestone ({milestones.length})</p>
              <input
                type="text"
                required
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((m) => ({ ...m, title: e.target.value }))}
                placeholder="Milestone title (e.g., Drainage Base Layer)"
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={milestoneForm.progressPercent}
                  onChange={(e) => setMilestoneForm((m) => ({ ...m, progressPercent: e.target.value }))}
                  placeholder="% Progress"
                  className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
                <input
                  type="date"
                  value={milestoneForm.targetDate}
                  onChange={(e) => setMilestoneForm((m) => ({ ...m, targetDate: e.target.value }))}
                  className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C]"
              >
                Record Milestone
              </button>
            </form>

            {/* Upload Before / During / After Media */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!mediaFile) return;
                void runAction(async () => {
                  const fd = new FormData();
                  fd.append('stage', mediaStage);
                  fd.append('caption', mediaCaption);
                  fd.append('file', mediaFile);
                  await uploadFormDataWithProgress(`/api/gov/projects/${project.id}/media`, fd, () => {});
                  setMediaCaption('');
                  setMediaFile(null);
                }, 'Execution photograph uploaded securely.');
              }}
              className="space-y-3"
            >
              <p className="text-xs font-semibold text-[#0F2942]">Upload Before / During / After Photos ({media.length})</p>
              <select
                value={mediaStage}
                onChange={(e) => setMediaStage(e.target.value as typeof mediaStage)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="before">Before Work</option>
                <option value="during">During Execution</option>
                <option value="after">After Completion</option>
                <option value="inspection">Inspection Evidence</option>
              </select>
              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Photo caption..."
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <div className="flex items-center gap-2 text-xs">
                <Upload className="w-3.5 h-3.5 text-[#6B7280]" aria-hidden="true" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                  className="text-xs"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !mediaFile}
                className="rounded-lg bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-50"
              >
                Upload Photo
              </button>
            </form>
          </div>

          {/* Field Inspections & Defects */}
          <div className="pt-4 border-t border-[#E2E6EC] space-y-4">
            <h3 className="text-sm font-semibold text-[#0F2942] flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
              <span>Field Inspection Reports & Corrective Work ({inspections.length})</span>
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runAction(
                  () =>
                    apiFetch(`/api/gov/projects/${project.id}/inspections`, {
                      method: 'POST',
                      body: JSON.stringify(inspectForm),
                    }),
                  'Official field inspection recorded.'
                );
                setInspectForm((ins) => ({ ...ins, summary: '', defectsFound: '', correctiveAction: '' }));
              }}
              className="grid gap-3 sm:grid-cols-4"
            >
              <input
                type="text"
                required
                value={inspectForm.inspectorName}
                onChange={(e) => setInspectForm((i) => ({ ...i, inspectorName: e.target.value }))}
                placeholder="Inspector Name *"
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                required
                value={inspectForm.inspectorDesignation}
                onChange={(e) => setInspectForm((i) => ({ ...i, inspectorDesignation: e.target.value }))}
                placeholder="Official Designation *"
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <select
                value={inspectForm.inspectionStage}
                onChange={(e) => setInspectForm((i) => ({ ...i, inspectionStage: e.target.value as typeof inspectForm.inspectionStage }))}
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="commencement">Commencement</option>
                <option value="mid_term">Mid-Term</option>
                <option value="quality_test">Quality Test</option>
                <option value="final_completion">Final Completion</option>
                <option value="corrective_verification">Corrective Verification</option>
              </select>
              <select
                value={inspectForm.inspectionOutcome}
                onChange={(e) =>
                  setInspectForm((i) => ({ ...i, inspectionOutcome: e.target.value as typeof inspectForm.inspectionOutcome }))
                }
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="satisfactory">Satisfactory</option>
                <option value="defects_noted">Defects Noted</option>
                <option value="corrective_verified">Corrective Work Verified</option>
                <option value="rejected">Rejected</option>
              </select>
              <input
                type="text"
                required
                value={inspectForm.summary}
                onChange={(e) => setInspectForm((i) => ({ ...i, summary: e.target.value }))}
                placeholder="Inspection findings summary (min 10 chars) *"
                className="sm:col-span-2 rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={inspectForm.defectsFound}
                onChange={(e) => setInspectForm((i) => ({ ...i, defectsFound: e.target.value }))}
                placeholder="Defects noted (if any)"
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <input
                type="text"
                value={inspectForm.correctiveAction}
                onChange={(e) => setInspectForm((i) => ({ ...i, correctiveAction: e.target.value }))}
                placeholder="Required corrective action"
                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
              <div className="sm:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#0F2942] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C]"
                >
                  Log Official Inspection
                </button>
              </div>
            </form>

            {inspections.length > 0 && (
              <ul className="divide-y divide-[#E2E6EC] text-xs">
                {inspections.map((ins) => (
                  <li key={ins.id} className="py-2.5 space-y-0.5">
                    <p className="font-semibold text-[#0F2942]">
                      {ins.inspection_date} · {ins.inspector_name} ({ins.inspector_designation}) —{' '}
                      <span className="text-[#0D7A6F]">{ins.inspection_outcome}</span>
                    </p>
                    <p className="text-[#374151]">{ins.summary}</p>
                    {ins.defects_found && (
                      <p className="text-red-700">
                        Defects: {ins.defects_found} · Corrective: {ins.corrective_action || 'Pending'} (
                        {ins.corrective_status})
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Section C2: Allotted Budget 1% Creator Reward / 99% Contractor Payment Transfer */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">
              4b. Allotted Budget Split (1% Naman&apos;s Account / 99% Contractor) & Payment Transfer
            </h2>
            <p className="text-xs text-[#4B5563]">
              When the budget is allotted to a contractor, the first 1% is deducted to creator account Naman&apos;s
              Account as reward, and the remaining 99% is transferred to the contractor account. Recorded transfers are
              shown publicly under the project.
            </p>
          </div>

          {data.payment_breakdown && <PaymentSplitTransparency breakdown={data.payment_breakdown} />}

          {award && data.payment_breakdown ? (
            <PaymentTransferActionForm
              endpoint={`/api/gov/projects/${project.id}/transfers`}
              breakdown={data.payment_breakdown}
              onTransferred={(nextBreakdown, message) => {
                setData((prev) => (prev ? { ...prev, payment_breakdown: nextBreakdown } : prev));
                showToast(message, 'success');
                void loadWorkspace();
              }}
              onError={(msg) => showToast(msg, 'error')}
            />
          ) : (
            <p className="text-xs text-[#6B7280]">
              Record an official contract award in Section 3 above to unlock payment transfers.
            </p>
          )}
        </section>

        {/* Section D: Government Sanction of 1% JanConnect Digital Project Facilitation Fee */}
        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#0F2942]">
                5. JanConnect Digital Project Facilitation Fee (1% Govt Agreement Sanction)
              </h2>
              <p className="text-xs text-[#4B5563]">
                The 1% technology fee is never automatically approved or deducted from contractors. Sanction it here
                only if explicitly included in the government agreement.
              </p>
            </div>
            {feeRecord && (
              <span className="text-xs font-semibold text-[#0F2942]">Current Status: {fStatus?.label}</span>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runAction(
                () =>
                  apiFetch(`/api/gov/projects/${project.id}/fee-approval`, {
                    method: 'POST',
                    body: JSON.stringify({
                      ...feeForm,
                      feePercentage: Number(feeForm.feePercentage),
                      customApprovedBaseInr: Number(feeForm.customApprovedBaseInr) || undefined,
                    }),
                  }),
                'Government decision on 1% JanConnect Facilitation Fee permanently recorded.'
              );
            }}
            className="grid gap-4 sm:grid-cols-3"
          >
            <label className="block text-xs font-medium text-[#374151]">
              Government Fee Decision *
              <select
                value={feeForm.decision}
                onChange={(e) => setFeeForm((f) => ({ ...f, decision: e.target.value as typeof feeForm.decision }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              >
                <option value="approved">Approve 1% Facilitation Fee</option>
                <option value="not_applicable">Mark Not Applicable</option>
                <option value="cancelled">Cancel Fee</option>
                <option value="disputed">Mark Disputed</option>
              </select>
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Approved Fee Basis *
              <select
                value={feeForm.feeBasis}
                onChange={(e) => setFeeForm((f) => ({ ...f, feeBasis: e.target.value as FeeBasis }))}
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
              Approved Fee Percentage (%) *
              <input
                type="number"
                step="0.1"
                min="0"
                max="10"
                value={feeForm.feePercentage}
                onChange={(e) => setFeeForm((f) => ({ ...f, feePercentage: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>

            {feeForm.feeBasis === 'custom_approved_base' && (
              <label className="block text-xs font-medium text-[#374151]">
                Custom Approved Base (INR) *
                <input
                  type="number"
                  min={0}
                  required
                  value={feeForm.customApprovedBaseInr}
                  onChange={(e) => setFeeForm((f) => ({ ...f, customApprovedBaseInr: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                />
              </label>
            )}

            <label className="block text-xs font-medium text-[#374151]">
              Approving Authority *
              <input
                type="text"
                required
                value={feeForm.approvalAuthority}
                onChange={(e) => setFeeForm((f) => ({ ...f, approvalAuthority: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Agreement / Sanction Reference *
              <input
                type="text"
                required
                value={feeForm.approvalReference}
                onChange={(e) => setFeeForm((f) => ({ ...f, approvalReference: e.target.value }))}
                placeholder="e.g., GO-UK-FIN-2026-312"
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>
            <label className="block text-xs font-medium text-[#374151]">
              Sanction Date *
              <input
                type="date"
                required
                value={feeForm.approvalDate}
                onChange={(e) => setFeeForm((f) => ({ ...f, approvalDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
              />
            </label>

            <div className="sm:col-span-3 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-3 text-xs flex flex-wrap items-center justify-between gap-3">
              <span>
                Calculated Fee Preview:{' '}
                <strong className="font-mono text-[#0D7A6F] tabular-nums">
                  {formatInrCurrency(previewFee.calculatedFeeInr)}
                </strong>{' '}
                ({previewFee.feePercentage}% of {formatInrCurrency(previewFee.approvedFeeBaseInr)})
              </span>
              <span className="font-mono text-[#4B5563] tabular-nums">
                Illustrative Execution Allocation: {formatInrCurrency(previewFee.illustrativeExecutionAllocationInr)}
              </span>
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0D7A6F] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
              >
                Record Official Fee Agreement Decision
              </button>
            </div>
          </form>

          {feeApprovals.length > 0 && (
            <div className="pt-4 border-t border-[#E2E6EC]">
              <p className="text-xs font-semibold text-[#0F2942] mb-2">Append-Only Fee Approval History</p>
              <ul className="divide-y divide-[#E2E6EC] text-xs">
                {feeApprovals.map((fa) => (
                  <li key={fa.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>{fa.decision.toUpperCase()}</strong> · {fa.approval_authority} (Ref:{' '}
                      <span className="font-mono">{fa.approval_reference}</span>) · @{fa.actor_username}
                    </span>
                    <span className="font-mono tabular-nums text-[#0F2942]">
                      {formatInrCurrency(fa.approved_fee_inr)} ({fa.approved_percentage}% on {fa.approved_fee_basis})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
