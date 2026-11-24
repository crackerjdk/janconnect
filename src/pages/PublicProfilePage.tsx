import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Calendar } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { StatusLabel } from '../components/ui/StatusLabel';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { apiFetch } from '../services/api';
import type { PlatformStatus } from '../utils/civicRules';

interface PublicProfileData {
  profile: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    general_area: string | null;
    created_at: string;
  };
  publishedReports: Array<{
    id: string;
    title: string;
    category: string;
    generalized_location: string;
    platform_status: PlatformStatus;
    published_at: string;
    support_count: number;
  }>;
}

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    apiFetch<PublicProfileData>(`/api/profiles/${encodeURIComponent(username)}`)
      .then((res) => setData(res))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [username]);

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {loading && <LoadingSkeleton rows={2} />}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">
            {error}
          </div>
        )}
        {data && (
          <>
            <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-full bg-[#0F2942] text-white flex items-center justify-center font-display text-xl font-bold shrink-0">
                  {data.profile.display_name.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#0F2942]">{data.profile.display_name}</h1>
                  <p className="font-mono text-xs text-[#6B7280]">@{data.profile.username}</p>
                  {data.profile.bio && <p className="mt-2 text-sm text-[#374151]">{data.profile.bio}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#4B5563]">
                    {data.profile.general_area && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#0D7A6F]" aria-hidden="true" />
                        <span>{data.profile.general_area}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Joined {new Date(data.profile.created_at).toLocaleDateString('en-IN')}</span>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-[#0F2942]">
                Published Civic Reports ({data.publishedReports.length})
              </h2>
              {data.publishedReports.length === 0 ? (
                <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 text-sm text-[#6B7280]">
                  No published public reports yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.publishedReports.map((r) => (
                    <article key={r.id} className="rounded-xl border border-[#E2E6EC] bg-white p-5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
                        <span className="font-medium text-[#0F2942]">{r.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{r.generalized_location}</span>
                        <span aria-hidden="true">·</span>
                        <StatusLabel status={r.platform_status} />
                      </div>
                      <h3 className="mt-1.5 font-display text-base font-semibold text-[#0F2942]">
                        <Link to={`/reports/${r.id}`} className="hover:underline">
                          {r.title}
                        </Link>
                      </h3>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
