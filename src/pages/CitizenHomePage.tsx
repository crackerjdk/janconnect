import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Bell, MapPin, Compass } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { ReportCard } from '../components/complaints/ReportCard';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { LocationNode, NotificationItem, PublicReportSummary } from '../types/civic';
import { REPORT_CATEGORIES } from '../utils/civicRules';

export function CitizenHomePage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'nearby' | 'recent' | 'supported' | 'statewide'>('nearby');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [districts, setDistricts] = useState<LocationNode[]>([]);
  const [reports, setReports] = useState<PublicReportSummary[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportingId, setSupportingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ locations: LocationNode[] }>('/api/locations?type=district&parent_id=uk-state')
      .then((res) => setDistricts(res.locations))
      .catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ notifications: NotificationItem[] }>('/api/notifications')
      .then((res) => setNotifications(res.notifications.slice(0, 4)))
      .catch(() => setNotifications([]));
  }, [user]);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '10');
      if (tab === 'supported') {
        params.set('sort', 'most_supported');
      } else {
        params.set('sort', 'newest');
      }
      if (tab === 'nearby' && selectedDistrict) {
        params.set('district_id', selectedDistrict);
      }
      const res = await apiFetch<{ reports: PublicReportSummary[] }>(`/api/reports/public?${params.toString()}`);
      setReports(res.reports);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, selectedDistrict, showToast]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleOptionalGeo = () => {
    if (!navigator.geolocation) {
      showToast('Browser geolocation is unavailable; please pick your district manually.', 'info');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (districts.length === 0) return;
        let closest = districts[0];
        let bestDist = Infinity;
        for (const d of districts) {
          if (d.latitude == null || d.longitude == null) continue;
          const dist = Math.hypot(d.latitude - pos.coords.latitude, d.longitude - pos.coords.longitude);
          if (dist < bestDist) {
            bestDist = dist;
            closest = d;
          }
        }
        setSelectedDistrict(closest.id);
        setTab('nearby');
        showToast(`Area set to ${closest.name} district (precise coordinates not stored).`, 'success');
      },
      () => {
        showToast('Location permission declined. You can select your district manually below.', 'info');
      },
      { timeout: 5000 }
    );
  };

  const handleToggleSupport = async (reportId: string, currentlySupported: boolean) => {
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

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
        {/* Greeting + Quick Report */}
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2942]">
              Welcome back, {user?.display_name}
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Follow verified civic reports in your district or explore issues across Uttarakhand.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {user?.identity_status !== 'verified' && (
              <Link
                to="/verify-identity"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-950 whitespace-nowrap"
              >
                Complete Verification to Report
              </Link>
            )}
            <Link
              to="/reports/create"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A] whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              <span>Quick Report</span>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Main Feed Column */}
          <div className="lg:col-span-8 space-y-5">
            {/* Area & Feed Mode Controls */}
            <div className="rounded-xl border border-[#E2E6EC] bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F6F2] rounded-lg">
                  {(
                    [
                      ['nearby', 'Nearby'],
                      ['recent', 'Recently Published'],
                      ['supported', 'Most Supported'],
                      ['statewide', 'Explore Statewide'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setTab(key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        tab === key ? 'bg-white text-[#0F2942] shadow-sm' : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleOptionalGeo}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D7A6F] hover:underline whitespace-nowrap"
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Detect district (optional)</span>
                </button>
              </div>

              {tab === 'nearby' && (
                <div className="flex items-center gap-3 pt-2 border-t border-[#E2E6EC]">
                  <MapPin className="w-4 h-4 text-[#0D7A6F] shrink-0" aria-hidden="true" />
                  <label htmlFor="home-district" className="text-xs font-medium text-[#374151] whitespace-nowrap">
                    Manual District:
                  </label>
                  <select
                    id="home-district"
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="flex-1 rounded-lg border border-[#E2E6EC] bg-white px-3 py-1.5 text-xs text-[#111827]"
                  >
                    <option value="">All Uttarakhand Districts</option>
                    {districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {loading ? (
              <LoadingSkeleton rows={3} />
            ) : reports.length === 0 ? (
              <EmptyState
                title="No published reports in this feed yet"
                description="Published civic reports from your selected district or across Uttarakhand will appear here once approved by moderators."
                actionLabel="Submit a Report"
                actionTo="/reports/create"
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
              </div>
            )}
          </div>

          {/* Right Sidebar: Categories & Recent Notifications */}
          <aside className="lg:col-span-4 space-y-5">
            <section className="rounded-xl border border-[#E2E6EC] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-semibold text-[#0F2942] inline-flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                  <span>Recent Notifications</span>
                </h2>
                <Link to="/notifications" className="text-xs font-medium text-[#0D7A6F] hover:underline">
                  View all
                </Link>
              </div>
              {notifications.length === 0 ? (
                <p className="mt-3 text-xs text-[#6B7280]">No notifications yet.</p>
              ) : (
                <ul className="mt-3 divide-y divide-[#E2E6EC]">
                  {notifications.map((n) => (
                    <li key={n.id} className="py-2.5 text-xs text-[#374151]">
                      <p className={n.is_read ? 'text-[#6B7280]' : 'font-medium text-[#0F2942]'}>{n.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-[#E2E6EC] bg-white p-5">
              <h2 className="font-display text-sm font-semibold text-[#0F2942]">Category Shortcuts</h2>
              <div className="mt-3 grid grid-cols-1 gap-1.5">
                {REPORT_CATEGORIES.slice(0, 7).map((cat) => (
                  <Link
                    key={cat}
                    to={`/explore?category=${encodeURIComponent(cat)}`}
                    className="rounded-md px-2.5 py-1.5 text-xs text-[#374151] hover:bg-[#F7F6F2] hover:text-[#0F2942] transition-colors"
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </section>

            <IndependentNotice compact />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
