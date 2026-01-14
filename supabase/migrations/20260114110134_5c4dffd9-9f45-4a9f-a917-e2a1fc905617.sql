-- Create sentiment_topics table for anonymous sentiment gauging
CREATE TABLE public.sentiment_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  creator_address_hash TEXT NOT NULL, -- Hashed address for privacy
  creation_fee_tx TEXT, -- Transaction hash for the $1 creation fee
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed'))
);

-- Create sentiment_votes table for anonymous voting
CREATE TABLE public.sentiment_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  topic_id UUID NOT NULL REFERENCES public.sentiment_topics(id) ON DELETE CASCADE,
  voter_address_hash TEXT NOT NULL, -- Hashed and redacted for anonymity
  position TEXT NOT NULL CHECK (position IN ('agree', 'disagree')),
  tx_hash TEXT, -- Transaction hash for the 500 XEC vote
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent duplicate votes from same address hash on same topic
  UNIQUE(topic_id, voter_address_hash)
);

-- Enable RLS
ALTER TABLE public.sentiment_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentiment_votes ENABLE ROW LEVEL SECURITY;

-- RLS policies for sentiment_topics (public read, service role write)
CREATE POLICY "Anyone can view sentiment topics"
ON public.sentiment_topics
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage sentiment topics"
ON public.sentiment_topics
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for sentiment_votes (public read, service role write)
CREATE POLICY "Anyone can view sentiment votes"
ON public.sentiment_votes
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage sentiment votes"
ON public.sentiment_votes
FOR ALL
USING (true)
WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_sentiment_topics_status ON public.sentiment_topics(status);
CREATE INDEX idx_sentiment_topics_created_at ON public.sentiment_topics(created_at DESC);
CREATE INDEX idx_sentiment_votes_topic_id ON public.sentiment_votes(topic_id);