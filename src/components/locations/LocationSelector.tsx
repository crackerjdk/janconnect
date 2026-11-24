import { useEffect, useState } from 'react';
import { apiFetch } from '../../services/api';
import type { LocationNode } from '../../types/civic';
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

  const computeLabel = (sId: string, dId: string, bId: string, lId: string) => {
    const s = states.find((x) => x.id === sId)?.name || 'Uttarakhand';
    const d = districts.find((x) => x.id === dId)?.name || null;
    const b = blocks.find((x) => x.id === bId)?.name || null;
    const l = localities.find((x) => x.id === lId)?.name || null;
    return formatGeneralizedLocation({ locality: l, block: b, district: d, state: s });
  };

  return (
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
          <option value="">{allowAllLevels ? 'All Districts' : 'Select District'}</option>
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
          <option value="">{allowAllLevels ? 'All Blocks / Towns' : 'Select Block / Municipality'}</option>
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
          <option value="">{allowAllLevels ? 'All Localities' : 'Select Village / Locality'}</option>
          {localities.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
