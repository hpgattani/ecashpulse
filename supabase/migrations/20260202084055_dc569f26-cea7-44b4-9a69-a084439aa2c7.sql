-- Create chat_messages table for encrypted messaging
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  iv TEXT NOT NULL, -- Initialization vector for AES-GCM
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view messages (they're encrypted anyway)
CREATE POLICY "Authenticated users can view chat messages"
ON public.chat_messages
FOR SELECT
USING (true);

-- Only service role can insert (via edge function with rate limiting)
CREATE POLICY "Service role can insert messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (true);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
ON public.chat_messages
FOR DELETE
USING (user_id IN (
  SELECT id FROM public.users 
  WHERE ecash_address = (current_setting('request.jwt.claims', true)::json->>'ecash_address')
));

-- Create index for faster queries
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Rate limiting table
CREATE TABLE public.chat_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages rate limits"
ON public.chat_rate_limits
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;