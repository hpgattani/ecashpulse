-- Re-apply column-level privilege revokes for sensitive escrow secret columns
-- on public.predictions. These were revoked in prior migrations but the columns
-- were re-added in 20260629134223 which reset column-level ACLs.
REVOKE SELECT (escrow_privkey_encrypted, escrow_script_hex) ON public.predictions FROM anon, authenticated;
REVOKE INSERT (escrow_privkey_encrypted, escrow_script_hex) ON public.predictions FROM anon, authenticated;
REVOKE UPDATE (escrow_privkey_encrypted, escrow_script_hex) ON public.predictions FROM anon, authenticated;

-- Ensure service_role retains full access (edge functions rely on this).
GRANT ALL ON public.predictions TO service_role;