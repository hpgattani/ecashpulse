-- Create comments table for bet discussions
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prediction_id UUID NOT NULL REFERENCES public.predictions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Anyone can view comments
CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT
USING (true);

-- Authenticated users can create comments
CREATE POLICY "Users can create comments"
ON public.comments FOR INSERT
WITH CHECK (true);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.comments FOR DELETE
USING (user_id IN (
  SELECT id FROM users WHERE ecash_address = (current_setting('request.jwt.claims', true)::json ->> 'ecash_address')
));

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;