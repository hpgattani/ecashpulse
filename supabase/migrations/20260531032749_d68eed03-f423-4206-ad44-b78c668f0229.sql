
CREATE TABLE public.user_wallets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ecash_address TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_wallets_user_id ON public.user_wallets(user_id);

GRANT SELECT ON public.user_wallets TO anon;
GRANT SELECT ON public.user_wallets TO authenticated;
GRANT ALL ON public.user_wallets TO service_role;

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view wallet aliases"
  ON public.user_wallets FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage wallet aliases"
  ON public.user_wallets FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Seed Fator's two known wallets to his primary user account
INSERT INTO public.user_wallets (user_id, ecash_address) VALUES
  ('5308286d-a301-49c1-80a6-0f0ab47a380a', 'ecash:qqqdv3r5lkh3xg8u3prrm935la7w2m6m7gq96asq43'),
  ('5308286d-a301-49c1-80a6-0f0ab47a380a', 'ecash:qq9txwwac847rkwudgr696uywfpj5mw33ce8463su6')
ON CONFLICT (ecash_address) DO NOTHING;

-- Reattribute the 2 existing bets on the alt wallet user to Fator's main user
UPDATE public.bets
   SET user_id = '5308286d-a301-49c1-80a6-0f0ab47a380a'
 WHERE user_id = 'eea3692b-0832-411b-8b0f-6d2938daf139';

INSERT INTO public.bet_audit_log (event_type, user_id, metadata)
VALUES ('wallet_merged',
        '5308286d-a301-49c1-80a6-0f0ab47a380a',
        '{"merged_from_user_id":"eea3692b-0832-411b-8b0f-6d2938daf139","reason":"consolidate_fator_qq9txw3su6_into_qqqdv3sq43"}'::jsonb);
