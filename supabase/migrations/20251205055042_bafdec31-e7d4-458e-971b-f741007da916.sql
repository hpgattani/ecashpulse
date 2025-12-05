-- Create enum for bet positions
CREATE TYPE public.bet_position AS ENUM ('yes', 'no');

-- Create enum for bet status
CREATE TYPE public.bet_status AS ENUM ('pending', 'confirmed', 'won', 'lost', 'refunded');

-- Create enum for prediction status
CREATE TYPE public.prediction_status AS ENUM ('active', 'resolved_yes', 'resolved_no', 'cancelled');

-- Users table - login via eCash address
CREATE TABLE public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ecash_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_login_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Predictions/Markets table
CREATE TABLE public.predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'crypto',
  image_url TEXT,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status public.prediction_status NOT NULL DEFAULT 'active',
  yes_pool BIGINT NOT NULL DEFAULT 0, -- in satoshis (XEC)
  no_pool BIGINT NOT NULL DEFAULT 0,
  escrow_address TEXT NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bets table
CREATE TABLE public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  prediction_id UUID REFERENCES public.predictions(id) ON DELETE CASCADE NOT NULL,
  position public.bet_position NOT NULL,
  amount BIGINT NOT NULL, -- in satoshis (XEC)
  tx_hash TEXT UNIQUE,
  status public.bet_status NOT NULL DEFAULT 'pending',
  payout_amount BIGINT,
  payout_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Platform fees tracking
CREATE TABLE public.platform_fees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bet_id UUID REFERENCES public.bets(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL, -- 1% fee in satoshis
  tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Users policies - users can read their own data
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (true); -- Anyone can see addresses

CREATE POLICY "Users can insert during registration"
  ON public.users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (id = auth.uid()::uuid);

-- Predictions policies - public read, admin write
CREATE POLICY "Anyone can view predictions"
  ON public.predictions FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage predictions"
  ON public.predictions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Bets policies
CREATE POLICY "Anyone can view bets"
  ON public.bets FOR SELECT
  USING (true);

CREATE POLICY "Users can create bets"
  ON public.bets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update bets"
  ON public.bets FOR UPDATE
  USING (true);

-- Platform fees - service role only
CREATE POLICY "Service can manage fees"
  ON public.platform_fees FOR ALL
  USING (true);

-- Function to update prediction pools
CREATE OR REPLACE FUNCTION public.update_prediction_pool()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    IF NEW.position = 'yes' THEN
      UPDATE public.predictions
      SET yes_pool = yes_pool + NEW.amount,
          updated_at = now()
      WHERE id = NEW.prediction_id;
    ELSE
      UPDATE public.predictions
      SET no_pool = no_pool + NEW.amount,
          updated_at = now()
      WHERE id = NEW.prediction_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger for pool updates
CREATE TRIGGER update_pool_on_bet_confirm
  AFTER INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prediction_pool();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for bets and predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.predictions;

-- Insert initial prediction: Bitcoin $150k by end of 2025
INSERT INTO public.predictions (
  title,
  description,
  category,
  end_date,
  escrow_address,
  yes_pool,
  no_pool
) VALUES (
  'Will Bitcoin reach $150,000 by end of 2025?',
  'This market resolves YES if Bitcoin (BTC) reaches or exceeds $150,000 USD on any major exchange (Binance, Coinbase, Kraken) before January 1, 2026 00:00 UTC.',
  'crypto',
  '2025-12-31 23:59:59+00',
  'ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035',
  0,
  150000 -- 1500 XEC = 500 + 1000 in satoshis (100 sat = 1 XEC)
);