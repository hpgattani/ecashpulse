CREATE TABLE public.prediction_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL UNIQUE,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.prediction_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view prediction stats" ON public.prediction_stats
  FOR SELECT TO public USING (true);

CREATE POLICY "Service role can manage prediction stats" ON public.prediction_stats
  FOR ALL TO public USING (true) WITH CHECK (true);