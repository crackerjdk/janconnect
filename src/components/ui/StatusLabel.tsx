import { CheckCircle2, Clock, AlertCircle, XCircle, EyeOff } from 'lucide-react';
import { STATUS_LABELS, type PlatformStatus } from '../../utils/civicRules';

export function StatusLabel({ status }: { status: PlatformStatus }) {
  const info = STATUS_LABELS[status] || STATUS_LABELS.submitted;

  const toneClass =
    info.tone === 'teal'
      ? 'text-[#0D7A6F]'
      : info.tone === 'amber'
      ? 'text-amber-800'
      : info.tone === 'crimson'
      ? 'text-red-700'
      : 'text-[#374151]';

  const Icon =
    status === 'published'
      ? CheckCircle2
      : status === 'under_review' || status === 'additional_information_required'
      ? AlertCircle
      : status === 'rejected'
      ? XCircle
      : status === 'removed'
      ? EyeOff
      : Clock;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${toneClass}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{info.label}</span>
    </span>
  );
}
