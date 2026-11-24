-- JanConnect V0.1 — Supabase PostgreSQL Schema & Row-Level Security
-- Launch Geography: Uttarakhand, India (extensible to all Indian states)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE SCHEMA IF NOT EXISTS restricted_identity;

-- 1. LOCATIONS (India -> State -> District -> Block/Municipality -> Village/Locality)
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES public.locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('country', 'state', 'district', 'block', 'locality')),
  state_code TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_parent ON public.locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_locations_type_state ON public.locations(type, state_code);

-- 2. ORGANIZATIONS & DEPARTMENTS (Future institutional adoption; not active government endorsement in V0.1)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  organization_type TEXT NOT NULL CHECK (organization_type IN ('civic_partner', 'municipality', 'state_department', 'independent_audit')),
  registration_reference TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  state_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROFILES (Minimal public identity; never stores passwords, OTPs, Aadhaar, DOB, or exact coordinates)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) >= 3 AND char_length(username) <= 32 AND username ~ '^[a-z0-9_]+$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 60),
  avatar_url TEXT,
  bio TEXT CHECK (bio IS NULL OR char_length(bio) <= 240),
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'restricted', 'suspended')),
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  identity_status TEXT NOT NULL DEFAULT 'unverified' CHECK (identity_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired')),
  age_consent_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE VIEW public.public_profiles_view AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.bio,
  l.name AS general_area,
  p.created_at
FROM public.profiles p
LEFT JOIN public.locations l ON l.id = p.location_id
WHERE p.account_status = 'active';

-- 4. USER ROLES (Only citizen, moderator, administrator active in V0.1)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('citizen', 'moderator', 'administrator', 'government_officer', 'contractor')),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);

-- 5. RESTRICTED VERIFICATION RECORDS (Isolated outside public API schema)
CREATE TABLE IF NOT EXISTS restricted_identity.verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  id_type TEXT CHECK (id_type IN ('voter_id', 'driving_licence', 'passport', 'pan', 'aadhaar_vid')),
  legal_name TEXT,
  id_masked TEXT,
  id_number_hash TEXT,
  document_storage_path TEXT,
  document_media_type TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('pending', 'verified', 'rejected', 'expired')),
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_national_id
  ON restricted_identity.verification_records(id_type, id_number_hash)
  WHERE id_type IS NOT NULL AND id_number_hash IS NOT NULL AND verification_status IN ('pending', 'verified');

-- Helper functions for RLS role verification (non-exposed schema)
CREATE OR REPLACE FUNCTION restricted_identity.is_moderator(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role IN ('moderator', 'administrator')
  );
$$;

CREATE OR REPLACE FUNCTION restricted_identity.is_administrator(uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = 'administrator'
  );
$$;

-- 6. COMPLAINTS (Civic reports; private until moderated & published)
CREATE TABLE IF NOT EXISTS public.complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) >= 8 AND char_length(title) <= 140),
  description TEXT NOT NULL CHECK (char_length(description) >= 20 AND char_length(description) <= 3000),
  category TEXT NOT NULL CHECK (category IN (
    'Roads and Transportation',
    'Water Supply',
    'Electricity',
    'Drainage and Sanitation',
    'Government Hospitals',
    'Education',
    'Public Infrastructure',
    'Public Safety and Accessibility',
    'Environment and Public Spaces',
    'Government Services',
    'Other Civic Problems'
  )),
  location_id UUID NOT NULL REFERENCES public.locations(id),
  generalized_location TEXT NOT NULL,
  restricted_latitude DOUBLE PRECISION,
  restricted_longitude DOUBLE PRECISION,
  platform_status TEXT NOT NULL DEFAULT 'submitted' CHECK (platform_status IN (
    'submitted',
    'under_review',
    'additional_information_required',
    'published',
    'rejected',
    'removed'
  )),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_complaints_status_vis ON public.complaints(platform_status, visibility);
CREATE INDEX IF NOT EXISTS idx_complaints_user ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_location ON public.complaints(location_id);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON public.complaints(category);

CREATE OR REPLACE VIEW public.public_complaints_view AS
SELECT
  c.id,
  c.title,
  c.description,
  c.category,
  c.location_id,
  c.generalized_location,
  c.platform_status,
  c.created_at,
  c.published_at,
  (SELECT COUNT(*) FROM public.complaint_support s WHERE s.complaint_id = c.id) AS support_count
FROM public.complaints c
WHERE c.platform_status = 'published' AND c.visibility = 'public';

-- 7. COMPLAINT MEDIA
CREATE TABLE IF NOT EXISTS public.complaint_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4')),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. COMPLAINT SUPPORT (Unique 1 active support per user per report)
CREATE TABLE IF NOT EXISTS public.complaint_support (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (complaint_id, user_id)
);

