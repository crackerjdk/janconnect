import { MapPin } from 'lucide-react';
import type { LocationNode, PublicReportSummary } from '../../types/civic';

interface UttarakhandMapViewProps {
  districts: LocationNode[];
  reports: PublicReportSummary[];
  selectedDistrictId: string;
  onSelectDistrict: (districtId: string) => void;
  mapsConfigured: boolean;
}

export function UttarakhandMapView({
  districts,
  reports,
  selectedDistrictId,
  onSelectDistrict,
  mapsConfigured,
}: UttarakhandMapViewProps) {
  const countsByDistrict = new Map<string, number>();
  for (const r of reports) {
    if (r.district_id) {
      countsByDistrict.set(r.district_id, (countsByDistrict.get(r.district_id) || 0) + 1);
    }
  }

  // Approximate bounding box for Uttarakhand districts (28.7N - 31.3N, 77.6E - 80.7E)
  const minLat = 28.7;
  const maxLat = 31.1;
  const minLng = 77.5;
  const maxLng = 80.5;

  const projectPoint = (lat: number | null, lng: number | null) => {
    const safeLat = lat ?? 30.0;
    const safeLng = lng ?? 79.0;
    const x = ((safeLng - minLng) / (maxLng - minLng)) * 520 + 40;
    const y = ((maxLat - safeLat) / (maxLat - minLat)) * 280 + 30;
    return { x, y };
  };

  return (
    <div className="rounded-xl border border-[#E2E6EC] bg-white p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-[#E2E6EC]">
        <div>
          <h3 className="font-display text-base font-semibold text-[#0F2942]">
            Uttarakhand District Discovery (Generalized Areas)
          </h3>
          <p className="text-xs text-[#4B5563] mt-0.5">
            {mapsConfigured
              ? 'External map API key detected. Displaying generalized district clusters only.'
              : 'Manual hierarchical map selector active (no external Mapbox/Google Maps key required). Exact coordinates are never exposed.'}
          </p>
        </div>
        {selectedDistrictId && (
          <button
            type="button"
            onClick={() => onSelectDistrict('')}
            className="text-xs font-medium text-[#0D7A6F] hover:underline whitespace-nowrap"
          >
            Clear district selection
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-3">
          <svg
            viewBox="0 0 600 340"
            role="img"
            aria-label="Generalized Uttarakhand District Discovery Map"
            className="w-full h-auto"
          >
            {/* Subtle state silhouette contour */}
            <path
              d="M 70 155 L 145 70 L 235 42 L 350 85 L 470 140 L 535 205 L 485 280 L 360 305 L 230 275 L 130 245 Z"
              fill="#FFFFFF"
              stroke="#CBD5E1"
              strokeWidth="1.5"
            />
            {districts.map((d) => {
              const { x, y } = projectPoint(d.latitude, d.longitude);
              const count = countsByDistrict.get(d.id) || 0;
              const active = selectedDistrictId === d.id;
              return (
                <g
                  key={d.id}
                  onClick={() => onSelectDistrict(active ? '' : d.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDistrict(active ? '' : d.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Filter by ${d.name} district (${count} published reports)`}
                  className="cursor-pointer focus:outline-none"
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 14 : count > 0 ? 11 : 8}
                    fill={active ? '#0F2942' : count > 0 ? '#0D7A6F' : '#94A3B8'}
                    fillOpacity={active ? 0.95 : 0.85}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  {count > 0 && (
                    <text
                      x={x}
                      y={y + 3.5}
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="600"
                      fill="#FFFFFF"
                      className="font-mono"
                    >
                      {count}
                    </text>
                  )}
                  <text
                    x={x}
                    y={y + 24}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={active ? '700' : '500'}
                    fill="#1E293B"
                  >
                    {d.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          <p className="text-xs font-semibold text-[#374151]">Select a District</p>
          {districts.map((d) => {
            const count = countsByDistrict.get(d.id) || 0;
            const active = selectedDistrictId === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDistrict(active ? '' : d.id)}
                className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'border-[#0F2942] bg-[#0F2942] text-white'
                    : 'border-[#E2E6EC] bg-white text-[#111827] hover:bg-[#F7F6F2]'
                }`}
              >
                <span className="inline-flex items-center gap-2 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className={`font-mono text-xs tabular-nums ${active ? 'text-white/90' : 'text-[#4B5563]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
