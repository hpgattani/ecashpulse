-- Create outcomes table for multi-option predictions
CREATE TABLE public.outcomes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  pool BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

-- Anyone can view outcomes
CREATE POLICY "Anyone can view outcomes"
ON public.outcomes
FOR SELECT
USING (true);

-- Service role can manage outcomes
CREATE POLICY "Service role can manage outcomes"
ON public.outcomes
FOR ALL
USING (true)
WITH CHECK (true);

-- Add outcome_id to bets table (nullable for backward compatibility with yes/no bets)
ALTER TABLE public.bets 
ADD COLUMN outcome_id UUID REFERENCES public.outcomes(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_outcomes_prediction_id ON public.outcomes(prediction_id);
CREATE INDEX idx_bets_outcome_id ON public.bets(outcome_id);

-- Enable realtime for outcomes
ALTER PUBLICATION supabase_realtime ADD TABLE public.outcomes;