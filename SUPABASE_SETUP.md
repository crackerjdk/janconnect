# JanConnect V0.1 — Supabase & Environment Setup Guide

JanConnect is built with a clean separation between its **Supabase PostgreSQL / Auth / Storage / Edge Function architecture** (in `/supabase`) and its **local V0.1 SQLite + Express runtime** (in `/server.ts`) so you can run, test, and verify every citizen and moderator workflow immediately even before connecting a Supabase project.

## 1. Environment Variables

Configure these in your deployment environment (or AI Studio **Settings > Secrets** for server-side secrets):

| Variable | Scope | Purpose |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | Client & Server | Your Supabase project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Client (Public) | Supabase anonymous/public key (safe for browser with RLS enabled) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server Only** | Privileged service key for Edge Functions / admin tasks. **Never** prefix with `VITE_` |
| `GEMINI_API_KEY` | **Server Only** | Optional server-side Gemini API key for moderator AI assist (`/api/admin/reports/:id/ai-assist`) |
| `MODERATOR_PASSCODE` | **Server Only** | Optional passcode for moderator sign-in. When unset, `/admin/login` offers a one-time first-run claim flow |
| `SESSION_SECRET` | **Server Only** | HMAC signing secret for local session tokens (uses ephemeral random bytes if unset) |
| `VITE_GOOGLE_MAPS_API_KEY` | Client (Optional) | Optional Google Maps API key; manual Uttarakhand hierarchy selector works without it |
| `VITE_MAPBOX_ACCESS_TOKEN` | Client (Optional) | Optional Mapbox token; manual Uttarakhand hierarchy selector works without it |
| `VITE_AGE_CONSENT_GATE_MODE` | Client | `"gated"` (default) until legal & child-safety review is completed |

## 2. Connecting Supabase Cloud

1. Create a new Supabase project at `https://supabase.com/dashboard`.
2. Run the database schema, Uttarakhand location seeds, and Row-Level Security (RLS) policies:
   - Execute `supabase/migrations/001_schema_and_rls.sql` in the Supabase SQL Editor (or via `supabase db push`).
3. Provision private and public storage buckets:
   - Execute `supabase/migrations/002_storage_and_policies.sql`.
4. Deploy the privileged Edge Functions:
   - `supabase functions deploy submit-report`
   - `supabase functions deploy moderate-report`
   - Set `SUPABASE_SERVICE_ROLE_KEY` in Supabase Edge Function secrets.
5. Configure Password Reset & Phone OTP:
   - Under Supabase **Authentication → URL Configuration → Redirect URLs**, add `http://localhost:3000/reset-password` and your production `<APP_URL>/reset-password` so Forgot Password emails return to `/reset-password`.
   - Enable Phone Auth in Supabase Authentication -> Providers and configure an SMS provider (Twilio/MessageBird) if using SMS OTP. Note: Phone OTP only verifies control of a phone number and is never treated as proof of identity or age.
6. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to your environment and restart the server.

## 3. Legal & Child-Safety Gate Before Production Launch

JanConnect is designed for all ages, **but production all-ages registration must remain gated** until an adult project operator and qualified legal/privacy reviewer approve:
- Age-assurance and parental/guardian consent workflows
- Data retention and minor privacy protections (zero public display of phone numbers, DOB, school info, or exact coordinates)
- Terms of Use, Privacy Notice, and Grievance Officer contact details.
