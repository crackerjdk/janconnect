import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, List, Map as MapIcon, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ReportCard } from '../components/complaints/ReportCard';
import { LocationSelector } from '../components/locations/LocationSelector';
import { UttarakhandMapView } from '../components/maps/UttarakhandMapView';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { LocationNode, PublicReportSummary } from '../types/civic';
import { REPORT_CATEGORIES } from '../utils/civicRules';

export function ExplorePage() {
  const { user, health } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'all');
  const [sort, setSort] = useState<'newest' | 'most_supported'>(
    searchParams.get('sort') === 'most_supported' ? 'most_supported' : 'newest'
  );
  const [stateId, setStateId] = useState('uk-state');
  const [districtId, setDistrictId] = useState(searchParams.get('district') || '');
  const [blockId, setBlockId] = useState('');
  const [localityId, setLocalityId] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [page, setPage] = useState(1);

  const [reports, setReports] = useState<PublicReportSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [districts, setDistricts] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportingId, setSupportingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ locations: LocationNode[] }>('/api/locations?type=district&parent_id=uk-state')
      .then((res) => setDistricts(res.locations))
      .catch(() => setDistricts([]));
  }, []);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category !== 'all') params.set('category', category);
      if (stateId) params.set('state_id', stateId);
      if (districtId) params.set('district_id', districtId);
      if (blockId) params.set('block_id', blockId);
      if (localityId) params.set('locality_id', localityId);
      params.set('sort', sort);
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await apiFetch<{ reports: PublicReportSummary[]; total: number }>(
        `/api/reports/public?${params.toString()}`
      );
      setReports(res.reports);
      setTotal(res.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, category, stateId, districtId, blockId, localityId, sort, page]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handleToggleSupport = async (reportId: string, currentlySupported: boolean) => {
    if (!user) {
      showToast('Please sign in to support community reports.', 'info');
      return;
    }
    setSupportingId(reportId);
    try {
      const res = await apiFetch<{ supported: boolean; support_count: number }>(
        `/api/reports/${reportId}/support`,
        { method: currentlySupported ? 'DELETE' : 'POST' }
      );
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, user_has_supported: res.supported, support_count: res.support_count }
            : r
        )
      );
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSupportingId(null);
    }
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setStateId('uk-state');
    setDistrictId('');
    setBlockId('');
    setLocalityId('');
    setSort('newest');
    setPage(1);
    setSearchParams({});
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2942]">Explore Public Reports</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Showing only reports approved by जनConnect human moderators for public visibility.
            </p>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-white border border-[#E2E6EC] rounded-lg self-start" role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                viewMode === 'list'
                  ? 'bg-[#0F2942] text-white'
                  : 'bg-transparent text-[#374151] hover:bg-[#F7F6F2] hover:text-[#111827]'
              }`}
            >
              <List className="w-3.5 h-3.5" aria-hidden="true" />
              <span>List View</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'map'}
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                viewMode === 'map'
                  ? 'bg-[#0F2942] text-white'
                  : 'bg-transparent text-[#374151] hover:bg-[#F7F6F2] hover:text-[#111827]'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>District Map</span>
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <section aria-label="Search and filter reports" className="rounded-xl border border-[#E2E6EC] bg-white p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <label htmlFor="explore-search" className="block text-xs font-medium text-[#374151] mb-1">
                Search keywords or locality
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="explore-search"
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="e.g., water pipeline, Rajpur, streetlight"
                  className="w-full rounded-lg border border-[#E2E6EC] bg-white pl-9 pr-3 py-2 text-sm text-[#111827]"
                />
              </div>
            </div>

            <div className="md:col-span-4">
              <label htmlFor="explore-category" className="block text-xs font-medium text-[#374151] mb-1">
                Category
              </label>
              <select
                id="explore-category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="all">All Categories</option>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label htmlFor="explore-sort" className="block text-xs font-medium text-[#374151] mb-1">
                Sort by
              </label>
              <select
                id="explore-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value === 'most_supported' ? 'most_supported' : 'newest');
                  setPage(1);
                }}
                className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
              >
                <option value="newest">Newest Published</option>
                <option value="most_supported">Most Supported</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E6EC]">
            <LocationSelector
              stateId={stateId}
              districtId={districtId}
              blockId={blockId}
              localityId={localityId}
              allowAllLevels
              onChange={(next) => {
                setStateId(next.stateId);
                setDistrictId(next.districtId);
                setBlockId(next.blockId);
                setLocalityId(next.localityId);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#4B5563]">
            <span className="font-mono tabular-nums">{total} published reports matched</span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 font-medium text-[#0F2942] hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          </div>
        </section>

        {viewMode === 'map' && (
          <UttarakhandMapView
            districts={districts}
            reports={reports}
            selectedDistrictId={districtId}
            onSelectDistrict={(id) => {
              setDistrictId(id);
              setBlockId('');
              setLocalityId('');
              setPage(1);
            }}
            mapsConfigured={Boolean(health?.mapsConfigured)}
          />
        )}

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No published reports match these filters yet"
            description="Only reports that have passed जनConnect human moderation appear here. Submit a local issue or adjust your filters to explore other Uttarakhand districts."
            actionLabel={user ? 'Report a Problem' : 'Register to Report'}
            actionTo={user ? '/reports/create' : '/signup'}
          />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onToggleSupport={handleToggleSupport}
                supportPending={supportingId === report.id}
              />
            ))}

            {total > 12 && (
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-medium text-[#0F2942] disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="font-mono text-xs text-[#4B5563] tabular-nums">
                  Page {page} of {Math.ceil(total / 12)}
                </span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(total / 12)}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-[#E2E6EC] bg-white px-4 py-2 text-xs font-medium text-[#0F2942] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        <IndependentNotice compact />
      </div>
    </AppShell>
  );
}
