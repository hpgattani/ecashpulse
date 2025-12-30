-- Fix function search path security issue
CREATE OR REPLACE FUNCTION public.get_platform_fees_summary()
RETURNS TABLE (
  total_fees_collected bigint,
  total_payouts_sent bigint,
  total_paid_bets bigint,
  avg_fee_per_payout numeric,
  last_payout_date timestamptz
) 
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
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

-- Drop and recreate view with SECURITY INVOKER (default, explicit for clarity)
DROP VIEW IF EXISTS platform_fee_analytics;

CREATE VIEW platform_fee_analytics 
WITH (security_invoker = true)
AS
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