-- JanConnect V0.1 — Supabase Storage Buckets & Policies
-- Pending media is strictly private until approved by a human moderator and stripped of EXIF metadata.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('pending-media', 'pending-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  ('published-media', 'published-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Pending media: only uploader and moderators can read; uploader can upload to own folder
CREATE POLICY "Uploader uploads to pending-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pending-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Uploader or moderator reads pending-media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pending-media'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_moderator(auth.uid()))
  );

-- Published media: public read; only service role / edge function writes after EXIF stripping & approval
CREATE POLICY "Public reads published-media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'published-media');
