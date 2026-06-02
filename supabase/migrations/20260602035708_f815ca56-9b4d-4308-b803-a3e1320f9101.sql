-- 1) Lock down the avatars storage bucket so users can only manage files in
--    their own folder (path prefix = their session-derived user id).
--    The existing "Service role can manage avatars" policy was incorrectly
--    targeted at the {public} role, granting ALL operations to everyone.
DROP POLICY IF EXISTS "Service role can manage avatars" ON storage.objects;

CREATE POLICY "Service role can manage avatars"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Users can upload to their own avatar folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2) Hide encrypted escrow private key material from public/Data API reads.
--    Keep the table publicly readable for normal columns, but revoke SELECT
--    on the sensitive columns and grant SELECT on the safe column set only.
REVOKE SELECT ON public.predictions FROM anon, authenticated;

GRANT SELECT (
  id,
  title,
  description,
  category,
  image_url,
  end_date,
  status,
  yes_pool,
  no_pool,
  escrow_address,
  resolved_at,
  created_at,
  updated_at,
  creator_id,
  resolution_date
) ON public.predictions TO anon, authenticated;

-- Service role retains full access for edge functions.
GRANT ALL ON public.predictions TO service_role;

-- 3) Remove the bets table from the Realtime publication. The bets table
--    contains per-user financial data and the realtime.messages policy
--    is currently unscoped, so every authenticated subscriber would receive
--    every other user's bet events. MyBets continues to refresh via
--    edge-function fetches on user actions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'bets'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.bets';
  END IF;
END $$;