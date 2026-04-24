-- 1. Drop the overly permissive public SELECT policy on predictions
DROP POLICY IF EXISTS "Anyone can view predictions" ON public.predictions;

-- 2. Replace it with a deny-all SELECT policy for anon/authenticated.
-- Edge functions use the service role and bypass RLS, so they keep full access.
CREATE POLICY "No direct public read of predictions"
  ON public.predictions
  FOR SELECT
  TO anon, authenticated
  USING (false);

-- 3. Create a safe public view that excludes sensitive escrow key material.
CREATE OR REPLACE VIEW public.predictions_public
WITH (security_invoker = on) AS
SELECT
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
  resolution_date,
  resolved_at,
  created_at,
  updated_at,
  creator_id
FROM public.predictions;

-- 4. Allow public read access to the safe view.
GRANT SELECT ON public.predictions_public TO anon, authenticated;

-- 5. Re-add a SELECT policy on the base table scoped to the safe columns via the view.
-- The view uses security_invoker, so it needs the underlying table to allow SELECT
-- for the querying role. We allow SELECT on the base table but the view explicitly
-- omits the sensitive columns. To prevent direct base-table reads of secrets,
-- we revoke column-level SELECT on the sensitive columns from anon/authenticated.
CREATE POLICY "Public can read prediction data via base table"
  ON public.predictions
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 6. Drop the deny policy now that column-level grants will protect secrets.
DROP POLICY IF EXISTS "No direct public read of predictions" ON public.predictions;

-- 7. Revoke column-level SELECT on sensitive columns from public roles.
REVOKE SELECT (escrow_privkey_encrypted, escrow_script_hex) ON public.predictions FROM anon, authenticated;

-- 8. Grant SELECT on all OTHER columns explicitly to anon/authenticated.
GRANT SELECT (
  id, title, description, category, image_url, end_date, status,
  yes_pool, no_pool, escrow_address, resolution_date, resolved_at,
  created_at, updated_at, creator_id
) ON public.predictions TO anon, authenticated;