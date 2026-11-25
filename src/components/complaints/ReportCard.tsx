import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ThumbsUp, MessageSquare, MapPin, Image as ImageIcon, Briefcase } from 'lucide-react';
import type { PublicReportSummary } from '../../types/civic';
import { formatInrCurrency } from '../../utils/civicRules';
import { StatusLabel } from '../ui/StatusLabel';

interface ReportCardProps {
  report: PublicReportSummary;
  onToggleSupport?: (reportId: string, currentlySupported: boolean) => void;
  supportPending?: boolean;
}

export function ReportCard({ report, onToggleSupport, supportPending }: ReportCardProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const dateStr = report.published_at
    ? new Date(report.published_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date(report.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

  const bidCount = report.bid_count ?? 0;

  return (
    <article className="rounded-xl border border-[#E2E6EC] bg-white p-5 transition-colors hover:border-[#CBD5E1]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1 min-w-0">
          {/* Unboxed metadata line per zero-pill discipline */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B5563]">
            <span className="font-medium text-[#0F2942]">{report.category}</span>
            <span aria-hidden="true">·</span>
            <span>{dateStr}</span>
            <span aria-hidden="true">·</span>
            <StatusLabel status={report.platform_status} />
          </div>

          <h3 className="mt-2 font-display text-lg font-semibold text-[#0F2942] leading-snug">
            <Link to={`/reports/${report.id}`} className="hover:underline">
              {report.title}
            </Link>
          </h3>

          <p className="mt-2 text-sm text-[#374151] leading-relaxed line-clamp-2">{report.description}</p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#4B5563]">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0" aria-hidden="true" />
              <span>{report.generalized_location}</span>
            </span>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E6EC] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              {onToggleSupport ? (
                <button
                  type="button"
                  disabled={supportPending}
                  onClick={() => onToggleSupport(report.id, report.user_has_supported)}
                  aria-pressed={report.user_has_supported}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    report.user_has_supported
                      ? 'border-[#0D7A6F] bg-[#0D7A6F] text-white'
                      : 'border-[#E2E6EC] bg-white text-[#111827] hover:bg-[#F7F6F2]'
                  }`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{report.user_has_supported ? 'Supported' : 'Support'}</span>
                  <span className="font-mono tabular-nums">({report.support_count})</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-[#4B5563]">
                  <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="font-mono tabular-nums">{report.support_count}</span>
                  <span>support</span>
                </span>
              )}

              <Link
                to={`/reports/${report.id}#comments`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4B5563] hover:text-[#0F2942] whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="font-mono tabular-nums">{report.comment_count}</span>
                <span>comments</span>
              </Link>

              <Link
                to={`/reports/${report.id}#bidding`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D7A6F] hover:text-[#0F2942] whitespace-nowrap"
              >
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                {bidCount > 0 ? (
                  <span>
                    <span className="font-mono tabular-nums">{bidCount}</span> {bidCount === 1 ? 'bid' : 'bids'}
                    {report.lowest_bid_inr != null ? ` · Low ${formatInrCurrency(report.lowest_bid_inr)}` : ''}
                  </span>
                ) : (
                  <span>Bid for work</span>
                )}
              </Link>
            </div>

            <Link
              to={`/reports/${report.id}`}
              className="text-xs font-semibold text-[#0F2942] hover:text-[#0D7A6F] whitespace-nowrap"
            >
              Read full report →
            </Link>
          </div>
        </div>

        {report.preview_media_url && report.preview_media_type?.startsWith('image/') && (
          <div className="sm:w-40 sm:h-28 w-full h-44 shrink-0 rounded-lg overflow-hidden border border-[#E2E6EC] bg-[#F0EFEA]">
            {!imgFailed ? (
              <img
                src={report.preview_media_url}
                alt={`Approved evidence attachment for ${report.title}`}
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#6B7280] text-xs p-2 text-center">
                <ImageIcon className="w-5 h-5 mb-1" aria-hidden="true" />
                <span>Media unavailable</span>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
