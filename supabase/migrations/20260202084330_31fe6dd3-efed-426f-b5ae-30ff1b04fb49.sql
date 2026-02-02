-- Create chat_reactions table
CREATE TABLE public.chat_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.chat_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can view reactions
CREATE POLICY "Anyone can view chat reactions"
ON public.chat_reactions
FOR SELECT
USING (true);

-- Service role manages reactions (via edge function)
CREATE POLICY "Service role can manage reactions"
ON public.chat_reactions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_chat_reactions_message_id ON public.chat_reactions(message_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reactions;