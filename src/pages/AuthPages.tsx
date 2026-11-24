import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, Phone, BadgeCheck, KeyRound, Lock, Upload, AlertCircle, Clock, MailCheck } from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { IndependentNotice } from '../components/ui/IndependentNotice';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  completeSupabasePasswordReset,
  getSupabaseClient,
  isSupabaseConfigured,
  requestSupabasePasswordReset,
} from '../lib/supabase';
import type { UserProfile, VerificationSummary } from '../types/civic';
import { validateNewPassword, validateResetEmail } from '../utils/civicRules';
import {
  getNationalIdLabel,
  NATIONAL_ID_OPTIONS,
  type NationalIdType,
  validateLegalName,
  validateNationalIdFormat,
} from '../utils/nationalId';

export function SignupPage() {
  const { setSession, health } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [ageConsentAck, setAgeConsentAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email,
          phone,
          username,
          displayName,
          password,
          ageConsentAcknowledged: ageConsentAck,
        }),
      });
      setSession(res.token, res.user);
      showToast('Account created. Complete your profile area and verification.', 'success');
      navigate('/onboarding/profile');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 space-y-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Create a Citizen Account</h1>
          <p className="mt-1.5 text-sm text-[#4B5563]">
            Register to submit civic reports, support neighborhood issues, and track moderation status.
          </p>

          {health && !health.supabaseConfigured && (
            <div className="mt-4 rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-3.5 py-2.5 text-xs text-[#374151]">
              <strong>Backend Mode:</strong> Local V0.1 SQLite authentication active (Supabase credentials not connected yet — see <span className="font-mono">SUPABASE_SETUP.md</span>).
            </div>
          )}

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-950 leading-relaxed">
            <p className="font-semibold inline-flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Child-Safety & Legal Review Notice (Gate: {health?.ageConsentGateMode || 'gated'})</span>
            </p>
            <p className="mt-1">
              जनConnect is designed for all ages, but production all-ages registration remains gated until an adult
              project operator and qualified legal/privacy reviewer approve applicable age-assurance and parental-consent
              requirements. Never enter DOB, school name, or Aadhaar numbers.
            </p>
          </div>

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signup-display" className="block text-xs font-medium text-[#374151] mb-1">
                  Display Name *
                </label>
                <input
                  id="signup-display"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Asha Rawat"
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="signup-username" className="block text-xs font-medium text-[#374151] mb-1">
                  Username *
                </label>
                <input
                  id="signup-username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9_]+"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="asha_uk"
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium text-[#374151] mb-1">
                Email Address (provide email or mobile)
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="citizen@example.com"
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="signup-phone" className="block text-xs font-medium text-[#374151] mb-1">
                Mobile Number (kept private; never displayed publicly)
              </label>
              <input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98XXXXXXXX"
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-xs font-medium text-[#374151] mb-1">
                Password (min 8 characters) *
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#374151] cursor-pointer">
              <input
                type="checkbox"
                checked={ageConsentAck}
                onChange={(e) => setAgeConsentAck(e.target.checked)}
                required
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#0D7A6F]"
              />
              <span>
                I understand जनConnect is an independent civic platform, and I acknowledge the{' '}
                <Link to="/safety" className="underline text-[#0F2942] font-medium">
                  Safety Centre rules & legal-review age-consent notice
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A] disabled:opacity-60"
            >
              {submitting ? 'Creating account...' : 'Create Citizen Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-[#4B5563]">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-[#0F2942] hover:underline">
              Sign in here
            </Link>
          </p>
        </div>

        <IndependentNotice compact />
      </div>
    </AppShell>
  );
}

export function LoginPage() {
  const { setSession } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const supabaseActive = isSupabaseConfigured();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm' | 'email_sent'>('request');
  const [resetId, setResetId] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [previewResetCode, setPreviewResetCode] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const timer = window.setTimeout(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSec]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      setSession(res.token, res.user);
      showToast('Signed in successfully.', 'success');
      navigate('/home');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg(null);
    setResetError(null);

    if (supabaseActive) {
      const emailCheck = validateResetEmail(resetId);
      if (!emailCheck.valid) {
        setResetError(emailCheck.error || 'Please enter a valid email address.');
        return;
      }
      if (cooldownSec > 0) {
        setResetError(`Please wait ${cooldownSec} seconds before requesting another reset email.`);
        return;
      }
      setResetBusy(true);
      try {
        const result = await requestSupabasePasswordReset(emailCheck.email);
        if (!result.ok) {
          setResetError(result.error || 'Unable to send password reset email.');
          return;
        }
        setResetMsg(result.message);
        setResetStep('email_sent');
        setCooldownSec(60);
        showToast('Password reset email requested.', 'success');
      } finally {
        setResetBusy(false);
      }
      return;
    }

    // Safe local V0.1 fallback when Supabase Auth credentials are not connected yet
    if (resetId.includes('@')) {
      const emailCheck = validateResetEmail(resetId);
      if (!emailCheck.valid) {
        setResetError(emailCheck.error || 'Please enter a valid email address.');
        return;
      }
    } else if (resetId.trim().length < 3) {
      setResetError('Please enter your registered email, 10-digit mobile number, or username.');
      return;
    }

    setResetBusy(true);
    try {
      const res = await apiFetch<{ message: string; previewResetCode?: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ identifier: resetId }),
      });
      setPreviewResetCode(res.previewResetCode || null);
      setResetMsg(res.message);
      setResetStep('confirm');
    } catch (err) {
      setResetError((err as Error).message);
    } finally {
      setResetBusy(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg(null);
    setResetError(null);

    const pwCheck = validateNewPassword(newPassword, confirmNewPassword);
    if (!pwCheck.valid) {
      setResetError(pwCheck.error || 'Please enter a stronger matching password.');
      return;
    }

    setResetBusy(true);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password/confirm', {
        method: 'POST',
        body: JSON.stringify({
          identifier: resetId,
          code: resetCode,
          newPassword,
        }),
      });
      showToast('Password updated. Please sign in with your new password.', 'success');
      setIdentifier(resetId);
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPreviewResetCode(null);
      setResetStep('request');
      setShowReset(false);
      setResetMsg(res.message);
    } catch (err) {
      setResetError((err as Error).message);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6 space-y-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8">
          <h1 className="font-display text-2xl font-bold text-[#0F2942]">Citizen Sign In</h1>
          <p className="mt-1 text-sm text-[#4B5563]">Access your neighborhood feed and submitted reports.</p>

          {error && (
            <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {resetMsg && !showReset && (
            <div role="status" className="mt-4 rounded-lg border border-[#0D7A6F]/30 bg-[#0D7A6F]/5 px-4 py-3 text-xs text-[#0F2942]">
              {resetMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-id" className="block text-xs font-medium text-[#374151] mb-1">
                Email, Mobile Number, or Username
              </label>
              <input
                id="login-id"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="login-pw" className="block text-xs font-medium text-[#374151] mb-1">
                Password
              </label>
              <input
                id="login-pw"
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
              className="w-full rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163A5C] disabled:opacity-60"
            >
              {submitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs text-[#4B5563]">
            <button
              type="button"
              aria-expanded={showReset}
              onClick={() => {
                setShowReset((prev) => !prev);
                setResetError(null);
              }}
              className="font-medium text-[#0F2942] hover:underline inline-flex items-center gap-1"
            >
              <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Forgot password?</span>
            </button>
            <Link to="/signup" className="font-semibold text-[#0D7A6F] hover:underline">
              Create account
            </Link>
          </div>

          {showReset && (
            <div className="mt-4 pt-4 border-t border-[#E2E6EC] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-[#0F2942]">Reset Forgotten Password</p>
                <span className="text-[11px] font-mono text-[#6B7280]">
                  {supabaseActive ? 'Supabase Auth' : 'Local Fallback'}
                </span>
              </div>

              {!supabaseActive && (
                <p className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] px-3 py-2 text-[11px] text-[#4B5563] leading-relaxed">
                  Supabase Auth email delivery activates when <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
                  <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> are set. Using the local 6-digit reset flow
                  below.
                </p>
              )}

              {resetError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {resetError}
                </div>
              )}

              {resetStep === 'email_sent' ? (
                <div role="status" className="space-y-3 rounded-lg border border-[#0D7A6F]/30 bg-[#0D7A6F]/5 p-3.5 text-xs text-[#0F2942]">
                  <p className="font-semibold inline-flex items-center gap-1.5">
                    <MailCheck className="w-4 h-4 text-[#0D7A6F]" aria-hidden="true" />
                    <span>Check Your Email</span>
                  </p>
                  <p className="text-[#374151] leading-relaxed">{resetMsg}</p>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      disabled={cooldownSec > 0 || resetBusy}
                      onClick={handleRequestReset}
                      className="font-semibold text-[#0F2942] hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      {cooldownSec > 0 ? `Resend available in ${cooldownSec}s` : 'Resend reset email'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep('request');
                        setResetError(null);
                      }}
                      className="text-[#4B5563] hover:underline"
                    >
                      Use different email
                    </button>
                  </div>
                </div>
              ) : resetStep === 'request' ? (
                <form onSubmit={handleRequestReset} className="space-y-3">
                  <label htmlFor="reset-id" className="block text-xs font-medium text-[#374151]">
                    {supabaseActive
                      ? 'Enter your registered email address'
                      : 'Registered email, mobile number, or username'}
                  </label>
                  <input
                    id="reset-id"
                    type={supabaseActive ? 'email' : 'text'}
                    required
                    autoComplete="email"
                    value={resetId}
                    onChange={(e) => setResetId(e.target.value)}
                    placeholder={supabaseActive ? 'citizen@example.com' : 'citizen@example.com or 98XXXXXXXX'}
                    className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={resetBusy || (supabaseActive && cooldownSec > 0)}
                    className="rounded-lg bg-[#0F2942] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-60"
                  >
                    {resetBusy
                      ? 'Sending...'
                      : supabaseActive
                      ? cooldownSec > 0
                        ? `Wait ${cooldownSec}s`
                        : 'Send Password Reset Email'
                      : 'Send 6-Digit Reset Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-3">
                  {resetMsg && <p className="text-xs text-[#374151]">{resetMsg}</p>}
                  {previewResetCode && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      Preview Environment Reset Code (Email/SMS provider not connected):{' '}
                      <span className="font-mono font-bold">{previewResetCode}</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="reset-code" className="block text-xs font-medium text-[#374151] mb-1">
                      6-Digit Reset Code
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-new-pw" className="block text-xs font-medium text-[#374151] mb-1">
                      New Password (8+ chars, letter & number)
                    </label>
                    <input
                      id="reset-new-pw"
                      type="password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-confirm-pw" className="block text-xs font-medium text-[#374151] mb-1">
                      Confirm New Password
                    </label>
                    <input
                      id="reset-confirm-pw"
                      type="password"
                      required
                      minLength={8}
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="submit"
                      disabled={resetBusy}
                      className="rounded-lg bg-[#0D7A6F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0A635A] disabled:opacity-60"
                    >
                      {resetBusy ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep('request');
                        setResetError(null);
                      }}
                      className="text-xs text-[#4B5563] hover:underline"
                    >
                      Request new code
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function ResetPasswordPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const supabase = getSupabaseClient();

  const [checking, setChecking] = useState(Boolean(supabase));
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setChecking(false);
      return;
    }

    let mounted = true;
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const urlError = params.get('error_description') || hashParams.get('error_description');
    if (urlError) {
      setLinkError(urlError);
      setChecking(false);
      return;
    }

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    (async () => {
      const code = params.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!mounted) return;
        if (error) {
          setLinkError('This password reset link is invalid or has expired. Please request a new one.');
          setChecking(false);
          return;
        }
        setRecoveryReady(true);
        setChecking(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        setRecoveryReady(true);
      } else {
        setLinkError('No active password recovery session found. Please open the link from your email or request a new reset.');
      }
      setChecking(false);
    })();

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const pwCheck = validateNewPassword(password, confirmPassword);
    if (!pwCheck.valid) {
      setFormError(pwCheck.error || 'Please check your new password.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await completeSupabasePasswordReset(password, confirmPassword);
      if (!result.ok) {
        setFormError(result.error || 'Unable to update password.');
        return;
      }
      showToast('Password updated successfully. Please sign in.', 'success');
      navigate('/login');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#0F2942]">
            <KeyRound className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold">Set New Password</h1>
          </div>

          {!supabase ? (
            <div className="space-y-3 text-sm text-[#4B5563]">
              <p>
                Supabase Auth email recovery is not configured in this local preview environment. Use the{' '}
                <strong>Forgot password?</strong> option on the Sign In page to reset your password locally.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white"
              >
                Go to Sign In
              </Link>
            </div>
          ) : checking ? (
            <p className="text-sm text-[#4B5563]">Verifying your password recovery link...</p>
          ) : linkError || !recoveryReady ? (
            <div className="space-y-4">
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {linkError || 'Password recovery link is invalid or expired.'}
              </div>
              <Link
                to="/login"
                className="inline-flex items-center rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white"
              >
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {formError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {formError}
                </div>
              )}
              <div>
                <label htmlFor="supabase-new-pw" className="block text-xs font-medium text-[#374151] mb-1">
                  New Password (8+ characters, letter & number)
                </label>
                <input
                  id="supabase-new-pw"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="supabase-confirm-pw" className="block text-xs font-medium text-[#374151] mb-1">
                  Confirm New Password
                </label>
                <input
                  id="supabase-confirm-pw"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A] disabled:opacity-60"
              >
                {submitting ? 'Updating Password...' : 'Save New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function VerifyPhonePage() {
  const { user, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [previewOtp, setPreviewOtp] = useState<string | null>(null);
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ previewOtp?: string; note: string }>('/api/auth/verify-phone/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setPreviewOtp(res.previewOtp || null);
      setStep('confirm');
      showToast('OTP challenge created.', 'info');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/verify-phone/confirm', {
        method: 'POST',
        body: JSON.stringify({ code: otp }),
      });
      await refreshUser();
      showToast('Phone number control verified.', 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#0F2942]">
            <Phone className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold">Phone Verification</h1>
          </div>

          <p className="text-sm text-[#4B5563] leading-relaxed">
            Phone OTP verifies control of your mobile number only. It is never displayed publicly and is not treated as
            proof of legal identity or age.
          </p>

          {!user ? (
            <div className="rounded-lg border border-[#E2E6EC] bg-[#F7F6F2] p-4 text-sm">
              Please{' '}
              <Link to="/login" className="font-semibold text-[#0F2942] underline">
                sign in
              </Link>{' '}
              to verify phone control on your account.
            </div>
          ) : user.phone_verified ? (
            <div className="rounded-lg border border-[#0D7A6F]/30 bg-[#0D7A6F]/5 p-4 text-sm text-[#0F2942]">
              <strong>Phone Control Verified:</strong> Your mobile number is confirmed for account recovery and rate
              protection.
            </div>
          ) : (
            <>
              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              {step === 'request' ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div>
                    <label htmlFor="otp-phone" className="block text-xs font-medium text-[#374151] mb-1">
                      10-digit Indian Mobile Number
                    </label>
                    <input
                      id="otp-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-semibold text-white"
                  >
                    {loading ? 'Sending...' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleConfirmOtp} className="space-y-4">
                  {previewOtp && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
                      Preview Environment Test OTP (SMS provider not connected):{' '}
                      <span className="font-mono font-bold">{previewOtp}</span>
                    </div>
                  )}
                  <div>
                    <label htmlFor="otp-code" className="block text-xs font-medium text-[#374151] mb-1">
                      6-Digit Verification Code
                    </label>
                    <input
                      id="otp-code"
                      type="text"
                      required
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-[#0D7A6F] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {loading ? 'Verifying...' : 'Confirm Code'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('request')}
                      className="text-xs text-[#4B5563] hover:underline"
                    >
                      Change number
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function VerifyIdentityPage() {
  const { user, health, refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [verification, setVerification] = useState<VerificationSummary | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [idType, setIdType] = useState<NationalIdType>('voter_id');
  const [legalName, setLegalName] = useState(user?.display_name || '');
  const [idNumber, setIdNumber] = useState('');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [sessionData, setSessionData] = useState<{
    mode: string;
    bannerNotice: string;
    sessionToken: string;
    challengeCode?: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!legalName && user.display_name) {
      setLegalName(user.display_name);
    }
    setStatusLoading(true);
    apiFetch<{ verification: VerificationSummary | null }>('/api/verification/status')
      .then((res) => setVerification(res.verification))
      .catch(() => setVerification(null))
      .finally(() => setStatusLoading(false));
  }, [user?.id]);

  const selectedOption = NATIONAL_ID_OPTIONS.find((opt) => opt.value === idType) || NATIONAL_ID_OPTIONS[0];
  const liveIdValidation = idNumber.trim() ? validateNationalIdFormat(idType, idNumber) : null;

  const handleSubmitNationalId = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const nameCheck = validateLegalName(legalName);
    if (!nameCheck.valid) {
      setError(nameCheck.error || 'Please enter your legal name as printed on your ID.');
      return;
    }

    const idCheck = validateNationalIdFormat(idType, idNumber);
    if (!idCheck.valid) {
      setError(idCheck.error || 'Please check the National ID number format.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('idType', idType);
      formData.append('legalName', nameCheck.cleaned);
      formData.append('idNumber', idCheck.normalized);
      if (idDocument) {
        formData.append('idDocument', idDocument);
      }

      const res = await apiFetch<{ verification: VerificationSummary }>('/api/verification/national-id', {
        method: 'POST',
        body: formData,
      });

      setVerification(res.verification);
      setIdNumber('');
      setIdDocument(null);
      await refreshUser();
      showToast('National ID submitted for verification review.', 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartTestSession = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        session: { mode: string; bannerNotice: string; sessionToken: string; challengeCode?: string };
      }>('/api/verification/session', { method: 'POST' });
      setSessionData(res.session);
      await refreshUser();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteTest = async (token?: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ verification: VerificationSummary | null }>('/api/verification/complete-test', {
        method: 'POST',
        body: JSON.stringify(token ? { sessionToken: token } : {}),
      });
      setVerification(res.verification);
      await refreshUser();
      showToast('Preview verification completed.', 'success');
      navigate('/reports/create');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const showForm =
    Boolean(user) &&
    user!.identity_status !== 'verified' &&
    user!.identity_status !== 'pending';

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 space-y-6">
        <div className="rounded-xl border border-[#E2E6EC] bg-white p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-2.5 text-[#0F2942]">
            <BadgeCheck className="w-5 h-5 text-[#0D7A6F]" aria-hidden="true" />
            <h1 className="font-display text-2xl font-bold">National ID Verification</h1>
          </div>

          <p className="text-sm text-[#4B5563] leading-relaxed">
            To reduce duplicate accounts and false reporting, each citizen account must verify with one unique National ID
            before submitting civic reports.
          </p>

          <div className="rounded-lg border border-[#0D7A6F]/25 bg-[#0D7A6F]/5 px-4 py-3 text-xs text-[#0F2942] flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-[#0D7A6F] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold">Privacy & Duplicate-Account Protection</p>
              <p className="text-[#374151]">
                Your full ID number is irreversibly hashed on our server to prevent multiple accounts using the same ID
                and is never stored in plain text or shown publicly. Only the last 4 masked digits are retained for
                moderator review. जनConnect is an independent civic platform, not UIDAI or DigiLocker.
              </p>
            </div>
          </div>

          {!user ? (
            <p className="text-sm text-[#4B5563]">
              Please{' '}
              <Link to="/login" className="font-semibold text-[#0F2942] underline">
                sign in
              </Link>{' '}
              to verify your National ID.
            </p>
          ) : statusLoading ? (
            <p className="text-xs text-[#6B7280]">Checking verification status...</p>
          ) : user.identity_status === 'verified' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#0D7A6F]/30 bg-[#0D7A6F]/5 px-4 py-4 text-sm text-[#0F2942] space-y-1">
                <p className="font-semibold">
                  Citizen Identity Verified
                  {verification?.provider_name === 'test_environment_adapter' ? ' (Test Environment)' : ''}
                </p>
                {verification?.id_type && (
                  <p className="text-xs text-[#374151]">
                    Document: <strong>{getNationalIdLabel(verification.id_type)}</strong> · Masked ID:{' '}
                    <span className="font-mono">{verification.id_masked}</span>
                  </p>
                )}
                <p className="text-xs text-[#4B5563]">Your account is cleared to submit civic reports.</p>
              </div>
              <Link
                to="/reports/create"
                className="inline-flex items-center justify-center rounded-lg bg-[#0D7A6F] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A635A]"
              >
                Continue to Report Creation
              </Link>
            </div>
          ) : user.identity_status === 'pending' ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm text-[#0F2942] space-y-1.5">
                <p className="font-semibold inline-flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-700" aria-hidden="true" />
                  <span>National ID Submission Under Review</span>
                </p>
                {verification?.id_type ? (
                  <p className="text-xs text-[#374151]">
                    Submitted: <strong>{getNationalIdLabel(verification.id_type)}</strong> ·{' '}
                    <span className="font-mono">{verification.id_masked}</span>
                    {verification.has_document ? ' · Supporting photo attached' : ''}
                  </p>
                ) : null}
                <p className="text-xs text-[#4B5563]">
                  A जनConnect human moderator will review your verification entry on the Moderator Console before
                  enabling report submission.
                </p>
              </div>

              {!health?.identityProviderConfigured && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-950">
                    TEST ENVIRONMENT — IDENTITY NOT VERIFIED
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    If you are testing solo in local preview without an external KYC provider or separate moderator
                    session, you can complete preview verification below.
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleCompleteTest(sessionData?.sessionToken)}
                    className="rounded-lg bg-[#0F2942] px-4 py-2 text-xs font-semibold text-white hover:bg-[#163A5C] disabled:opacity-60"
                  >
                    {submitting ? 'Completing...' : 'Complete Test Verification (Preview Only)'}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {user && user.identity_status === 'rejected' && verification?.review_note && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900 space-y-1">
              <p className="font-semibold inline-flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" aria-hidden="true" />
                <span>Previous Verification Declined</span>
              </p>
              <p>Reason: {verification.review_note}</p>
              <p>Please submit corrected National ID details below.</p>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSubmitNationalId} className="space-y-4 pt-2 border-t border-[#E2E6EC]">
              {error && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="nid-type" className="block text-xs font-medium text-[#374151] mb-1">
                  National ID Type *
                </label>
                <select
                  id="nid-type"
                  value={idType}
                  onChange={(e) => {
                    setIdType(e.target.value as NationalIdType);
                    setError(null);
                  }}
                  className="w-full rounded-lg border border-[#E2E6EC] bg-white px-3 py-2 text-sm text-[#111827]"
                >
                  {NATIONAL_ID_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[#6B7280]">{selectedOption.formatHint}</p>
              </div>

              <div>
                <label htmlFor="nid-legal-name" className="block text-xs font-medium text-[#374151] mb-1">
                  Full Legal Name (as printed on ID) *
                </label>
                <input
                  id="nid-legal-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="e.g., Asha Rawat"
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="nid-number" className="block text-xs font-medium text-[#374151] mb-1">
                  {selectedOption.label} Number *
                </label>
                <input
                  id="nid-number"
                  type="text"
                  required
                  autoComplete="off"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder={selectedOption.placeholder}
                  className="w-full rounded-lg border border-[#E2E6EC] px-3 py-2 text-sm font-mono uppercase"
                />
                {liveIdValidation && (
                  <p className={`mt-1 text-xs ${liveIdValidation.valid ? 'text-[#0D7A6F]' : 'text-red-700'}`}>
                    {liveIdValidation.valid
                      ? `Format valid · Stored masked as ${liveIdValidation.masked}`
                      : liveIdValidation.error}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="nid-document" className="block text-xs font-medium text-[#374151] mb-1">
                  Supporting ID Card Photo (optional, JPEG/PNG/WebP max 5MB)
                </label>
                <label
                  htmlFor="nid-document"
                  className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#CBD5E1] bg-[#F7F6F2] px-4 py-3 text-xs text-[#374151] cursor-pointer hover:border-[#0F2942]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#0F2942]" aria-hidden="true" />
                    <span>{idDocument ? idDocument.name : 'Choose masked ID photo (EXIF metadata stripped)'}</span>
                  </span>
                  {idDocument && (
                    <span className="font-mono text-[#0D7A6F]">
                      {(idDocument.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </label>
                <input
                  id="nid-document"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setIdDocument(e.target.files?.[0] || null)}
                  className="sr-only"
                />
                {idType === 'aadhaar_vid' && (
                  <p className="mt-1 text-xs text-amber-900">
                    If uploading an Aadhaar card image, please mask the first 8 digits before uploading.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#0F2942] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#163A5C] disabled:opacity-60"
              >
                {submitting ? 'Submitting Securely...' : 'Submit National ID for Verification'}
              </button>

              {!health?.identityProviderConfigured && (
                <div className="pt-3 border-t border-[#E2E6EC] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#4B5563]">
                  <span>TEST ENVIRONMENT — IDENTITY NOT VERIFIED</span>
                  {!sessionData ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={handleStartTestSession}
                      className="font-semibold text-[#0F2942] hover:underline text-left sm:text-right"
                    >
                      Use Dev Test-Environment Shortcut
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleCompleteTest(sessionData.sessionToken)}
                      className="font-semibold text-[#0D7A6F] hover:underline text-left sm:text-right"
                    >
                      Complete Test Verification ({sessionData.challengeCode})
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </AppShell>
  );
}
