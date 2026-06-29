ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS escrow_privkey_encrypted text,
  ADD COLUMN IF NOT EXISTS escrow_script_hex text;