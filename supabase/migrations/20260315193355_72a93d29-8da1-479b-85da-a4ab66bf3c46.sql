
ALTER TABLE public.predictions 
ADD COLUMN IF NOT EXISTS escrow_privkey_encrypted TEXT,
ADD COLUMN IF NOT EXISTS escrow_script_hex TEXT;

COMMENT ON COLUMN public.predictions.escrow_privkey_encrypted IS 'Encrypted private key (hex) for per-prediction escrow wallet';
COMMENT ON COLUMN public.predictions.escrow_script_hex IS 'P2SH escrow script hex for on-chain verification';
