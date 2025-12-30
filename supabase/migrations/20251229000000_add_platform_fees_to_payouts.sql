-- Add platform fee tracking to bets table
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS platform_fee BIGINT DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.bets.platform_fee IS 'Platform fee deducted from payout (in satoshis)';

-- Create view for platform fee analytics
CREATE OR REPLACE VIEW public.platform_fee_analytics AS
SELECT 
  DATE_TRUNC('day', payout_sent_at) as date,
  COUNT(*) as payouts_count,
  SUM(payout_amount) as total_gross_payouts,
  SUM(platform_fee) as total_fees_collected,
  SUM(payout_amount - platform_fee) as total_net_payouts,
  AVG(platform_fee::FLOAT / NULLIF(payout_amount, 0) * 100) as avg_fee_percent
FROM public.bets
WHERE status = 'won' 
  AND payout_tx_hash IS NOT NULL
  AND payout_sent_at IS NOT NULL
GROUP BY DATE_TRUNC('day', payout_sent_at)
ORDER BY date DESC;

-- Grant access to view
GRANT SELECT ON public.platform_fee_analytics TO authenticated, anon;

-- Create function to get total fees collected
CREATE OR REPLACE FUNCTION public.get_platform_fees_summary()
RETURNS TABLE (
  total_fees_all_time BIGINT,
  total_fees_this_month BIGINT,
  total_fees_this_week BIGINT,
  total_fees_today BIGINT,
  total_payouts_count INTEGER,
  average_fee_amount BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(platform_fee), 0)::BIGINT as total_fees_all_time,
    COALESCE(SUM(CASE 
      WHEN payout_sent_at >= DATE_TRUNC('month', NOW()) 
      THEN platform_fee ELSE 0 
    END), 0)::BIGINT as total_fees_this_month,
    COALESCE(SUM(CASE 
      WHEN payout_sent_at >= DATE_TRUNC('week', NOW()) 
      THEN platform_fee ELSE 0 
    END), 0)::BIGINT as total_fees_this_week,
    COALESCE(SUM(CASE 
      WHEN payout_sent_at >= DATE_TRUNC('day', NOW()) 
      THEN platform_fee ELSE 0 
    END), 0)::BIGINT as total_fees_today,
    COUNT(*)::INTEGER as total_payouts_count,
    COALESCE(AVG(platform_fee), 0)::BIGINT as average_fee_amount
  FROM public.bets
  WHERE status = 'won' 
    AND payout_tx_hash IS NOT NULL
    AND platform_fee > 0;
END;
$$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_bets_platform_fee ON public.bets(platform_fee) 
  WHERE platform_fee > 0;

CREATE INDEX IF NOT EXISTS idx_bets_payout_sent_at ON public.bets(payout_sent_at) 
  WHERE payout_sent_at IS NOT NULL;

