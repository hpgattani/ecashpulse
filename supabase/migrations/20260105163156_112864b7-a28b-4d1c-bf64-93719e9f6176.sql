-- Add creator_id column to track who submitted predictions
ALTER TABLE public.predictions 
ADD COLUMN creator_id uuid REFERENCES public.users(id);

-- Create index for efficient lookups
CREATE INDEX idx_predictions_creator_id ON public.predictions(creator_id);

-- Allow users to view predictions they created (already covered by "Anyone can view predictions")
-- No additional RLS needed since predictions are publicly viewable