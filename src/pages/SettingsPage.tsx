import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { LocationSelector } from '../components/locations/LocationSelector';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [stateId, setStateId] = useState('uk-state');
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [localityId, setLocalityId] = useState('');
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    setPwSaving(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setPwSaving(false);
    }
  };

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
      showToast('Settings updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast('Signed out.', 'info');
    navigate('/');
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
        <h1 className="font-display text-2xl font-bold text-[#0F2942]">Account & Privacy Settings</h1>

        <form onSubmit={handleSave} className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">Public Profile Information</h2>

          <div>
            <label htmlFor="set-name" className="block text-xs font-medium text-[#374151] mb-1">
              Display Name
            </label>
            <input
              id="set-name"
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
            <label htmlFor="set-bio" className="block text-xs font-medium text-[#374151] mb-1">
              Short Bio
            </label>
            <textarea
              id="set-bio"
              rows={2}
              maxLength={240}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-[#374151] mb-2">Update General Area</p>
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

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-semibold text-white"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>

        <section className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-3">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">Verification & Safety Status</h2>
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-[#E2E6EC] p-3">
              <p className="text-xs text-[#6B7280]">Phone Control</p>
              <p className="mt-1 font-medium text-[#0F2942]">
                {user?.phone_verified ? 'Verified' : 'Not verified'}
              </p>
              {!user?.phone_verified && (
                <Link to="/verify-phone" className="mt-1 inline-block text-xs font-semibold text-[#0D7A6F] underline">
                  Verify Phone OTP
                </Link>
              )}
            </div>
            <div className="rounded-lg border border-[#E2E6EC] p-3">
              <p className="text-xs text-[#6B7280]">National ID Verification</p>
              <p className="mt-1 font-medium text-[#0F2942] capitalize">{user?.identity_status}</p>
              {user?.identity_status !== 'verified' && (
                <Link to="/verify-identity" className="mt-1 inline-block text-xs font-semibold text-[#0D7A6F] underline">
                  Verify National ID
                </Link>
              )}
            </div>
          </div>
        </section>

        <form onSubmit={handleChangePassword} className="rounded-xl border border-[#E2E6EC] bg-white p-6 space-y-4">
          <h2 className="font-display text-base font-semibold text-[#0F2942]">Change Password</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="pw-current" className="block text-xs font-medium text-[#374151] mb-1">
                Current Password
              </label>
              <input
                id="pw-current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pw-new" className="block text-xs font-medium text-[#374151] mb-1">
                New Password (min 8)
              </label>
              <input
                id="pw-new"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="block text-xs font-medium text-[#374151] mb-1">
                Confirm New Password
              </label>
              <input
                id="pw-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pwSaving}
            className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-semibold text-white hover:bg-[#163A5C] disabled:opacity-60"
          >
            {pwSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <div className="flex items-center justify-between rounded-xl border border-[#E2E6EC] bg-white p-5">
          <div>
            <p className="text-sm font-semibold text-[#0F2942]">Session Management</p>
            <p className="text-xs text-[#4B5563]">Sign out of जनConnect on this browser.</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </AppShell>
  );
}
