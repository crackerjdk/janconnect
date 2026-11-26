import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, ClipboardList, FilePlus2, FolderKanban, ShieldCheck, XCircle } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { useToast } from '../../context/ToastContext';
import { apiFetch } from '../../services/api';
import type { ContractorProfile, GovernmentProject } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';
import { FEE_STATUS_LABELS, GOV_PROJECT_STATUS_LABELS } from '../../utils/govRules';

interface GovComplaintRow {
  id: string;
  title: string;
  description: string;
  category: string;
  generalized_location: string;
  platform_status: string;
  created_at: string;
  latest_approval_decision: 'approved' | 'rejected' | 'more_info_requested' | null;
  latest_approval_ref: string | null;
  latest_approval_dept: string | null;
  linked_project_id: string | null;
  linked_project_code: string | null;
}

type GovTab = 'complaints' | 'projects' | 'contractors';

export function GovDashboardPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<GovTab>('complaints');
  const [complaints, setComplaints] = useState<GovComplaintRow[]>([]);
  const [projects, setProjects] = useState<GovernmentProject[]>([]);
  const [contractors, setContractors] = useState<ContractorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Complaint review modal/inline state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({
    decision: 'approved' as 'approved' | 'rejected' | 'more_info_requested',
    authorityDepartment: 'Uttarakhand Public Works Department (PWD)',
    authorityDesignation: 'Executive Engineer',
    referenceNumber: '',
    decisionReason: '',
  });
  const [busyReview, setBusyReview] = useState(false);

  // Create official project inline state
  const [creatingFor, setCreatingFor] = useState<GovComplaintRow | null>(null);
  const [projectForm, setProjectForm] = useState({
    title: '',
    description: '',
    departmentName: 'Uttarakhand Public Works Department (PWD)',
    sanctionedBudgetInr: '1000000',
    estimatedCostInr: '950000',
    tenderReferenceNumber: '',
    budgetFundedBy: '',
    approvalDate: new Date().toISOString().slice(0, 10),
    expectedCompletionDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
  });
  const [busyCreate, setBusyCreate] = useState(false);
  const [busyVerifyId, setBusyVerifyId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, kRes] = await Promise.all([
        apiFetch<{ complaints: GovComplaintRow[] }>('/api/gov/complaints'),
        apiFetch<{ projects: GovernmentProject[] }>('/api/gov/projects'),
        apiFetch<{ contractors: ContractorProfile[] }>('/api/gov/contractors'),
      ]);
      setComplaints(cRes.complaints);
      setProjects(pRes.projects);
      setContractors(kRes.contractors);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingId) return;
    setBusyReview(true);
    try {
      await apiFetch(`/api/gov/complaints/${reviewingId}/review`, {
        method: 'POST',
        body: JSON.stringify(reviewForm),
      });
      showToast(`Government decision (${reviewForm.decision}) recorded.`, 'success');
      setReviewingId(null);
      setReviewForm((prev) => ({ ...prev, referenceNumber: '', decisionReason: '' }));
      await loadAll();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyReview(false);
    }
  };

  const openCreateProject = (c: GovComplaintRow) => {
    setCreatingFor(c);
    setProjectForm({
      title: c.title,
      description: c.description,
      departmentName: c.latest_approval_dept || 'Uttarakhand Public Works Department (PWD)',
      sanctionedBudgetInr: '1000000',
      estimatedCostInr: '950000',
      tenderReferenceNumber: '',
      budgetFundedBy: '',
      approvalDate: new Date().toISOString().slice(0, 10),
      expectedCompletionDate: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingFor) return;
    setBusyCreate(true);
    try {
      const res = await apiFetch<{ id: string; projectCode: string }>('/api/gov/projects', {
        method: 'POST',
        body: JSON.stringify({
          complaintId: creatingFor.id,
          title: projectForm.title,
          description: projectForm.description,
          departmentName: projectForm.departmentName,
          sanctionedBudgetInr: Number(projectForm.sanctionedBudgetInr),
          estimatedCostInr: Number(projectForm.estimatedCostInr),
          tenderReferenceNumber: projectForm.tenderReferenceNumber,
          budgetFundedBy: projectForm.budgetFundedBy,
          approvalDate: projectForm.approvalDate,
          expectedCompletionDate: projectForm.expectedCompletionDate,
        }),
      });
      showToast(`Official project ${res.projectCode} created. 1% Fee initialized as pending sanction.`, 'success');
      setCreatingFor(null);
      navigate(`/gov/projects/${res.id}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyCreate(false);
    }
  };

  const handleVerifyContractor = async (id: string, decision: 'verified' | 'suspended' | 'pending') => {
    setBusyVerifyId(id);
    try {
      await apiFetch(`/api/gov/contractors/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      showToast(`Contractor verification set to ${decision}.`, 'success');
      await loadAll();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBusyVerifyId(null);
    }
  };

  const pendingContractors = contractors.filter((c) => c.verification_status === 'pending').length;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 border-b border-[#E2E6EC]">
          <div>
            <p className="text-xs font-semibold text-[#0D7A6F]">Authorised Government Official Portal</p>
            <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
              Government Project & Procurement Console
            </h1>
            <p className="mt-1 text-xs text-[#4B5563]">
              Review citizen infrastructure reports, sanction official projects, verify contractor credentials, record
              official tenders/awards, and sanction the separate 1% JanConnect Facilitation Fee.
            </p>
          </div>
          <Link
            to="/projects"
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-[#F7F6F2] whitespace-nowrap"
          >
            <span>Public Projects Directory</span>
          </Link>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-4">
            <p className="text-xs text-[#4B5563]">Citizen Issues Reviewed</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#0F2942] tabular-nums">{complaints.length}</p>
          </div>
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-4">
            <p className="text-xs text-[#4B5563]">Official Projects</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#0D7A6F] tabular-nums">{projects.length}</p>
          </div>
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-4">
            <p className="text-xs text-[#4B5563]">Verified Contractors</p>
            <p className="mt-1 font-mono text-2xl font-bold text-[#0F2942] tabular-nums">
              {contractors.filter((c) => c.verification_status === 'verified').length}
            </p>
          </div>
          <div className="rounded-xl border border-[#E2E6EC] bg-white p-4">
            <p className="text-xs text-[#4B5563]">Pending Contractor KYC</p>
            <p className="mt-1 font-mono text-2xl font-bold text-amber-800 tabular-nums">{pendingContractors}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#E2E6EC] pb-3">
          {[
            { key: 'complaints' as GovTab, label: `Citizen Issues Queue (${complaints.length})`, icon: ClipboardList },
            { key: 'projects' as GovTab, label: `Official Projects (${projects.length})`, icon: FolderKanban },
            { key: 'contractors' as GovTab, label: `Contractor Verification (${contractors.length})`, icon: Building2 },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  active ? 'bg-[#0F2942] text-white' : 'border border-[#E2E6EC] bg-white text-[#374151] hover:bg-[#F7F6F2]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <>
            {/* Tab 1: Citizen Issues Queue */}
            {tab === 'complaints' && (
              <section className="space-y-4">
                {creatingFor && (
                  <form onSubmit={handleCreateProject} className="rounded-xl border border-[#0D7A6F]/50 bg-white p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2 border-b border-[#E2E6EC] pb-3">
                      <h2 className="font-display text-lg font-semibold text-[#0F2942]">
                        Create Official Government Project for Complaint {creatingFor.id.slice(0, 8)}
                      </h2>
                      <button
                        type="button"
                        onClick={() => setCreatingFor(null)}
                        className="text-xs font-semibold text-[#4B5563] underline"
                      >
                        Cancel
                      </button>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-xs font-medium text-[#374151]">
                        Project Title *
                        <input
                          type="text"
                          required
                          value={projectForm.title}
                          onChange={(e) => setProjectForm((p) => ({ ...p, title: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-medium text-[#374151]">
                        Responsible Government Department *
                        <input
                          type="text"
                          required
                          value={projectForm.departmentName}
                          onChange={(e) => setProjectForm((p) => ({ ...p, departmentName: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                        />
                      </label>
                      <label className="block text-xs font-medium text-[#374151]">
                        Sanctioned Project Budget (INR) *
                        <input
                          type="number"
                          min={10000}
                          required
                          value={projectForm.sanctionedBudgetInr}
                          onChange={(e) => setProjectForm((p) => ({ ...p, sanctionedBudgetInr: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                        />
                      </label>
                      <label className="block text-xs font-medium text-[#374151]">
                        Estimated Execution Cost (INR) *
                        <input
                          type="number"
                          min={1000}
                          required
                          value={projectForm.estimatedCostInr}
                          onChange={(e) => setProjectForm((p) => ({ ...p, estimatedCostInr: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                        />
                      </label>
                      <label className="block text-xs font-medium text-[#374151]">
                        Tender Reference Number (Optional at Creation)
                        <input
                          type="text"
                          value={projectForm.tenderReferenceNumber}
                          onChange={(e) => setProjectForm((p) => ({ ...p, tenderReferenceNumber: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                          placeholder="e.g., UK-PWD-TEN-2026-109"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block text-xs font-medium text-[#374151]">
                          Approval Date *
                          <input
                            type="date"
                            required
                            value={projectForm.approvalDate}
                            onChange={(e) => setProjectForm((p) => ({ ...p, approvalDate: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
                          />
                        </label>
                        <label className="block text-xs font-medium text-[#374151]">
                          Expected Completion *
                          <input
                            type="date"
                            required
                            value={projectForm.expectedCompletionDate}
                            onChange={(e) => setProjectForm((p) => ({ ...p, expectedCompletionDate: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs font-mono"
                          />
                        </label>
                      </div>
                      <label className="sm:col-span-2 block text-xs font-medium text-[#374151]">
                        Budget Funded By (Political Party / Public Scheme / Fund — Optional)
                        <input
                          type="text"
                          maxLength={120}
                          value={projectForm.budgetFundedBy}
                          onChange={(e) => setProjectForm((p) => ({ ...p, budgetFundedBy: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                          placeholder="e.g., ABC Political Party, MPLADS, State PWD Fund"
                        />
                      </label>
                    </div>
                    <label className="block text-xs font-medium text-[#374151]">
                      Official Project Scope & Description *
                      <textarea
                        rows={3}
                        required
                        value={projectForm.description}
                        onChange={(e) => setProjectForm((p) => ({ ...p, description: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                      />
                    </label>
                    <p className="text-xs text-[#4B5563]">
                      Note: Creating this project registers a proposed 1% JanConnect Digital Project Facilitation Fee in{' '}
                      <strong>Awaiting Government Approval</strong> state. No fee is approved or collectible until
                      explicitly sanctioned in the government agreement.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        type="submit"
                        disabled={busyCreate}
                        className="rounded-lg bg-[#0D7A6F] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                      >
                        {busyCreate ? 'Creating Official Project...' : 'Sanction & Create Project'}
                      </button>
                    </div>
                  </form>
                )}

                {complaints.length === 0 ? (
                  <EmptyState
                    title="No citizen issues available for government review"
                    description="Submitted or published citizen infrastructure reports appear here for authorised department review."
                  />
                ) : (
                  <div className="rounded-xl border border-[#E2E6EC] bg-white divide-y divide-[#E2E6EC]">
                    {complaints.map((c) => (
                      <div key={c.id} className="p-5 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="font-mono text-xs text-[#6B7280]">
                              Complaint ID: {c.id.slice(0, 8)} · {c.category} · {c.generalized_location}
                            </p>
                            <h2 className="font-display text-base font-semibold text-[#0F2942]">{c.title}</h2>
                            <p className="text-xs text-[#374151] leading-relaxed">{c.description}</p>
                            {c.latest_approval_decision && (
                              <p className="text-xs font-semibold text-[#0D7A6F]">
                                Latest Official Review: {c.latest_approval_decision.replace(/_/g, ' ').toUpperCase()} ·
                                Ref: {c.latest_approval_ref} ({c.latest_approval_dept})
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {c.linked_project_id ? (
                              <Link
                                to={`/gov/projects/${c.linked_project_id}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C]"
                              >
                                <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Manage {c.linked_project_code}</span>
                              </Link>
                            ) : (
                              <>
                                {c.latest_approval_decision === 'approved' && (
                                  <button
                                    type="button"
                                    onClick={() => openCreateProject(c)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A]"
                                  >
                                    <FilePlus2 className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Create Official Project</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setReviewingId(reviewingId === c.id ? null : c.id)}
                                  className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-3 py-1.5 text-xs font-semibold text-[#0F2942] hover:bg-white"
                                >
                                  Record Govt Review
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {reviewingId === c.id && (
                          <form onSubmit={handleSubmitReview} className="pt-4 border-t border-[#E2E6EC] grid gap-3 sm:grid-cols-2">
                            <label className="block text-xs font-medium text-[#374151]">
                              Official Decision *
                              <select
                                value={reviewForm.decision}
                                onChange={(e) =>
                                  setReviewForm((f) => ({
                                    ...f,
                                    decision: e.target.value as 'approved' | 'rejected' | 'more_info_requested',
                                  }))
                                }
                                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                              >
                                <option value="approved">Approve Issue for Project Creation</option>
                                <option value="more_info_requested">Request More Information</option>
                                <option value="rejected">Reject Issue</option>
                              </select>
                            </label>
                            <label className="block text-xs font-medium text-[#374151]">
                              File / Sanction Reference Number *
                              <input
                                type="text"
                                required
                                value={reviewForm.referenceNumber}
                                onChange={(e) => setReviewForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-mono"
                                placeholder="e.g., GOV-UK-PWD-2026-88"
                              />
                            </label>
                            <label className="block text-xs font-medium text-[#374151]">
                              Government Department *
                              <input
                                type="text"
                                required
                                value={reviewForm.authorityDepartment}
                                onChange={(e) => setReviewForm((f) => ({ ...f, authorityDepartment: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                              />
                            </label>
                            <label className="block text-xs font-medium text-[#374151]">
                              Official Designation *
                              <input
                                type="text"
                                required
                                value={reviewForm.authorityDesignation}
                                onChange={(e) => setReviewForm((f) => ({ ...f, authorityDesignation: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                              />
                            </label>
                            <label className="sm:col-span-2 block text-xs font-medium text-[#374151]">
                              Official Review Justification *
                              <input
                                type="text"
                                required
                                value={reviewForm.decisionReason}
                                onChange={(e) => setReviewForm((f) => ({ ...f, decisionReason: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs"
                                placeholder="State technical assessment, jurisdiction check, or required clarifications..."
                              />
                            </label>
                            <div className="sm:col-span-2 flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReviewingId(null)}
                                className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-semibold text-[#374151]"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={busyReview}
                                className="rounded-lg bg-[#0F2942] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-50"
                              >
                                {busyReview ? 'Saving...' : 'Submit Official Decision'}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Tab 2: Official Projects */}
            {tab === 'projects' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5">
                {projects.length === 0 ? (
                  <EmptyState
                    title="No official government projects yet"
                    description="Approve a citizen issue in the Citizen Issues Queue and create an official project."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E6EC] text-[#6B7280]">
                          <th className="py-2.5 pr-4 font-medium">Project</th>
                          <th className="py-2.5 pr-4 font-medium">Department</th>
                          <th className="py-2.5 pr-4 font-medium text-right">Sanctioned</th>
                          <th className="py-2.5 pr-4 font-medium text-right">Awarded</th>
                          <th className="py-2.5 pr-4 font-medium">Status</th>
                          <th className="py-2.5 pr-4 font-medium">1% Fee Status</th>
                          <th className="py-2.5 font-medium text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E6EC]">
                        {projects.map((p) => {
                          const pMeta = GOV_PROJECT_STATUS_LABELS[p.status];
                          const fMeta = p.fee_status ? FEE_STATUS_LABELS[p.fee_status] : null;
                          return (
                            <tr key={p.id} className="hover:bg-[#F7F6F2]/50">
                              <td className="py-3 pr-4">
                                <p className="font-semibold text-[#0F2942]">{p.title}</p>
                                <p className="font-mono text-[#6B7280]">
                                  {p.project_code} · {p.generalized_location}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#4B5563]">
                                  Budget funded by{' '}
                                  <strong className="font-semibold text-[#0F2942]">
                                    {p.budget_funded_by || 'Government / Public Allocation'}
                                  </strong>
                                </p>
                              </td>
                              <td className="py-3 pr-4 text-[#374151]">{p.department_name}</td>
                              <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#0F2942]">
                                {formatInrCurrency(p.sanctioned_budget_inr)}
                              </td>
                              <td className="py-3 pr-4 text-right font-mono tabular-nums text-[#0D7A6F]">
                                {p.awarded_amount_inr ? formatInrCurrency(p.awarded_amount_inr) : '—'}
                              </td>
                              <td className="py-3 pr-4 font-semibold text-[#0F2942]">{pMeta?.label || p.status}</td>
                              <td className="py-3 pr-4">
                                <span className="font-medium text-[#374151]">{fMeta?.label || 'Pending'}</span>
                                {p.calculated_fee_inr !== undefined && p.calculated_fee_inr !== null && (
                                  <span className="block font-mono text-[#6B7280] tabular-nums">
                                    {formatInrCurrency(p.calculated_fee_inr)}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right whitespace-nowrap">
                                <Link
                                  to={`/gov/projects/${p.id}`}
                                  className="inline-flex items-center rounded-md bg-[#0F2942] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#163A5C]"
                                >
                                  Manage Workspace
                                </Link>
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

            {/* Tab 3: Contractor Verification */}
            {tab === 'contractors' && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white divide-y divide-[#E2E6EC]">
                {contractors.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      title="No contractor registrations submitted"
                      description="Contractor profiles registered via the Contractor Registry page appear here for official verification."
                    />
                  </div>
                ) : (
                  contractors.map((c) => (
                    <div key={c.id} className="p-5 flex flex-wrap items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {c.logo_url ? (
                          <img
                            src={c.logo_url}
                            alt={`${c.registered_business_name} logo`}
                            className="h-12 w-12 rounded-lg border border-[#E2E6EC] object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-[#0F2942]" aria-hidden="true" />
                          </div>
                        )}
                        <div className="space-y-1 text-xs">
                          <p className="text-sm font-semibold text-[#0F2942]">
                            {c.registered_business_name}{' '}
                            <span className="font-mono text-xs font-normal text-[#6B7280]">
                              (@{c.owner_username})
                            </span>
                          </p>
                          <p className="font-mono text-[#374151]">
                            Reg: {c.govt_registration_number} · {c.registration_authority}
                            {c.registration_class ? ` (${c.registration_class})` : ''}
                          </p>
                          <p className="text-[#4B5563]">
                            Authorised Rep: {c.authorised_representative}
                            {c.district_coverage ? ` · Districts: ${c.district_coverage}` : ''}
                          </p>
                          {c.certifications.length > 0 && (
                            <p className="text-[#4B5563]">Certifications: {c.certifications.join(', ')}</p>
                          )}
                          <p
                            className={`font-semibold uppercase ${
                              c.verification_status === 'verified'
                                ? 'text-[#0D7A6F]'
                                : c.verification_status === 'suspended'
                                ? 'text-red-700'
                                : 'text-amber-800'
                            }`}
                          >
                            Status: {c.verification_status}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {c.verification_status !== 'verified' && (
                          <button
                            type="button"
                            disabled={busyVerifyId === c.id}
                            onClick={() => handleVerifyContractor(c.id, 'verified')}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#0D7A6F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Verify Firm</span>
                          </button>
                        )}
                        {c.verification_status !== 'suspended' && (
                          <button
                            type="button"
                            disabled={busyVerifyId === c.id}
                            onClick={() => handleVerifyContractor(c.id, 'suspended')}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Suspend</span>
                          </button>
                        )}
                        {c.verification_status !== 'pending' && (
                          <button
                            type="button"
                            disabled={busyVerifyId === c.id}
                            onClick={() => handleVerifyContractor(c.id, 'pending')}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-semibold text-[#374151]"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reset Pending</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
