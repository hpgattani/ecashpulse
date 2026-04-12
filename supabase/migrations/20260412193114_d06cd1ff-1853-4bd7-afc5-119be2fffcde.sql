-- 1. Fix sessions table: drop permissive ALL policy, add explicit deny
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.sessions;
CREATE POLICY "No direct access to sessions" ON public.sessions
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2. Fix chat_rate_limits: drop permissive ALL policy, add explicit deny
DROP POLICY IF EXISTS "Service role manages rate limits" ON public.chat_rate_limits;
CREATE POLICY "No direct access to rate limits" ON public.chat_rate_limits
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 3. Fix predictions: revoke SELECT on sensitive columns from anon and authenticated
REVOKE SELECT (escrow_privkey_encrypted) ON public.predictions FROM anon, authenticated;
REVOKE SELECT (escrow_script_hex) ON public.predictions FROM anon, authenticated;