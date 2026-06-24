ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS tx_hash text,
  ADD COLUMN IF NOT EXISTS payment_id text,
  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS bet_audit_log_auth_tx_hash_unique
  ON public.bet_audit_log (event_type, lower(tx_hash))
  WHERE event_type = 'auth_tx_used' AND tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS sessions_wallet_auth_tx_idx
  ON public.sessions (user_id, tx_hash, payment_id, created_at DESC)
  WHERE source = 'wallet_auth';