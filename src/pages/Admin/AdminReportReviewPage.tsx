import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bot } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { StatusLabel } from '../../components/ui/StatusLabel';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { apiFetch } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import type { ContractorBid, MediaAsset } from '../../types/civic';
import { BID_STATUS_LABELS, formatInrCurrency, type ModerationActionType, type PlatformStatus } from '../../utils/civicRules';

interface AdminReportDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  generalized_location: string;
  restricted_latitude: number | null;
  restricted_longitude: number | null;
  urgency_note: string | null;
  platform_status: PlatformStatus;
  visibility: 'private' | 'public';
  created_at: string;
  author_username: string;
  author_display_name: string;
  author_account_status: string;
  author_identity_status: string;
}

export function AdminReportReviewPage() {
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  const [report, setReport] = useState<AdminReportDetail | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [actions, setActions] = useState<
    Array<{ id: string; moderator_username: string; action: string; reason: string; previous_status: string; new_status: string; created_at: string }>
  >([]);
  const [duplicates, setDuplicates] = useState<
    Array<{ id: string; title: string; platform_status: PlatformStatus; generalized_location: string }>
  >([]);
  const [bids, setBids] = useState<ContractorBid[]>([]);
  const [bidBusyId, setBidBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<ModerationActionType | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [aiAssist, setAiAssist] = useState<{
    available: boolean;
    disclaimer: string;
    suggestedCategory?: string;
    spamRisk?: string;
    piiConcerns?: string[];
    duplicateSignals?: string;
    moderatorChecklist?: string[];
    error?: string;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch<{
        report: AdminReportDetail;
        media: MediaAsset[];
        actions: typeof actions;
        potentialDuplicates: typeof duplicates;
        bids?: ContractorBid[];
      }>(`/api/admin/reports/${id}`);
      setReport(res.report);
      setMedia(res.media);
      setActions(res.actions);
      setDuplicates(res.potentialDuplicates);
      setBids(res.bids || []);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  const handleReviewBid = async (bidId: string, decision: 'shortlist' | 'award' | 'reject') => {
    setBidBusyId(bidId);
    try {
      await apiFetch(`/api/admin/bids/${bidId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      showToast(`Contractor bid marked ${decision}.`, 'success');
      await loadDetail();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setBidBusyId(null);
    }
  };

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const executeAction = async (action: ModerationActionType) => {
    if (!id) return;
    setSubmitting(true);
    try {
      await apiFetch(`/api/admin/reports/${id}/moderate`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      });
      showToast(`Moderation action "${action}" recorded.`, 'success');
      setReason('');
      setPendingAction(null);
      await loadDetail();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAiAssist = async () => {
    if (!id) return;
    setAiLoading(true);
    try {
      const res = await apiFetch<typeof aiAssist>(`/api/admin/reports/${id}/ai-assist`, { method: 'POST' });
      setAiAssist(res);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
        <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F2942] hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Moderator Console</span>
        </Link>

        {loading || !report ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7 space-y-6">
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563]">
                  <span className="font-semibold text-[#0F2942]">{report.category}</span>
                  <StatusLabel status={report.platform_status} />
                </div>
                <h1 className="font-display text-2xl font-bold text-[#0F2942]">{report.title}</h1>
                <div className="text-xs text-[#4B5563] space-y-1">
                  <p>
                    <strong>Generalized Area:</strong> {report.generalized_location}
                  </p>
                  {report.restricted_latitude != null && report.restricted_longitude != null && (
                    <p className="font-mono text-[#0F2942]">
                      Moderator-Only Coordinates: {report.restricted_latitude}, {report.restricted_longitude}
                    </p>
                  )}
                  <p>
                    <strong>Submitted by:</strong> {report.author_display_name} (@{report.author_username}) · Account:{' '}
                    {report.author_account_status} · Verification: {report.author_identity_status}
                  </p>
                </div>
                <p className="whitespace-pre-line text-sm text-[#1F2937] leading-relaxed pt-2 border-t border-[#E2E6EC]">
                  {report.description}
                </p>
                {report.urgency_note && (
                  <p className="text-xs text-[#374151] bg-[#F7F6F2] p-3 rounded-lg">
                    <strong>Safety / Accessibility Note:</strong> {report.urgency_note}
                  </p>
                )}

                {media.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-xs font-semibold text-[#0F2942]">Submitted Media (EXIF-Stripped)</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {media.map((m) => (
                        <div key={m.id} className="rounded-lg overflow-hidden border border-[#E2E6EC]">
                          {m.media_type.startsWith('video/') ? (
                            <video controls src={m.url} className="w-full max-h-56 bg-black" />
                          ) : (
                            <img src={m.url} alt="Private moderation media" className="w-full h-44 object-cover" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Contractor Bids on This Report */}
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
                <h2 className="font-display text-sm font-semibold text-[#0F2942]">
                  Contractor Work Bids ({bids.length})
                </h2>
                {bids.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No contractor bids submitted on this report yet.</p>
                ) : (
                  <ul className="divide-y divide-[#E2E6EC] text-xs">
                    {bids.map((b) => (
                      <li key={b.id} className="py-3 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[#0F2942]">
                              {b.company_name} ({b.registration_number})
                            </p>
                            <p className="text-[#4B5563]">
                              @{b.contractor_username} · {BID_STATUS_LABELS[b.bid_status].label}
                            </p>
                          </div>
                          <div className="text-right font-mono tabular-nums">
                            <p className="font-bold text-[#0F2942]">{formatInrCurrency(b.bid_amount_inr)}</p>
                            <p className="text-[#6B7280]">
                              {b.estimated_days}d · {b.warranty_months}m warranty
                            </p>
                          </div>
                        </div>
                        <p className="text-[#374151]">{b.proposal_summary}</p>
                        {b.bid_status !== 'awarded' && (
                          <div className="flex items-center gap-2">
                            {b.bid_status !== 'shortlisted' && (
                              <button
                                type="button"
                                disabled={bidBusyId === b.id}
                                onClick={() => handleReviewBid(b.id, 'shortlist')}
                                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-950"
                              >
                                Shortlist
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={bidBusyId === b.id}
                              onClick={() => handleReviewBid(b.id, 'award')}
                              className="rounded bg-[#0D7A6F] px-2.5 py-1 font-semibold text-white"
                            >
                              Award Work
                            </button>
                            {b.bid_status !== 'rejected' && (
                              <button
                                type="button"
                                disabled={bidBusyId === b.id}
                                onClick={() => handleReviewBid(b.id, 'reject')}
                                className="rounded border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700"
                              >
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Potential Duplicates */}
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
                <h2 className="font-display text-sm font-semibold text-[#0F2942]">
                  Recent Reports in Same Category ({duplicates.length})
                </h2>
                {duplicates.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No other reports in this category yet.</p>
                ) : (
                  <ul className="divide-y divide-[#E2E6EC] text-xs">
                    {duplicates.map((d) => (
                      <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                        <div>
                          <Link to={`/admin/reports/${d.id}`} className="font-medium text-[#0F2942] hover:underline">
                            {d.title}
                          </Link>
                          <p className="text-[#6B7280]">{d.generalized_location}</p>
                        </div>
                        <StatusLabel status={d.platform_status} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Right Column: AI Assist + Human Decision + Action History */}
            <div className="lg:col-span-5 space-y-5">
              {/* Optional Gemini AI Triage */}
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-semibold text-[#0F2942] inline-flex items-center gap-1.5">
                    <Bot className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                    <span>Advisory Triage Check</span>
                  </h2>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={handleRunAiAssist}
                    className="rounded-lg border border-[#E2E6EC] px-3 py-1.5 text-xs font-medium text-[#0F2942] hover:bg-[#F7F6F2]"
                  >
                    {aiLoading ? 'Checking...' : 'Run AI Check'}
                  </button>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Optional AI checks category fit, spam, and PII exposure. AI never decides factual truth.
                </p>
                {aiAssist && (
                  <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-3 text-xs space-y-1.5">
                    {aiAssist.error ? (
                      <p className="text-amber-900">{aiAssist.error}</p>
                    ) : (
                      <>
                        <p>
                          <strong>Suggested Category:</strong> {aiAssist.suggestedCategory}
                        </p>
                        <p>
                          <strong>Spam Risk:</strong> {aiAssist.spamRisk}
                        </p>
                        <p>
                          <strong>Duplicate Signal:</strong> {aiAssist.duplicateSignals}
                        </p>
                        {aiAssist.piiConcerns && aiAssist.piiConcerns.length > 0 && (
                          <p className="text-red-700">
                            <strong>PII Flags:</strong> {aiAssist.piiConcerns.join('; ')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </section>

              {/* Human Moderation Decision */}
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
                <h2 className="font-display text-base font-semibold text-[#0F2942]">Human Moderation Decision</h2>
                <div>
                  <label htmlFor="mod-reason" className="block text-xs font-medium text-[#374151] mb-1">
                    Internal Moderation Reason (recorded permanently, min 5 chars) *
                  </label>
                  <textarea
                    id="mod-reason"
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g., Verified public road hazard description, no PII present. Approved for जनConnect publication."
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  />
                </div>

                <div className="grid gap-2">
                  {(report.platform_status === 'submitted' ||
                    report.platform_status === 'additional_information_required') && (
                    <button
                      type="button"
                      disabled={submitting || reason.trim().length < 5}
                      onClick={() => executeAction('start_review')}
                      className="w-full rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-gray-100 disabled:opacity-50"
                    >
                      Mark Under Review
                    </button>
                  )}

                  {(report.platform_status === 'submitted' || report.platform_status === 'under_review') && (
                    <button
                      type="button"
                      disabled={submitting || reason.trim().length < 5}
                      onClick={() => executeAction('request_info')}
                      className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-950 disabled:opacity-50"
                    >
                      Request Additional Information
                    </button>
                  )}

                  {report.platform_status !== 'published' && report.platform_status !== 'rejected' && (
                    <button
                      type="button"
                      disabled={submitting || reason.trim().length < 5}
                      onClick={() => executeAction('publish')}
                      className="w-full rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A] disabled:opacity-50"
                    >
                      Publish to जनConnect
                    </button>
                  )}

                  {(report.platform_status === 'submitted' ||
                    report.platform_status === 'under_review' ||
                    report.platform_status === 'additional_information_required') && (
                    <button
                      type="button"
                      disabled={submitting || reason.trim().length < 5}
                      onClick={() => setPendingAction('reject')}
                      className="w-full rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject Report
                    </button>
                  )}

                  {report.platform_status === 'published' && (
                    <button
                      type="button"
                      disabled={submitting || reason.trim().length < 5}
                      onClick={() => setPendingAction('remove')}
                      className="w-full rounded-lg bg-red-700 px-4 py-2 text-xs font-semibold text-white hover:bg-red-800 disabled:opacity-50"
                    >
                      Remove from Public View
                    </button>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-3">
                <h2 className="font-display text-sm font-semibold text-[#0F2942]">
                  Moderation Action Log ({actions.length})
                </h2>
                {actions.length === 0 ? (
                  <p className="text-xs text-[#6B7280]">No moderator actions recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-[#E2E6EC] text-xs">
                    {actions.map((a) => (
                      <li key={a.id} className="py-2 space-y-0.5">
                        <p className="font-semibold text-[#0F2942]">
                          @{a.moderator_username}: {a.action} ({a.previous_status} → {a.new_status})
                        </p>
                        <p className="text-[#4B5563]">{a.reason}</p>
                        <p className="font-mono text-[#6B7280] tabular-nums">
                          {new Date(a.created_at).toLocaleString('en-IN')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={pendingAction !== null}
          title={pendingAction === 'reject' ? 'Confirm Report Rejection' : 'Confirm Public Removal'}
          description="This action is recorded permanently in the append-only moderation ledger and notifies the report author."
          confirmLabel={pendingAction === 'reject' ? 'Reject Report' : 'Remove Report'}
          destructive
          loading={submitting}
          onConfirm={() => pendingAction && executeAction(pendingAction)}
          onCancel={() => setPendingAction(null)}
        />
      </div>
    </AppShell>
  );
}
