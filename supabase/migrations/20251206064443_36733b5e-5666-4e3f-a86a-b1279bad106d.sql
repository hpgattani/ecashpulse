-- Allow service role to insert bets (process-bet function uses service role key)
-- First drop the existing restrictive policies and create a proper one for inserts

-- Create policy to allow service role to insert bets
CREATE POLICY "Service role can insert bets" 
ON public.bets 
FOR INSERT 
WITH CHECK (true);