-- Add platform_fee column to bets table
ALTER TABLE public.bets
ADD COLUMN IF NOT EXISTS platform_fee bigint DEFAULT 0;

-- Create index for platform fee queries
CREATE INDEX IF NOT EXISTS idx_bets_platform_fee ON public.bets(platform_fee) WHERE platform_fee > 0;

-- Create index for payout tracking
CREATE INDEX IF NOT EXISTS idx_bets_payout_tx_hash ON public.bets(payout_tx_hash) WHERE payout_tx_hash IS NOT NULL;

-- Create index for status and date queries
CREATE INDEX IF NOT EXISTS idx_bets_status_confirmed ON public.bets(status, confirmed_at) WHERE status IN ('won', 'lost');

-- Create platform_fee_analytics view for daily fee tracking
CREATE OR REPLACE VIEW platform_fee_analytics AS
SELECT 
  DATE(confirmed_at) as date,
  COUNT(*) FILTER (WHERE platform_fee > 0) as total_payouts,
  COALESCE(SUM(platform_fee), 0) as total_fees_xec,
  COALESCE(SUM(payout_amount), 0) as total_payouts_xec,
  COALESCE(AVG(platform_fee), 0) as avg_fee_xec
FROM public.bets
WHERE status = 'won' AND payout_tx_hash IS NOT NULL
GROUP BY DATE(confirmed_at)
ORDER BY date DESC;

-- Create function to get platform fees summary
CREATE OR REPLACE FUNCTION get_platform_fees_summary()
RETURNS TABLE (
  total_fees_collected bigint,
  total_payouts_sent bigint,
  total_paid_bets bigint,
  avg_fee_per_payout numeric,
  last_payout_date timestamptz
) 
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE(SUM(platform_fee), 0)::bigint as total_fees_collected,
    COALESCE(SUM(payout_amount), 0)::bigint as total_payouts_sent,
    COUNT(*)::bigint as total_paid_bets,
    COALESCE(AVG(platform_fee), 0)::numeric as avg_fee_per_payout,
    MAX(confirmed_at) as last_payout_date
  FROM public.bets
  WHERE status = 'won' AND payout_tx_hash IS NOT NULL;
$$;