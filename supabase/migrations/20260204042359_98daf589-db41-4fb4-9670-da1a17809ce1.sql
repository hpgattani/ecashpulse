-- Add optional reasoning/note field to bets table
ALTER TABLE public.bets ADD COLUMN IF NOT EXISTS note TEXT;

-- Create weekly rewards tracking table
CREATE TABLE IF NOT EXISTS public.weekly_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 3),
  wins_count INTEGER NOT NULL DEFAULT 0,
  reward_amount BIGINT NOT NULL DEFAULT 0,
  payout_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(week_number, year, rank)
);

-- Enable RLS
ALTER TABLE public.weekly_rewards ENABLE ROW LEVEL SECURITY;

-- Everyone can view weekly rewards (leaderboard is public)
CREATE POLICY "Weekly rewards are publicly viewable"
ON public.weekly_rewards
FOR SELECT
USING (true);

-- Only backend can insert/update rewards
CREATE POLICY "Service role can manage weekly rewards"
ON public.weekly_rewards
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX idx_weekly_rewards_week_year ON public.weekly_rewards(year DESC, week_number DESC);
CREATE INDEX idx_weekly_rewards_user ON public.weekly_rewards(user_id);