import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, MapPin, MessageSquare, ThumbsUp } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { StatusLabel } from '../components/ui/StatusLabel';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { MediaAsset, ReportComment, StatusHistoryEntry } from '../types/civic';
import { detectPotentialPiiHints, type PlatformStatus } from '../utils/civicRules';

interface PublicReportDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  generalized_location: string;
  urgency_note: string | null;
  platform_status: PlatformStatus;
  created_at: string;
  published_at: string | null;
  support_count: number;
  user_has_supported: boolean;
  media: MediaAsset[];
}

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [report, setReport] = useState<PublicReportDetail | null>(null);
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [supportLoading, setSupportLoading] = useState(false);

  const [flagTarget, setFlagTarget] = useState<{ type: 'complaint' | 'comment'; id: string } | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagSubmitting, setFlagSubmitting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{
        report: PublicReportDetail;
        comments: ReportComment[];
        history: StatusHistoryEntry[];
      }>(`/api/reports/public/${id}`);
      setReport(res.report);
      setComments(res.comments);
      setHistory(res.history);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleSupport = async () => {
    if (!report) return;
    if (!user) {
      showToast('Sign in to support this report.', 'info');
      return;
    }
    setSupportLoading(true);
    try {
      const res = await apiFetch<{ supported: boolean; support_count: number }>(
        `/api/reports/${report.id}/support`,
        { method: report.user_has_supported ? 'DELETE' : 'POST' }
      );
      setReport({ ...report, user_has_supported: res.supported, support_count: res.support_count });
      showToast(res.supported ? 'Support added.' : 'Support removed.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSupportLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !user) return;
    setSubmittingComment(true);
    try {
      const res = await apiFetch<{ comment: ReportComment }>(`/api/reports/${report.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText }),
      });
      setComments((prev) => [...prev, res.comment]);
      setCommentText('');
      showToast('Comment posted.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagTarget || !user) return;
    setFlagSubmitting(true);
    try {
      await apiFetch('/api/content-reports', {
        method: 'POST',
        body: JSON.stringify({
          targetType: flagTarget.type,
          targetId: flagTarget.id,
          reason: flagReason,
        }),
      });
      setFlagTarget(null);
      setFlagReason('');
      showToast('Thank you. Your safety report has been sent to जनConnect moderators.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setFlagSubmitting(false);
    }
  };

  const piiWarnings = detectPotentialPiiHints(commentText);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F2942] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Explore</span>
        </Link>

        {loading && <LoadingSkeleton rows={2} />}

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
            <p className="font-semibold">Unable to display report</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {report && (
          <>
            <article className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
                  <span className="font-semibold text-[#0F2942]">{report.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Published{' '}
                    {new Date(report.published_at || report.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span aria-hidden="true">·</span>
                  <StatusLabel status={report.platform_status} />
                </div>

                {user && (
                  <button
                    type="button"
                    onClick={() => setFlagTarget({ type: 'complaint', id: report.id })}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#4B5563] hover:text-red-700"
                  >
                    <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Report content</span>
                  </button>
                )}
              </div>

              <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">{report.title}</h1>

              <div className="mt-3 flex items-center gap-2 text-sm text-[#4B5563]">
                <MapPin className="w-4 h-4 text-[#0D7A6F] shrink-0" aria-hidden="true" />
                <span>{report.generalized_location}</span>
              </div>

              <p className="mt-5 whitespace-pre-line text-base text-[#1F2937] leading-relaxed">
                {report.description}
              </p>

              {report.urgency_note && (
                <div className="mt-4 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3 text-sm text-[#374151]">
                  <strong className="font-semibold text-[#0F2942]">Accessibility / Safety Context:</strong>{' '}
                  {report.urgency_note}
                </div>
              )}

              {report.media.length > 0 && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {report.media.map((m) => (
                    <div key={m.id} className="rounded-lg overflow-hidden border border-[#E2E6EC] bg-[#F7F6F2]">
                      {m.media_type.startsWith('video/') ? (
                        <video controls src={m.url} className="w-full max-h-72 bg-black" />
                      ) : (
                        <img
                          src={m.url}
                          alt={`Approved community evidence for ${report.title}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-60 object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-5 border-t border-[#E2E6EC] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={supportLoading}
                    onClick={handleSupport}
                    aria-pressed={report.user_has_supported}
                    className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      report.user_has_supported
                        ? 'border-[#0D7A6F] bg-[#0D7A6F] text-white'
                        : 'border-[#E2E6EC] bg-white text-[#0F2942] hover:bg-[#F7F6F2]'
                    }`}
                  >
                    <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                    <span>{report.user_has_supported ? 'Supported' : 'Support this Report'}</span>
                    <span className="font-mono tabular-nums">({report.support_count})</span>
                  </button>
                  <span className="text-xs text-[#6B7280]">Supporter identities are kept private.</span>
                </div>
              </div>
            </article>

            {/* Status Timeline */}
            {history.length > 0 && (
              <section className="rounded-xl border border-[#E2E6EC] bg-white p-6">
                <h2 className="font-display text-base font-semibold text-[#0F2942]">जनConnect Platform Timeline</h2>
                <ol className="mt-4 space-y-3 border-t border-[#E2E6EC] pt-4">
                  {history.map((h) => (
                    <li key={h.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
                      <div>
                        <StatusLabel status={h.new_status} />
                        {h.reason && <p className="mt-0.5 text-xs text-[#4B5563]">{h.reason}</p>}
                      </div>
                      <span className="font-mono text-xs text-[#6B7280] tabular-nums">
                        {new Date(h.created_at).toLocaleString('en-IN')}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* Community Discussion */}
            <section id="comments" className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-[#0F2942] inline-flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                  <span>Community Comments ({comments.length})</span>
                </h2>
              </div>

              {user ? (
                <form onSubmit={handleAddComment} className="space-y-3">
                  <label htmlFor="comment-input" className="block text-xs font-medium text-[#374151]">
                    Add constructive local context (no personal phone numbers or private information)
                  </label>
                  <textarea
                    id="comment-input"
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Share factual observations or updates about this location..."
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm text-[#111827]"
                    required
                  />
                  {piiWarnings.length > 0 && (
                    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {piiWarnings.join(' ')}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submittingComment || commentText.trim().length < 2}
                      className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-medium text-white hover:bg-[#163A5C] disabled:opacity-60"
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3 text-sm text-[#374151]">
                  <Link to="/login" className="font-semibold text-[#0F2942] underline">
                    Sign in
                  </Link>{' '}
                  to post a comment or support this report.
                </div>
              )}

              {comments.length === 0 ? (
                <p className="text-sm text-[#6B7280] py-2">No community comments yet.</p>
              ) : (
                <ul className="divide-y divide-[#E2E6EC]">
                  {comments.map((c) => (
                    <li key={c.id} className="py-4">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#4B5563]">
                        <div>
                          <Link
                            to={`/profile/${c.author_username}`}
                            className="font-semibold text-[#0F2942] hover:underline"
                          >
                            {c.author_display_name}
                          </Link>{' '}
                          <span className="text-[#6B7280]">@{c.author_username}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{new Date(c.created_at).toLocaleString('en-IN')}</span>
                        </div>
                        {user && (
                          <button
                            type="button"
                            onClick={() => setFlagTarget({ type: 'comment', id: c.id })}
                            className="text-xs text-[#6B7280] hover:text-red-700"
                          >
                            Report
                          </button>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm text-[#1F2937] leading-relaxed">{c.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Flag / Report Content Form Modal */}
            {flagTarget && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
                <form
                  onSubmit={handleSubmitFlag}
                  className="w-full max-w-md rounded-xl border border-[#E2E6EC] bg-white p-6 shadow-xl space-y-4"
                >
                  <h3 className="font-display text-lg font-semibold text-[#0F2942]">Report Unsafe or Inappropriate Content</h3>
                  <p className="text-xs text-[#4B5563]">
                    Explain why this {flagTarget.type} violates community or privacy guidelines (e.g., personal phone
                    number, harassment, spam).
                  </p>
                  <textarea
                    rows={3}
                    required
                    minLength={5}
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Describe the concern..."
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setFlagTarget(null)}
                      className="rounded-lg border border-[#E2E6EC] px-4 py-2 text-sm text-[#374151]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={flagSubmitting}
                      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
                    >
                      {flagSubmitting ? 'Sending...' : 'Submit Safety Flag'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            <IndependentNotice compact />
          </>
        )}
      </div>
    </AppShell>
  );
}
