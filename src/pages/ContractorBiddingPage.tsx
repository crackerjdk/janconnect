import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, MapPin, Search, ThumbsUp, ArrowRight } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { PaymentSplitTransparency } from '../components/gov/PaymentSplitTransparency';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { LocationNode, MyContractorBid, PublicReportSummary } from '../types/civic';
import { BID_STATUS_LABELS, REPORT_CATEGORIES, formatInrCurrency } from '../utils/civicRules';

export function ContractorBiddingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'works' | 'my-bids'>('works');
  const [works, setWorks] = useState<PublicReportSummary[]>([]);
  const [myBids, setMyBids] = useState<MyContractorBid[]>([]);
  const [districts, setDistricts] = useState<LocationNode[]>([]);
  const [stats, setStats] = useState({ openWorksCount: 0, totalActiveBids: 0, awardedWorksCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [category, setCategory] = useState('all');
  const [bidState, setBidState] = useState<'all' | 'open' | 'awarded'>('all');

  useEffect(() => {
    apiFetch<{ locations: LocationNode[] }>('/api/locations?type=district&state_code=UK')
      .then((res) => setDistricts(res.locations))
      .catch(() => setDistricts([]));
  }, []);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'all') params.set('category', category);
      if (districtId) params.set('district_id', districtId);
      if (bidState !== 'all') params.set('bid_state', bidState);

      const res = await apiFetch<{
        works: PublicReportSummary[];
        stats: { openWorksCount: number; totalActiveBids: number; awardedWorksCount: number };
      }>(`/api/contractors/works?${params.toString()}`);

      setWorks(res.works);
      setStats(res.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, category, districtId, bidState]);

  const loadMyBids = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ bids: MyContractorBid[] }>('/api/contractors/my-bids');
      setMyBids(res.bids);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'works') {
      void loadWorks();
    } else {
      void loadMyBids();
    }
  }, [tab, loadWorks, loadMyBids]);

  const bidToneClass = (tone: 'neutral' | 'amber' | 'teal' | 'crimson') => {
    switch (tone) {
      case 'teal':
        return 'text-[#0D7A6F]';
      case 'amber':
        return 'text-amber-800';
      case 'crimson':
        return 'text-red-700';
      default:
        return 'text-[#4B5563]';
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold text-[#0D7A6F] inline-flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" aria-hidden="true" />
                <span>जनConnect Contractor Work Board</span>
              </p>
              <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">
                Contractor Work Bidding & Repair Quotations
              </h1>
              <p className="mt-2 text-sm text-[#4B5563] leading-relaxed">
                Verified civil contractors and local repair agencies can review published Uttarakhand civic problems,
                submit transparent cost and completion timeline quotations, and track shortlist or award decisions.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3">
                <p className="text-xs text-[#4B5563]">Open Works</p>
                <p className="mt-0.5 font-mono text-xl font-bold text-[#0F2942] tabular-nums">{stats.openWorksCount}</p>
              </div>
              <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3">
                <p className="text-xs text-[#4B5563]">Active Bids</p>
                <p className="mt-0.5 font-mono text-xl font-bold text-[#0D7A6F] tabular-nums">
                  {stats.totalActiveBids}
                </p>
              </div>
              <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-4 py-3">
                <p className="text-xs text-[#4B5563]">Awarded</p>
                <p className="mt-0.5 font-mono text-xl font-bold text-[#0F2942] tabular-nums">
                  {stats.awardedWorksCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-[#E2E6EC] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('works')}
                className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                  tab === 'works'
                    ? 'bg-[#0F2942] text-white'
                    : 'border border-[#E2E6EC] bg-white text-[#374151] hover:bg-[#F7F6F2]'
                }`}
              >
                Open Reported Works
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => setTab('my-bids')}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                    tab === 'my-bids'
                      ? 'bg-[#0F2942] text-white'
                      : 'border border-[#E2E6EC] bg-white text-[#374151] hover:bg-[#F7F6F2]'
                  }`}
                >
                  My Submitted Bids
                </button>
              )}
            </div>

            {!user && (
              <p className="text-xs text-[#4B5563]">
                Want to place a quotation?{' '}
                <Link to="/login" className="font-semibold text-[#0D7A6F] underline">
                  Sign in
                </Link>{' '}
                or{' '}
                <Link to="/signup" className="font-semibold text-[#0F2942] underline">
                  register as a contractor/citizen
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {tab === 'works' && (
          <>
            {/* Filters */}
            <div className="rounded-xl border border-[#E2E6EC] bg-white p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  role="searchbox"
                  aria-label="Search open works"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search road, water, culvert, village..."
                  className="w-full rounded-lg border border-[#E2E6EC] pl-9 pr-3 py-2 text-sm text-[#111827]"
                />
              </div>

              <select
                aria-label="Filter by Uttarakhand district"
                value={districtId}
                onChange={(e) => setDistrictId(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="">All 13 Uttarakhand Districts</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="all">All Civic Categories</option>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by bidding status"
                value={bidState}
                onChange={(e) => setBidState(e.target.value as 'all' | 'open' | 'awarded')}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="all">All Published Works</option>
                <option value="open">Open for Contractor Bids</option>
                <option value="awarded">Work Awarded</option>
              </select>
            </div>

            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : error ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
                {error}
              </div>
            ) : works.length === 0 ? (
              <EmptyState
                title="No matching reported works available for bidding"
                description="Published civic problems appear here automatically once moderators review and publish citizen reports."
                actionLabel="Browse Explore Feed"
                actionTo="/explore"
              />
            ) : (
              <div className="space-y-4">
                {works.map((w) => {
                  const isAwarded = Boolean(w.awarded_bid_id);
                  const bidCount = w.bid_count ?? 0;
                  return (
                    <article
                      key={w.id}
                      className="rounded-xl border border-[#E2E6EC] bg-white p-5 transition-colors hover:border-[#CBD5E1]"
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#4B5563]">
                            <span className="font-semibold text-[#0F2942]">{w.category}</span>
                            <span aria-hidden="true">·</span>
                            <span className={isAwarded ? 'font-semibold text-[#0D7A6F]' : 'font-semibold text-amber-800'}>
                              {isAwarded ? 'Contractor Selected' : 'Open for Contractor Bids'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(w.published_at || w.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          <h2 className="mt-2 font-display text-lg font-semibold text-[#0F2942]">
                            <Link to={`/reports/${w.id}#bidding`} className="hover:underline">
                              {w.title}
                            </Link>
                          </h2>

                          <p className="mt-1.5 text-sm text-[#374151] leading-relaxed line-clamp-2">{w.description}</p>

                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#4B5563]">
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0" aria-hidden="true" />
                              <span>{w.generalized_location}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <ThumbsUp className="w-3.5 h-3.5 text-[#6B7280]" aria-hidden="true" />
                              <span>{w.support_count} citizen support</span>
                            </span>
                          </div>

                          {w.awarded_payment_breakdown && (
                            <div className="mt-3">
                              <PaymentSplitTransparency
                                breakdown={w.awarded_payment_breakdown}
                                compact
                                showLedger={false}
                              />
                            </div>
                          )}
                        </div>

                        <div className="md:w-64 shrink-0 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#4B5563]">Submitted Bids</span>
                            <span className="font-mono font-semibold text-[#0F2942] tabular-nums">{bidCount}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#4B5563]">Lowest Quote</span>
                            <span className="font-mono font-semibold text-[#0D7A6F] tabular-nums">
                              {w.lowest_bid_inr != null ? formatInrCurrency(w.lowest_bid_inr) : 'No quotes yet'}
                            </span>
                          </div>
                          <div className="pt-2 border-t border-[#E2E6EC] text-xs">
                            <span className="text-[#4B5563] block">Budget Funded By</span>
                            <span className="mt-0.5 block font-semibold text-[#0F2942]">
                              {isAwarded
                                ? w.awarded_budget_funded_by || 'Pending Party / Public Attribution'
                                : bidCount > 0
                                ? 'Pending Award / Party Attribution'
                                : 'Open for Bid & Funding'}
                            </span>
                          </div>
                          <Link
                            to={`/reports/${w.id}#bidding`}
                            className={`mt-1 w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                              isAwarded
                                ? 'border border-[#E2E6EC] bg-white text-[#0F2942] hover:bg-gray-50'
                                : 'bg-[#0D7A6F] text-white hover:bg-[#0A635A]'
                            }`}
                          >
                            {isAwarded ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>View Awarded Bid</span>
                              </>
                            ) : (
                              <>
                                <span>{bidCount > 0 ? 'Compare & Bid' : 'Submit First Bid'}</span>
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                              </>
                            )}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'my-bids' && user && (
          <section className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
            <h2 className="font-display text-lg font-semibold text-[#0F2942]">My Contractor Quotations</h2>
            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : myBids.length === 0 ? (
              <EmptyState
                title="You have not submitted any contractor bids yet"
                description="Browse Open Reported Works and submit a transparent quotation on any active civic report."
                actionLabel="View Open Works"
                onAction={() => setTab('works')}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E6EC] text-xs text-[#4B5563]">
                      <th className="py-2.5 pr-4 font-medium">Reported Work</th>
                      <th className="py-2.5 pr-4 font-medium">Firm & Reg.</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Quote (₹)</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Timeline</th>
                      <th className="py-2.5 pr-4 font-medium">Status</th>
                      <th className="py-2.5 font-medium text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E6EC]">
                    {myBids.map((b) => {
                      const pres = BID_STATUS_LABELS[b.bid_status];
                      return (
                        <tr key={b.id} className="hover:bg-[#F7F6F2]/60">
                          <td className="py-3 pr-4">
                            <Link to={`/reports/${b.complaint_id}#bidding`} className="font-medium text-[#0F2942] hover:underline">
                              {b.report_title}
                            </Link>
                            <p className="text-xs text-[#6B7280]">
                              {b.report_category} · {b.generalized_location}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            <p className="font-medium text-[#111827]">{b.company_name}</p>
                            <p className="font-mono text-[#6B7280]">{b.registration_number}</p>
                          </td>
                          <td className="py-3 pr-4 text-right font-mono font-semibold text-[#0F2942] tabular-nums whitespace-nowrap">
                            {formatInrCurrency(b.bid_amount_inr)}
                            <span className="mt-1 block font-sans text-[11px] font-normal text-[#4B5563] whitespace-normal">
                              Budget funded by{' '}
                              <strong className="font-medium text-[#0F2942]">
                                {b.budget_funded_by || 'Pending Attribution'}
                              </strong>
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-right font-mono text-xs text-[#374151] tabular-nums whitespace-nowrap">
                            {b.estimated_days}d · {b.warranty_months}m warr.
                          </td>
                          <td className="py-3 pr-4 text-xs">
                            <span className={`font-semibold ${bidToneClass(pres.tone)}`}>{pres.label}</span>
                            {b.reviewer_note && <p className="text-[11px] text-[#6B7280] mt-0.5">{b.reviewer_note}</p>}
                          </td>
                          <td className="py-3 text-right whitespace-nowrap">
                            <Link
                              to={`/reports/${b.complaint_id}#bidding`}
                              className="text-xs font-semibold text-[#0D7A6F] hover:underline"
                            >
                              Open →
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

        <IndependentNotice compact />
      </div>
    </AppShell>
  );
}
