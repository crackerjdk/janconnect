import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LocationSelector } from '../components/locations/LocationSelector';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function OnboardingProfilePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [stateId, setStateId] = useState('uk-state');
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [localityId, setLocalityId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName,
          bio,
          locationId: localityId || blockId || districtId || undefined,
        }),
      });
      await refreshUser();
      showToast('Profile preferences saved.', 'success');
      navigate(user?.identity_status === 'verified' ? '/home' : '/verify-identity');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-6">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#0F2942]">Set Up Your Citizen Profile</h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Choose your general area in Uttarakhand so your feed highlights local issues first. We never display
              private contact info or exact home coordinates.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label htmlFor="onb-name" className="block text-xs font-medium text-[#374151] mb-1">
                Public Display Name
              </label>
              <input
                id="onb-name"
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="onb-bio" className="block text-xs font-medium text-[#374151] mb-1">
                Short Bio (optional, max 240 chars)
              </label>
              <textarea
                id="onb-bio"
                rows={2}
                maxLength={240}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Neighborhood volunteer or resident..."
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#374151] mb-2">
                General Area (Optional — manual selection works without device GPS)
              </p>
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
                }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Link to="/home" className="text-sm text-[#4B5563] hover:underline">
                Skip for now
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#0D7A6F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A]"
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
