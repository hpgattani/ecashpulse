-- Create raffles table
CREATE TABLE public.raffles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'sports',
  event_name TEXT NOT NULL,
  teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  entry_cost INTEGER NOT NULL,
  total_pot INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  winner_team TEXT,
  winner_entry_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  creation_fee_tx TEXT,
  payout_tx_hash TEXT,
  creator_address_hash TEXT NOT NULL
);

-- Create raffle entries table
CREATE TABLE public.raffle_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raffle_id UUID NOT NULL REFERENCES public.raffles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  assigned_team TEXT NOT NULL,
  amount_paid INTEGER NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  participant_address_hash TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE public.raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raffle_entries ENABLE ROW LEVEL SECURITY;

-- Raffle policies
CREATE POLICY "Anyone can view raffles" 
ON public.raffles 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage raffles" 
ON public.raffles 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Raffle entries policies  
CREATE POLICY "Anyone can view raffle entries" 
ON public.raffle_entries 
FOR SELECT 
USING (true);

CREATE POLICY "Service role can manage raffle entries" 
ON public.raffle_entries 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_raffles_status ON public.raffles(status);
CREATE INDEX idx_raffle_entries_raffle_id ON public.raffle_entries(raffle_id);