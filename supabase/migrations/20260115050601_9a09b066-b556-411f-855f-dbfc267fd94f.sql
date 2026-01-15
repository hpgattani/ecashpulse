-- Add vote_cost column to sentiment_topics (stores in XEC, default 500)
ALTER TABLE public.sentiment_topics ADD COLUMN vote_cost integer NOT NULL DEFAULT 500;

-- Update the comment
COMMENT ON COLUMN public.sentiment_topics.vote_cost IS 'Cost in XEC to vote on this topic, set by creator (range: 500-50000 XEC, ~$0.05-$5)';