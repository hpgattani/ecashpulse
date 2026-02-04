-- Drop the weekly_rewards table and create monthly_rewards instead
DROP TABLE IF EXISTS public.weekly_rewards;

-- Create monthly rewards table for top 1 predictor
CREATE TABLE IF NOT EXISTS public.monthly_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  wins_count INTEGER NOT NULL DEFAULT 0,
  total_profit BIGINT NOT NULL DEFAULT 0,
  reward_amount BIGINT NOT NULL DEFAULT 0,
  payout_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

-- Enable RLS
ALTER TABLE public.monthly_rewards ENABLE ROW LEVEL SECURITY;

-- Everyone can view monthly rewards (leaderboard is public)
CREATE POLICY "Monthly rewards are publicly viewable"
ON public.monthly_rewards
FOR SELECT
USING (true);

-- Only backend can insert/update rewards
CREATE POLICY "Service role can manage monthly rewards"
ON public.monthly_rewards
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_monthly_rewards_year_month ON public.monthly_rewards(year DESC, month DESC);
CREATE INDEX idx_monthly_rewards_user ON public.monthly_rewards(user_id);