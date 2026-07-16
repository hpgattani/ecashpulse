CREATE TABLE public.tournament_status (
  id text PRIMARY KEY,
  alive_teams jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tournament_status TO anon, authenticated;
GRANT ALL ON public.tournament_status TO service_role;

ALTER TABLE public.tournament_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tournament status"
ON public.tournament_status
FOR SELECT
USING (true);

CREATE TRIGGER trg_tournament_status_updated_at
BEFORE UPDATE ON public.tournament_status
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current WC 2026 state so UI works before first sync completes
INSERT INTO public.tournament_status (id, alive_teams, source)
VALUES (
  'fifa_wc_2026',
  '["Spain","Argentina","France","England"]'::jsonb,
  'seed'
);
