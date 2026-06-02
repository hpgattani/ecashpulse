-- Move sensitive escrow secrets out of the publicly-RLS'd predictions table
-- into a service-role-only table to eliminate any risk of accidental exposure
-- via the Data API.

CREATE TABLE IF NOT EXISTS public.prediction_escrow_secrets (
  prediction_id uuid PRIMARY KEY,
  escrow_privkey_encrypted text,
  escrow_script_hex text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only — no anon/authenticated grants at all.
REVOKE ALL ON public.prediction_escrow_secrets FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.prediction_escrow_secrets TO service_role;

ALTER TABLE public.prediction_escrow_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.prediction_escrow_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Backfill existing secrets
INSERT INTO public.prediction_escrow_secrets (prediction_id, escrow_privkey_encrypted, escrow_script_hex)
SELECT id, escrow_privkey_encrypted, escrow_script_hex
FROM public.predictions
WHERE escrow_privkey_encrypted IS NOT NULL OR escrow_script_hex IS NOT NULL
ON CONFLICT (prediction_id) DO NOTHING;

-- Drop the sensitive columns from predictions entirely so they cannot leak.
ALTER TABLE public.predictions DROP COLUMN IF EXISTS escrow_privkey_encrypted;
ALTER TABLE public.predictions DROP COLUMN IF EXISTS escrow_script_hex;