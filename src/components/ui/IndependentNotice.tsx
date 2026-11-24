import { Info } from 'lucide-react';

export function IndependentNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      role="note"
      className={`rounded-lg border border-[#E2E6EC] bg-[#F0EFEA] text-[#374151] ${
        compact ? 'px-4 py-3 text-xs' : 'px-5 py-4 text-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        <Info className="w-4 h-4 text-[#0F2942] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="font-semibold text-[#0F2942]">Independent Platform Notice:</strong> जनConnect is an
          independent civic visibility platform, not an official government portal. Submitting a report on जनConnect
          does not automatically file an official government grievance or guarantee departmental action.
        </p>
      </div>
    </div>
  );
}
