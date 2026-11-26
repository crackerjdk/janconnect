import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Building2, CheckCircle2, MapPin, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { PaymentSplitTransparency } from './PaymentSplitTransparency';
import type { PinnedWorkDoneItem } from '../../types/gov';
import { formatInrCurrency } from '../../utils/civicRules';

interface PinnedWorkDoneSectionProps {
  id?: string;
  compact?: boolean;
}

export function PinnedWorkDoneSection({ id = 'work-done', compact = false }: PinnedWorkDoneSectionProps) {
  const [works, setWorks] = useState<PinnedWorkDoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedImgs, setFailedImgs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    apiFetch<{ works: PinnedWorkDoneItem[] }>('/api/public/pinned-works')
      .then((res) => {
        if (active) setWorks(res.works || []);
      })
      .catch(() => {
        if (active) setWorks([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const gridClass = compact ? 'mt-5 grid gap-5 md:grid-cols-2' : 'mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3';

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={compact ? 'space-y-4' : 'border-b border-[#E2E6EC] bg-[#FAF9F6]'}
    >
      <div className={compact ? '' : 'mx-auto max-w-6xl px-4 py-12 sm:px-6'}>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-[#0D7A6F] inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Verified Work Done · Pinned by जनConnect Team</span>
            </p>
            <h2
              id={`${id}-heading`}
              className={`mt-1 font-display font-bold text-[#0F2942] [text-wrap:balance] ${
                compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
              }`}
            >
              Top Completed Civic Works
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#4B5563]">
              Officially completed, before-and-after verified infrastructure works featured by the जनConnect moderation
              team alongside sanctioned bid budgets and funding attribution.
            </p>
          </div>
          <Link
            to="/projects?status=completed"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0D7A6F] hover:underline whitespace-nowrap shrink-0"
          >
            <span>View all completed projects</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className={gridClass}>
            {[1, 2].map((n) => (
              <div key={n} className="h-52 rounded-xl border border-[#E2E6EC] bg-white p-5 animate-pulse" />
            ))}
          </div>
        ) : works.length === 0 ? (
          <div className="mt-5 rounded-xl border border-[#E2E6EC] bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <p className="font-display text-base font-semibold text-[#0F2942]">
                No completed works pinned by the जनConnect team yet
              </p>
              <p className="text-xs sm:text-sm text-[#4B5563]">
                Once a reported infrastructure problem is sanctioned, completed by a verified contractor, and pinned by
                the जनConnect team, it appears right here next to Report a Problem.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/projects"
                className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-2 text-xs font-semibold text-[#0F2942] hover:bg-white whitespace-nowrap"
              >
                Explore Projects
              </Link>
              <Link
                to="/contractors"
                className="rounded-lg bg-[#0D7A6F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] whitespace-nowrap"
              >
                Contractor Bids
              </Link>
            </div>
          </div>
        ) : (
          <div className={gridClass}>
            {works.map((w, idx) => {
              const rank = w.pinned_rank ?? idx + 1;
              const bidBudget = w.awarded_amount_inr ?? w.sanctioned_budget_inr;
              const afterKey = `after:${w.id}`;
              return (
                <article
                  key={w.id}
                  className="rounded-xl border border-[#E2E6EC] bg-white p-5 flex flex-col justify-between gap-4 hover:border-[#0D7A6F]/50 transition-colors"
                >
                  <div className="space-y-3">
                    {/* Unboxed metadata line per zero-pill discipline */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#4B5563]">
                      <span className="font-mono font-semibold text-[#0D7A6F] tabular-nums">
                        #{rank} Pinned Work · {w.project_code}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#0D7A6F]">
                        <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Verified Complete</span>
                      </span>
                    </div>

                    {w.after_media_url && !failedImgs[afterKey] && (
                      <div className="h-36 w-full rounded-lg overflow-hidden bg-[#F7F6F2]">
                        <img
                          src={w.after_media_url}
                          alt={`Completed infrastructure photograph for ${w.title}`}
                          referrerPolicy="no-referrer"
                          onError={() => setFailedImgs((prev) => ({ ...prev, [afterKey]: true }))}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div>
                      <h3 className="font-display text-lg font-semibold text-[#0F2942] leading-snug">
                        <Link to={`/projects/${w.id}`} className="hover:underline">
                          {w.title}
                        </Link>
                      </h3>
                      <p className="mt-1 text-xs text-[#4B5563] flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>{w.department_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#0D7A6F] shrink-0" aria-hidden="true" />
                          <span>{w.generalized_location}</span>
                        </span>
                      </p>
                    </div>

                    {w.pinned_note ? (
                      <p className="text-xs text-[#374151] leading-relaxed">{w.pinned_note}</p>
                    ) : (
                      <p className="text-xs text-[#4B5563] leading-relaxed line-clamp-2">{w.description}</p>
                    )}

                    {/* Bid-funded budget & contractor */}
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#E2E6EC] text-xs">
                      <div>
                        <p className="text-[#6B7280]">Bid-Funded Budget</p>
                        <p className="mt-0.5 font-mono font-bold text-[#0F2942] tabular-nums">
                          {formatInrCurrency(bidBudget)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[#6B7280]">Completed On</p>
                        <p className="mt-0.5 font-mono font-semibold text-[#0D7A6F] tabular-nums">
                          {w.actual_completion_date || 'Verified'}
                        </p>
                      </div>
                    </div>

                    {w.awarded_contractor_name && (
                      <p className="text-xs text-[#374151] inline-flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#0F2942] shrink-0" aria-hidden="true" />
                        <span className="truncate">
                          Executed by <strong className="text-[#0F2942]">{w.awarded_contractor_name}</strong>
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Neutral Budget Funded By section on every bid-funded budget */}
                  <div className="space-y-3">
                    <div className="rounded-lg bg-[#F7F6F2] px-3 py-2 text-xs text-[#0F2942]">
                      <span className="text-[#4B5563]">Budget funded by </span>
                      <strong className="font-semibold">
                        {w.budget_funded_by || 'Government / Public Allocation (Party Not Specified)'}
                      </strong>
                    </div>

                    {w.payment_breakdown && (
                      <PaymentSplitTransparency breakdown={w.payment_breakdown} compact showLedger={false} />
                    )}

                    <div className="pt-2 border-t border-[#E2E6EC] flex items-center justify-between text-xs">
                      <Link
                        to={`/reports/${w.complaint_id}`}
                        className="text-[#4B5563] hover:text-[#0F2942] hover:underline"
                      >
                        Original Report
                      </Link>
                      <Link
                        to={`/projects/${w.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-[#0D7A6F] hover:underline whitespace-nowrap"
                      >
                        <span>Work Transparency</span>
                        <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
