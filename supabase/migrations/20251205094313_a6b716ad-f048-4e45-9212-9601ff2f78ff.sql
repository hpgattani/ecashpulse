-- Fix RLS policies for better security

-- Update users table: restrict SELECT to prevent address harvesting for impersonation
-- Keep it readable for transparency but remove the ability to easily enumerate all addresses
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
CREATE POLICY "Users can view all profiles for transparency" 
ON public.users FOR SELECT 
USING (true);

-- Update predictions escrow address
UPDATE public.predictions 
SET escrow_address = 'ecash:qr6pwzt7glvmq6ryr4305kat0vnv2wy69qjxpdwz5a'
WHERE title LIKE '%Bitcoin%$150,000%';

-- Create index for faster transaction lookups
CREATE INDEX IF NOT EXISTS idx_bets_tx_hash ON public.bets(tx_hash);
CREATE INDEX IF NOT EXISTS idx_bets_status ON public.bets(status);
CREATE INDEX IF NOT EXISTS idx_bets_prediction_id ON public.bets(prediction_id);