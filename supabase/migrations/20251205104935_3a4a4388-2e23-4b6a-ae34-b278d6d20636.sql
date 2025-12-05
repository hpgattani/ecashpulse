-- Fix RLS policy so users only see their own bets
DROP POLICY IF EXISTS "Anyone can view bets" ON public.bets;

CREATE POLICY "Users can view their own bets"
ON public.bets
FOR SELECT
USING (auth.uid() = user_id);