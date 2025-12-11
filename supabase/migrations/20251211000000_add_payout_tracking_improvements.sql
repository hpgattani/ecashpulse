-- Add indexes for efficient payout queries
CREATE INDEX IF NOT EXISTS idx_bets_status_payout ON public.bets(status, payout_tx_hash) 
  WHERE status = 'won';

CREATE INDEX IF NOT EXISTS idx_bets_prediction_status ON public.bets(prediction_id, status);

-- Add index for faster user payout queries
CREATE INDEX IF NOT EXISTS idx_bets_user_status ON public.bets(user_id, status);

-- Add sent_at timestamp to track when payouts were actually sent
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS payout_sent_at TIMESTAMP WITH TIME ZONE;

-- Update existing won bets that have payout_tx_hash but no payout_sent_at
UPDATE public.bets 
SET payout_sent_at = confirmed_at 
WHERE status = 'won' 
  AND payout_tx_hash IS NOT NULL 
  AND payout_sent_at IS NULL;

-- Create a view for easy payout monitoring
CREATE OR REPLACE VIEW public.pending_payouts AS
SELECT 
  b.id as bet_id,
  b.user_id,
  u.ecash_address,
  b.prediction_id,
  p.title as prediction_title,
  b.amount as bet_amount,
  b.payout_amount,
  b.created_at as bet_created_at,
  b.confirmed_at as bet_confirmed_at,
  p.resolved_at as prediction_resolved_at
FROM public.bets b
JOIN public.users u ON b.user_id = u.id
JOIN public.predictions p ON b.prediction_id = p.id
WHERE b.status = 'won' 
  AND b.payout_tx_hash IS NULL
  AND b.payout_amount > 0
ORDER BY p.resolved_at ASC;

-- Create a view for completed payouts
CREATE OR REPLACE VIEW public.completed_payouts AS
SELECT 
  b.id as bet_id,
  b.user_id,
  u.ecash_address,
  b.prediction_id,
  p.title as prediction_title,
  b.amount as bet_amount,
  b.payout_amount,
  b.payout_tx_hash,
  b.payout_sent_at,
  p.resolved_at as prediction_resolved_at,
  (b.payout_sent_at - p.resolved_at) as payout_delay
FROM public.bets b
JOIN public.users u ON b.user_id = u.id
JOIN public.predictions p ON b.prediction_id = p.id
WHERE b.status = 'won' 
  AND b.payout_tx_hash IS NOT NULL
ORDER BY b.payout_sent_at DESC;

-- Add RLS policies for the views
ALTER VIEW public.pending_payouts OWNER TO postgres;
ALTER VIEW public.completed_payouts OWNER TO postgres;

-- Grant SELECT on views
GRANT SELECT ON public.pending_payouts TO authenticated, anon;
GRANT SELECT ON public.completed_payouts TO authenticated, anon;

-- Create a function to get total pending payout amount
CREATE OR REPLACE FUNCTION public.get_total_pending_payouts()
RETURNS TABLE (
  total_amount BIGINT,
  bet_count INTEGER,
  user_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(payout_amount), 0)::BIGINT as total_amount,
    COUNT(*)::INTEGER as bet_count,
    COUNT(DISTINCT user_id)::INTEGER as user_count
  FROM public.bets
  WHERE status = 'won' 
    AND payout_tx_hash IS NULL
    AND payout_amount > 0;
END;
$$;

-- Create a function to get payout statistics
CREATE OR REPLACE FUNCTION public.get_payout_stats()
RETURNS TABLE (
  total_paid_out BIGINT,
  total_paid_bets INTEGER,
  avg_payout_time_minutes INTEGER,
  fastest_payout_minutes INTEGER,
  slowest_payout_minutes INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(b.payout_amount), 0)::BIGINT as total_paid_out,
    COUNT(*)::INTEGER as total_paid_bets,
    COALESCE(AVG(EXTRACT(EPOCH FROM (b.payout_sent_at - p.resolved_at)) / 60)::INTEGER, 0) as avg_payout_time_minutes,
    COALESCE(MIN(EXTRACT(EPOCH FROM (b.payout_sent_at - p.resolved_at)) / 60)::INTEGER, 0) as fastest_payout_minutes,
    COALESCE(MAX(EXTRACT(EPOCH FROM (b.payout_sent_at - p.resolved_at)) / 60)::INTEGER, 0) as slowest_payout_minutes
  FROM public.bets b
  JOIN public.predictions p ON b.prediction_id = p.id
  WHERE b.status = 'won' 
    AND b.payout_tx_hash IS NOT NULL
    AND b.payout_sent_at IS NOT NULL
    AND p.resolved_at IS NOT NULL;
END;
$$;

-- Add a trigger to automatically set payout_sent_at when payout_tx_hash is set
CREATE OR REPLACE FUNCTION public.set_payout_sent_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.payout_tx_hash IS NOT NULL AND OLD.payout_tx_hash IS NULL THEN
    NEW.payout_sent_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_payout_sent_at
  BEFORE UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_payout_sent_at();

-- Add comment for documentation
COMMENT ON COLUMN public.bets.payout_sent_at IS 'Timestamp when the payout transaction was broadcast to the blockchain';
COMMENT ON VIEW public.pending_payouts IS 'Bets that won but have not been paid out yet';
COMMENT ON VIEW public.completed_payouts IS 'Bets that have been successfully paid out with transaction hash';
COMMENT ON FUNCTION public.get_total_pending_payouts IS 'Returns total amount, bet count, and user count for pending payouts';
COMMENT ON FUNCTION public.get_payout_stats IS 'Returns statistics about completed payouts including timing metrics';

