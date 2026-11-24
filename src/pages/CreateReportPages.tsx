import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Upload, X, Shield, CheckCircle2, ArrowLeft, MapPin } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { LocationSelector } from '../components/locations/LocationSelector';
import { GoogleMapPinPicker } from '../components/maps/GoogleMapPinPicker';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { useAuth } from '../context/AuthContext';
import { useReportDraft } from '../context/ReportDraftContext';
import { useToast } from '../context/ToastContext';
import { uploadFormDataWithProgress } from '../services/api';
import {
  formatFileSizeLabel,
  MAX_ATTACHMENT_MB,
  REPORT_CATEGORIES,
  validateAttachmentMetadata,
  validateReportDraft,
} from '../utils/civicRules';

export function CreateReportPage() {
  const { user } = useAuth();
  const { draft, setDraft } = useReportDraft();
  const navigate = useNavigate();

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const validation = validateReportDraft({
    title: draft.title,
    description: draft.description,
    category: draft.category,
    stateId: draft.stateId,
    districtId: draft.districtId,
    blockId: draft.blockId,
    localityId: draft.localityId,
    approximateLat: draft.approximateLat ? Number(draft.approximateLat) : null,
    approximateLng: draft.approximateLng ? Number(draft.approximateLng) : null,
  });

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const incoming = Array.from(e.target.files || []);
    if (draft.files.length + incoming.length > 3) {
      setFileError('You can attach at most 3 files per report.');
      return;
    }
    for (const file of incoming) {
      const err = validateAttachmentMetadata({ size: file.size, mimeType: file.type });
      if (err) {
        setFileError(`${file.name}: ${err}`);
        return;
      }
    }
    setDraft((prev) => ({ ...prev, files: [...prev.files, ...incoming] }));
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const handleContinuePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    setErrors({});
    navigate('/reports/preview');
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">Report a Civic Problem</h1>
          <p className="mt-1 text-sm text-[#4B5563]">
            Step 1 of 2: Enter location, category, and public-safe details. New reports are private until reviewed.
          </p>
        </div>

        {user && user.identity_status !== 'verified' && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 space-y-2">
            <p className="font-semibold">National ID Verification Required Before Submission</p>
            <p className="text-xs leading-relaxed">
              Your account status is currently <strong className="capitalize">{user.identity_status}</strong>. Complete
              National ID verification before submitting civic reports.
            </p>
            <Link
              to="/verify-identity"
              className="inline-block rounded-lg bg-[#0F2942] px-3.5 py-2 text-xs font-semibold text-white"
            >
              Verify National ID
            </Link>
          </div>
        )}

        <form onSubmit={handleContinuePreview} className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-6">
          {/* Privacy reminder */}
          <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4 flex items-start gap-3 text-xs text-[#374151]">
            <Shield className="w-4 h-4 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <strong className="font-semibold text-[#0F2942]">Privacy Reminder:</strong> Never include personal phone
              numbers, Aadhaar numbers, home addresses, or minors’ identities. EXIF/GPS tags are stripped from photos on
              upload.
            </div>
          </div>

          <div>
            <label htmlFor="rep-title" className="block text-xs font-medium text-[#374151] mb-1">
              Report Title * (8–140 characters)
            </label>
            <input
              id="rep-title"
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="e.g., Damaged stormwater culvert near Rajpur Road bus stop"
              className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
            />
            {errors.title && <p className="mt-1 text-xs text-red-700">{errors.title}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="rep-category" className="block text-xs font-medium text-[#374151] mb-1">
                Category *
              </label>
              <select
                id="rep-category"
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm"
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-700">{errors.category}</p>}
            </div>

            <div>
              <label htmlFor="rep-urgency" className="block text-xs font-medium text-[#374151] mb-1">
                Accessibility or Safety Note (optional)
              </label>
              <input
                id="rep-urgency"
                type="text"
                value={draft.urgencyNote}
                onChange={(e) => setDraft({ ...draft, urgencyNote: e.target.value })}
                placeholder="e.g., Blocks wheelchair/school crossing"
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rep-desc" className="block text-xs font-medium text-[#374151] mb-1">
              Detailed Description * (20–3000 characters)
            </label>
            <textarea
              id="rep-desc"
              rows={5}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Describe the public infrastructure issue, how long it has persisted, and nearby public landmarks..."
              className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
            />
            {errors.description && <p className="mt-1 text-xs text-red-700">{errors.description}</p>}
            {validation.piiWarnings.length > 0 && (
              <div role="alert" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {validation.piiWarnings.join(' ')}
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-[#E2E6EC] space-y-3">
            <p className="text-xs font-semibold text-[#0F2942]">Location in Uttarakhand (Generalized publicly)</p>
            <LocationSelector
              stateId={draft.stateId}
              districtId={draft.districtId}
              blockId={draft.blockId}
              localityId={draft.localityId}
              required
              onChange={(next) =>
                setDraft((prev) => ({
                  ...prev,
                  stateId: next.stateId,
                  districtId: next.districtId,
                  blockId: next.blockId,
                  localityId: next.localityId,
                  generalizedLocationLabel: next.generalizedLabel,
                  suggestedMapCenter: next.suggestedCenter ?? prev.suggestedMapCenter,
                }))
              }
            />
            {(errors.districtId || errors.blockId || errors.localityId) && (
              <p className="text-xs text-red-700">
                {errors.districtId || errors.blockId || errors.localityId}
              </p>
            )}

            <GoogleMapPinPicker
              lat={draft.approximateLat}
              lng={draft.approximateLng}
              suggestedCenter={draft.suggestedMapCenter}
              onChange={(approximateLat, approximateLng) =>
                setDraft((prev) => ({ ...prev, approximateLat, approximateLng }))
              }
              error={errors.coordinates}
            />
          </div>

          <div className="pt-2 border-t border-[#E2E6EC] space-y-3">
            <label htmlFor="rep-files" className="block text-xs font-semibold text-[#0F2942]">
              Optional Photo or Video Attachments (max 3 files, up to {MAX_ATTACHMENT_MB} MB each · JPEG, PNG, WebP, MP4)
            </label>
            <label
              htmlFor="rep-files"
              className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F7F6F2] px-4 py-6 text-center cursor-pointer hover:border-[#0D7A6F]"
            >
              <Upload className="w-5 h-5 text-[#0F2942] mb-1.5" aria-hidden="true" />
              <span className="text-xs font-medium text-[#0F2942]">Choose photo or video evidence</span>
              <span className="text-xs text-[#6B7280] mt-0.5">EXIF metadata is stripped automatically</span>
              <input
                id="rep-files"
                type="file"
                accept="image/jpeg,image/png,image/webp,video/mp4"
                multiple
                onChange={handleFileAdd}
                className="sr-only"
              />
            </label>
            {fileError && <p className="text-xs text-red-700">{fileError}</p>}
            {draft.files.length > 0 && (
              <ul className="space-y-2">
                {draft.files.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-[#E2E6EC] px-3 py-2 text-xs"
                  >
                    <span className="truncate font-medium text-[#111827]">
                      {file.name} ({formatFileSizeLabel(file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      aria-label={`Remove ${file.name}`}
                      className="text-red-700 hover:underline inline-flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-4 border-t border-[#E2E6EC] flex items-center justify-end gap-3">
            <button
              type="submit"
              className="rounded-lg bg-[#0F2942] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#163A5C]"
            >
              Preview Report
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

export function PreviewReportPage() {
  const { draft, resetDraft } = useReportDraft();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [uploadPct, setUploadPct] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!draft.title || !draft.localityId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl px-4 py-12 text-center space-y-4">
          <p className="text-sm text-[#4B5563]">No report draft found to preview.</p>
          <Link to="/reports/create" className="inline-block rounded-lg bg-[#0F2942] px-4 py-2 text-sm text-white">
            Start a New Report
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleSubmitFinal = async () => {
    setError(null);
    setSubmitting(true);
    setUploadPct(5);
    try {
      const fd = new FormData();
      fd.append('title', draft.title);
      fd.append('description', draft.description);
      fd.append('category', draft.category);
      fd.append('stateId', draft.stateId);
      fd.append('districtId', draft.districtId);
      fd.append('blockId', draft.blockId);
      fd.append('localityId', draft.localityId);
      if (draft.approximateLat) fd.append('approximateLat', draft.approximateLat);
      if (draft.approximateLng) fd.append('approximateLng', draft.approximateLng);
      if (draft.urgencyNote) fd.append('urgencyNote', draft.urgencyNote);
      for (const file of draft.files) {
        fd.append('attachments', file);
      }

      const res = await uploadFormDataWithProgress<{ id: string }>('/api/reports', fd, (pct) => {
        setUploadPct(pct);
      });
      showToast('Report submitted to private moderation queue.', 'success');
      navigate(`/reports/submitted/${res.id}`, { replace: true });
      window.setTimeout(() => resetDraft(), 50);
    } catch (err) {
      setError((err as Error).message);
      setUploadPct(0);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <Link to="/reports/create" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0F2942] hover:underline">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Edit Report Details</span>
        </Link>

        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-5">
          <div>
            <p className="text-xs font-semibold text-[#0D7A6F]">Step 2 of 2 · Preview Before Submission</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-[#0F2942]">{draft.title}</h1>
            <p className="mt-1 text-xs text-[#4B5563]">
              {draft.category} · {draft.generalizedLocationLabel}
            </p>
          </div>

          <p className="whitespace-pre-line text-sm text-[#1F2937] leading-relaxed">{draft.description}</p>

          {draft.urgencyNote && (
            <p className="text-xs text-[#374151]">
              <strong>Safety / Accessibility Note:</strong> {draft.urgencyNote}
            </p>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-3 py-2.5 text-xs text-[#374151]">
            <MapPin className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
            {draft.approximateLat && draft.approximateLng ? (
              <span>
                <strong className="text-[#0F2942]">Google Maps pin attached:</strong>{' '}
                <span className="font-mono text-[#0F2942]">
                  {draft.approximateLat}, {draft.approximateLng}
                </span>{' '}
                (restricted to moderators; never shown publicly).
              </span>
            ) : (
              <span>
                <strong className="text-[#0F2942]">Map pin:</strong> Not attached (optional — report uses generalized
                locality only).
              </span>
            )}
          </div>

          {draft.files.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[#0F2942] mb-2">
                Attachments ({draft.files.length}) — stored privately until moderator review
              </p>
              <ul className="list-disc pl-5 text-xs text-[#4B5563] space-y-1">
                {draft.files.map((f, i) => (
                  <li key={i}>{f.name}</li>
                ))}
              </ul>
            </div>
          )}

          <IndependentNotice compact />

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {submitting && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#374151]">
                <span>Uploading securely...</span>
                <span className="font-mono tabular-nums">{uploadPct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-[#0D7A6F] transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E2E6EC]">
            <Link
              to="/reports/create"
              className="rounded-lg border border-[#E2E6EC] px-4 py-2 text-sm font-medium text-[#374151]"
            >
              Back to Edit
            </Link>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmitFinal}
              className="rounded-lg bg-[#0D7A6F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A] disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Confirm & Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export function ReportSubmittedPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0D7A6F]/10 text-[#0D7A6F]">
            <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Report Submitted to Moderation Queue</h1>
          <p className="text-sm text-[#374151] leading-relaxed">
            Your report has been submitted to जनConnect. It will be reviewed before becoming publicly visible. This is
            not an official government complaint submission.
          </p>
          <p className="font-mono text-xs text-[#6B7280]">Reference ID: {id}</p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <Link
              to="/my-reports"
              className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163A5C]"
            >
              Track in My Reports
            </Link>
            <Link
              to="/explore"
              className="rounded-lg border border-[#E2E6EC] px-4 py-2 text-sm font-medium text-[#0F2942]"
            >
              Explore Public Reports
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
