import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildSafePasswordResetRedirectUrl, validateNewPassword, validateResetEmail } from '../utils/civicRules';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith('https://') &&
      !supabaseUrl.includes('YOUR_') &&
      !supabaseAnonKey.includes('YOUR_')
  );
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return cachedClient;
}

export const GENERIC_RESET_EMAIL_SENT_MESSAGE =
  'If an account is registered with that email address, a password reset link has been sent. Please check your inbox and spam folder.';

export async function requestSupabasePasswordReset(
  rawEmail: string
): Promise<{ ok: boolean; message: string; error?: string }> {
  const check = validateResetEmail(rawEmail);
  if (!check.valid) {
    return { ok: false, message: '', error: check.error };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      message: '',
      error: 'Supabase Auth is not configured in this environment.',
    };
  }

  const redirectTo = buildSafePasswordResetRedirectUrl(window.location.origin);
  const { error } = await supabase.auth.resetPasswordForEmail(check.email, {
    redirectTo,
  });

  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('rate limit') || error.status === 429) {
      return {
        ok: false,
        message: '',
        error: 'Too many password reset requests. Please wait a minute before trying again.',
      };
    }
    // Avoid exposing account existence for non-rate-limit errors
    return {
      ok: true,
      message: GENERIC_RESET_EMAIL_SENT_MESSAGE,
    };
  }

  return {
    ok: true,
    message: GENERIC_RESET_EMAIL_SENT_MESSAGE,
  };
}

export async function completeSupabasePasswordReset(
  password: string,
  confirmPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const pwCheck = validateNewPassword(password, confirmPassword);
  if (!pwCheck.valid) {
    return { ok: false, error: pwCheck.error };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: 'Supabase Auth is not configured.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: error.message || 'Could not update password. Your reset link may have expired.' };
  }

  await supabase.auth.signOut().catch(() => undefined);
  return { ok: true };
}
