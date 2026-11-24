import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/layout/AppShell';
import { apiFetch } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { UserProfile } from '../../types/civic';

export function AdminLoginPage() {
  const { user, isModerator, setSession } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [needsSetup, setNeedsSetup] = useState(false);
  const [passcodeConfigured, setPasscodeConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('Lead Moderator');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && isModerator) {
      navigate('/admin', { replace: true });
      return;
    }
    apiFetch<{ needsSetup: boolean; passcodeConfigured: boolean }>('/api/admin/bootstrap-status')
      .then((res) => {
        setNeedsSetup(res.needsSetup);
        setPasscodeConfigured(res.passcodeConfigured);
      })
      .finally(() => setChecking(false));
  }, [user, isModerator, navigate]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/admin/claim', {
        method: 'POST',
        body: JSON.stringify({ email, username, displayName, password }),
      });
      setSession(res.token, res.user);
      showToast('Initial moderator console claimed and secured.', 'success');
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(passcodeConfigured ? { passcode } : { identifier, password }),
      });
      setSession(res.token, res.user);
      showToast('Moderator session verified.', 'success');
      navigate('/admin');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#0F2942]">
            <ShieldCheck className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold">Moderator Console Access</h1>
          </div>

          <p className="text-xs text-[#4B5563] leading-relaxed">
            जनConnect human moderators review reports for privacy, spam, and safety before public visibility. Moderator
            accounts represent independent platform reviewers, never government officers.
          </p>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {checking ? (
            <p className="text-sm text-[#4B5563]">Checking moderator console configuration...</p>
          ) : needsSetup ? (
            <form onSubmit={handleClaim} className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
                <strong>First-Run Setup:</strong> No moderator account or <span className="font-mono">MODERATOR_PASSCODE</span> is configured yet. Create the initial moderator/administrator credential below. This setup locks automatically once claimed.
              </div>
              <div>
                <label htmlFor="claim-email" className="block text-xs font-medium text-[#374151] mb-1">
                  Moderator Email *
                </label>
                <input
                  id="claim-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="claim-username" className="block text-xs font-medium text-[#374151] mb-1">
                    Username *
                  </label>
                  <input
                    id="claim-username"
                    type="text"
                    required
                    minLength={3}
                    pattern="[a-z0-9_]+"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="mod_uk"
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="claim-display" className="block text-xs font-medium text-[#374151] mb-1">
                    Display Name *
                  </label>
                  <input
                    id="claim-display"
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="claim-password" className="block text-xs font-medium text-[#374151] mb-1">
                  Password (min 8 chars) *
                </label>
                <input
                  id="claim-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163A5C]"
              >
                {submitting ? 'Setting up...' : 'Claim Moderator Console'}
              </button>
            </form>
          ) : passcodeConfigured ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="mod-passcode" className="block text-xs font-medium text-[#374151] mb-1">
                  Server Moderator Passcode
                </label>
                <input
                  id="mod-passcode"
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {submitting ? 'Verifying...' : 'Sign In as Moderator'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="mod-id" className="block text-xs font-medium text-[#374151] mb-1">
                  Moderator Email or Username
                </label>
                <input
                  id="mod-id"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="mod-pw" className="block text-xs font-medium text-[#374151] mb-1">
                  Password
                </label>
                <input
                  id="mod-pw"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {submitting ? 'Signing in...' : 'Sign In to Moderator Console'}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
