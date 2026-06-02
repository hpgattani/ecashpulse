
-- Drop the avatars SELECT policy entirely. Public bucket files remain accessible
-- via the Storage CDN public URLs without needing a storage.objects SELECT policy.
DROP POLICY IF EXISTS "Avatars readable by exact name" ON storage.objects;

-- has_role is required by RLS policies for signed-in users; block anon callers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
