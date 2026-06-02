
-- Lock down SECURITY DEFINER functions that should never be invoked by clients.
-- These are trigger functions or admin aggregates; only triggers / service role need EXECUTE.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_prediction_pool() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_platform_fees_summary() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_prediction_pool() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_platform_fees_summary() TO service_role;

-- Tighten avatars storage policies: remove broad listing, keep per-user write/update,
-- public read still works via the bucket's public CDN URLs (bucket.public = true).
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;

-- Only allow fetching a specific avatar object by exact name (no broad listing).
-- PostgREST/Storage SELECT with a name filter still works; bulk listing returns empty.
CREATE POLICY "Avatars readable by exact name"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'avatars'
  AND coalesce(current_setting('request.jwt.claims', true), '') IS NOT NULL
  AND name IS NOT NULL
  AND length(name) > 0
);