-- 9. COMPLAINT COMMENTS
CREATE TABLE IF NOT EXISTS public.complaint_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) >= 2 AND char_length(content) <= 1000),
  moderation_status TEXT NOT NULL DEFAULT 'approved' CHECK (moderation_status IN ('approved', 'flagged', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. COMPLAINT STATUS HISTORY (Append-only)
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. MODERATION ACTIONS (Append-only)
CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id UUID NOT NULL REFERENCES public.profiles(id),
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('start_review', 'request_info', 'publish', 'reject', 'remove')),
  reason TEXT NOT NULL,
  previous_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. REPORTS (Content & user safety reports)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('complaint', 'comment', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) >= 5 AND char_length(reason) <= 600),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'resolved_removed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  related_id UUID,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. AUDIT LOGS (Append-only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.prevent_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table: updates and deletes are prohibited';
END;
$$;

DROP TRIGGER IF EXISTS trg_status_history_immutable ON public.complaint_status_history;
CREATE TRIGGER trg_status_history_immutable
  BEFORE UPDATE OR DELETE ON public.complaint_status_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

DROP TRIGGER IF EXISTS trg_moderation_actions_immutable ON public.moderation_actions;
CREATE TRIGGER trg_moderation_actions_immutable
  BEFORE UPDATE OR DELETE ON public.moderation_actions
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_mutation();

-- ROW-LEVEL SECURITY
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restricted_identity.verification_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Locations readable by all" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR restricted_identity.is_moderator(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id AND identity_status = 'unverified' AND account_status = 'active');
CREATE POLICY "Users update own public profile fields" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND identity_status = (SELECT identity_status FROM public.profiles WHERE id = auth.uid())
    AND account_status = (SELECT account_status FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id OR restricted_identity.is_administrator(auth.uid()));
CREATE POLICY "Only admins manage roles" ON public.user_roles
  FOR ALL USING (restricted_identity.is_administrator(auth.uid()))
  WITH CHECK (restricted_identity.is_administrator(auth.uid()));

CREATE POLICY "Citizens read own or published complaints" ON public.complaints
  FOR SELECT USING (
    auth.uid() = user_id
    OR restricted_identity.is_moderator(auth.uid())
    OR (platform_status = 'published' AND visibility = 'public')
  );
CREATE POLICY "Verified active citizens insert private submitted complaints" ON public.complaints
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND platform_status = 'submitted'
    AND visibility = 'private'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_status = 'active' AND p.identity_status = 'verified'
    )
  );
CREATE POLICY "Only moderators update complaints" ON public.complaints
  FOR UPDATE USING (restricted_identity.is_moderator(auth.uid()))
  WITH CHECK (restricted_identity.is_moderator(auth.uid()));

CREATE POLICY "Media visible to uploader, moderator, or if approved on published report" ON public.complaint_media
  FOR SELECT USING (
    auth.uid() = uploader_id
    OR restricted_identity.is_moderator(auth.uid())
    OR (review_status = 'approved' AND EXISTS (
      SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.platform_status = 'published' AND c.visibility = 'public'
    ))
  );
CREATE POLICY "Uploader inserts pending media" ON public.complaint_media
  FOR INSERT WITH CHECK (auth.uid() = uploader_id AND review_status = 'pending');

CREATE POLICY "Users read own support" ON public.complaint_support
  FOR SELECT USING (auth.uid() = user_id OR restricted_identity.is_moderator(auth.uid()));
CREATE POLICY "Citizens support published reports once" ON public.complaint_support
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.platform_status = 'published' AND c.visibility = 'public'
    )
  );
CREATE POLICY "Citizens remove own support" ON public.complaint_support
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public reads approved comments on published reports" ON public.complaint_comments
  FOR SELECT USING (
    (moderation_status = 'approved' AND EXISTS (
      SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.platform_status = 'published' AND c.visibility = 'public'
    ))
    OR auth.uid() = user_id
    OR restricted_identity.is_moderator(auth.uid())
  );
CREATE POLICY "Authenticated citizens comment on published reports" ON public.complaint_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND moderation_status = 'approved' AND EXISTS (
      SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.platform_status = 'published' AND c.visibility = 'public'
    )
  );

CREATE POLICY "Status history readable by owner or moderator" ON public.complaint_status_history
  FOR SELECT USING (
    restricted_identity.is_moderator(auth.uid())
    OR EXISTS (SELECT 1 FROM public.complaints c WHERE c.id = complaint_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Only moderators record moderation actions" ON public.moderation_actions
  FOR ALL USING (restricted_identity.is_moderator(auth.uid()))
  WITH CHECK (restricted_identity.is_moderator(auth.uid()));

CREATE POLICY "Reporters see own flags; moderators see all" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id OR restricted_identity.is_moderator(auth.uid()));
CREATE POLICY "Citizens can flag content" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id AND review_status = 'pending');

CREATE POLICY "Recipients read and mark own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients mark own notifications read" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Moderators read audit logs" ON public.audit_logs
  FOR SELECT USING (restricted_identity.is_moderator(auth.uid()));
