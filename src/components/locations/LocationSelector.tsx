import { useEffect, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { apiFetch } from '../../services/api';
import type { LocationNode, LocationSearchResult } from '../../types/civic';
import { formatGeneralizedLocation } from '../../utils/civicRules';

interface LocationSelectorProps {
  stateId: string;
  districtId: string;
  blockId: string;
  localityId: string;
  onChange: (next: {
    stateId: string;
    districtId: string;
    blockId: string;
    localityId: string;
    generalizedLabel: string;
    suggestedCenter?: { lat: number; lng: number } | null;
  }) => void;
  allowAllLevels?: boolean;
  required?: boolean;
}

export function LocationSelector({
  stateId,
  districtId,
  blockId,
  localityId,
  onChange,
  allowAllLevels = false,
  required = false,
}: LocationSelectorProps) {
  const [states, setStates] = useState<LocationNode[]>([]);
  const [districts, setDistricts] = useState<LocationNode[]>([]);
  const [blocks, setBlocks] = useState<LocationNode[]>([]);
  const [localities, setLocalities] = useState<LocationNode[]>([]);

  const [areaQuery, setAreaQuery] = useState('');
  const [areaResults, setAreaResults] = useState<LocationSearchResult[]>([]);
  const [searchingAreas, setSearchingAreas] = useState(false);

  useEffect(() => {
    apiFetch<{ locations: LocationNode[] }>('/api/locations?type=state')
      .then((res) => setStates(res.locations))
      .catch(() => setStates([]));
  }, []);

  useEffect(() => {
    if (!stateId) {
      setDistricts([]);
      return;
    }
    apiFetch<{ locations: LocationNode[] }>(`/api/locations?type=district&parent_id=${encodeURIComponent(stateId)}`)
      .then((res) => setDistricts(res.locations))
      .catch(() => setDistricts([]));
  }, [stateId]);

  useEffect(() => {
    if (!districtId) {
      setBlocks([]);
      return;
    }
    apiFetch<{ locations: LocationNode[] }>(`/api/locations?type=block&parent_id=${encodeURIComponent(districtId)}`)
      .then((res) => setBlocks(res.locations))
      .catch(() => setBlocks([]));
  }, [districtId]);

  useEffect(() => {
    if (!blockId) {
      setLocalities([]);
      return;
    }
    apiFetch<{ locations: LocationNode[] }>(`/api/locations?type=locality&parent_id=${encodeURIComponent(blockId)}`)
      .then((res) => setLocalities(res.locations))
      .catch(() => setLocalities([]));
  }, [blockId]);

  useEffect(() => {
    const trimmed = areaQuery.trim();
    if (trimmed.length < 2) {
      setAreaResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchingAreas(true);
      apiFetch<{ locations: LocationSearchResult[] }>(`/api/locations?q=${encodeURIComponent(trimmed)}`)
        .then((res) => setAreaResults(res.locations || []))
        .catch(() => setAreaResults([]))
        .finally(() => setSearchingAreas(false));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [areaQuery]);

  const computeLabel = (sId: string, dId: string, bId: string, lId: string) => {
    const s = states.find((x) => x.id === sId)?.name || 'Uttarakhand';
    const d = districts.find((x) => x.id === dId)?.name || null;
    const b = blocks.find((x) => x.id === bId)?.name || null;
    const l = localities.find((x) => x.id === lId)?.name || null;
    return formatGeneralizedLocation({ locality: l, block: b, district: d, state: s });
  };

  const handleSelectQuickArea = (loc: LocationSearchResult) => {
    const nextStateId = loc.state_id || stateId || 'uk-state';
    const nextDistrictId = loc.type === 'district' ? loc.id : loc.district_id || '';
    const nextBlockId = loc.type === 'block' ? loc.id : loc.type === 'locality' ? loc.block_id || '' : '';
    const nextLocalityId = loc.type === 'locality' ? loc.id : '';

    onChange({
      stateId: nextStateId,
      districtId: nextDistrictId,
      blockId: nextBlockId,
      localityId: nextLocalityId,
      generalizedLabel: loc.generalized_label,
      suggestedCenter:
        loc.latitude != null && loc.longitude != null ? { lat: loc.latitude, lng: loc.longitude } : null,
    });
    setAreaQuery('');
    setAreaResults([]);
  };

  return (
    <div className="space-y-3">
      {!allowAllLevels && (
        <div className="relative">
          <label htmlFor="loc-quick-search" className="block text-xs font-medium text-[#374151] mb-1">
            Quick Find Uttarakhand Village, Block, or Town
          </label>
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              id="loc-quick-search"
              type="text"
              role="searchbox"
              value={areaQuery}
              onChange={(e) => setAreaQuery(e.target.value)}
              placeholder="Type a village or block (e.g., Ukhimath, Gairsain, Munsiyari, Tyuni, Kapkot)..."
              className="w-full rounded-lg border border-[#E2E6EC] bg-white pl-8 pr-8 py-2 text-sm text-[#111827] placeholder:text-[#6B7280]"
            />
            {areaQuery && (
              <button
                type="button"
                onClick={() => {
                  setAreaQuery('');
                  setAreaResults([]);
                }}
                aria-label="Clear location search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#111827]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {areaQuery.trim().length >= 2 && (
            <div className="mt-1 rounded-lg border border-[#E2E6EC] bg-white shadow-sm max-h-56 overflow-y-auto divide-y divide-[#E2E6EC]">
              {searchingAreas ? (
                <p className="px-3 py-2 text-xs text-[#6B7280]">Searching Uttarakhand villages & blocks...</p>
              ) : areaResults.length === 0 ? (
                <p className="px-3 py-2 text-xs text-[#6B7280]">
                  No matching directory village found. Select the nearest block below and use the Google Maps search bar to pin your exact spot.
                </p>
              ) : (
                areaResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={() => handleSelectQuickArea(res)}
                    className="w-full flex items-start justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[#F7F6F2] transition-colors"
                  >
                    <span className="inline-flex items-start gap-2 min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block font-semibold text-[#0F2942] truncate">{res.name}</span>
                        <span className="block text-[#6B7280] truncate">{res.generalized_label}</span>
                      </span>
                    </span>
                    <span className="shrink-0 uppercase tracking-wide text-[10px] font-medium text-[#4B5563]">
                      {res.type === 'locality' ? 'Village / Ward' : res.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="loc-state" className="block text-xs font-medium text-[#374151] mb-1">
            State {required && <span className="text-red-700">*</span>}
          </label>
          <select
            id="loc-state"
            value={stateId}
            onChange={(e) =>
              onChange({
                stateId: e.target.value,
                districtId: '',
                blockId: '',
                localityId: '',
                generalizedLabel: computeLabel(e.target.value, '', '', ''),
              })
            }
            className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
          >
            {allowAllLevels && <option value="">All States</option>}
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loc-district" className="block text-xs font-medium text-[#374151] mb-1">
            District {required && <span className="text-red-700">*</span>}
          </label>
          <select
            id="loc-district"
            value={districtId}
            disabled={!stateId}
            onChange={(e) => {
              const dist = districts.find((x) => x.id === e.target.value);
              onChange({
                stateId,
                districtId: e.target.value,
                blockId: '',
                localityId: '',
                generalizedLabel: computeLabel(stateId, e.target.value, '', ''),
                suggestedCenter:
                  dist?.latitude != null && dist?.longitude != null
                    ? { lat: dist.latitude, lng: dist.longitude }
                    : null,
              });
            }}
            className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827] disabled:bg-gray-50"
          >
            <option value="">{allowAllLevels ? 'All Districts' : `Select District (${districts.length})`}</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loc-block" className="block text-xs font-medium text-[#374151] mb-1">
            Block / Municipality {required && <span className="text-red-700">*</span>}
          </label>
          <select
            id="loc-block"
            value={blockId}
            disabled={!districtId}
            onChange={(e) => {
              const blk = blocks.find((x) => x.id === e.target.value);
              const dist = districts.find((x) => x.id === districtId);
              const target = blk?.latitude != null && blk?.longitude != null ? blk : dist;
              onChange({
                stateId,
                districtId,
                blockId: e.target.value,
                localityId: '',
                generalizedLabel: computeLabel(stateId, districtId, e.target.value, ''),
                suggestedCenter:
                  target?.latitude != null && target?.longitude != null
                    ? { lat: target.latitude, lng: target.longitude }
                    : null,
              });
            }}
            className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827] disabled:bg-gray-50"
          >
            <option value="">
              {allowAllLevels
                ? 'All Blocks / Towns'
                : districtId
                  ? `Select Block (${blocks.length})`
                  : 'Select Block / Municipality'}
            </option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="loc-locality" className="block text-xs font-medium text-[#374151] mb-1">
            Village / Locality {required && <span className="text-red-700">*</span>}
          </label>
          <select
            id="loc-locality"
            value={localityId}
            disabled={!blockId}
            onChange={(e) => {
              const loc = localities.find((x) => x.id === e.target.value);
              const blk = blocks.find((x) => x.id === blockId);
              const dist = districts.find((x) => x.id === districtId);
              const target =
                loc?.latitude != null && loc?.longitude != null
                  ? loc
                  : blk?.latitude != null && blk?.longitude != null
                    ? blk
                    : dist;
              const locName = loc?.name || null;
              const bName = blk?.name || null;
              const dName = dist?.name || null;
              const sName = states.find((x) => x.id === stateId)?.name || 'Uttarakhand';
              onChange({
                stateId,
                districtId,
                blockId,
                localityId: e.target.value,
                generalizedLabel: formatGeneralizedLocation({
                  locality: locName,
                  block: bName,
                  district: dName,
                  state: sName,
                }),
                suggestedCenter:
                  target?.latitude != null && target?.longitude != null
                    ? { lat: target.latitude, lng: target.longitude }
                    : null,
              });
            }}
            className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827] disabled:bg-gray-50"
          >
            <option value="">
              {allowAllLevels
                ? 'All Localities'
                : blockId
                  ? `Select Village / Locality (${localities.length})`
                  : 'Select Village / Locality'}
            </option>
            {localities.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
