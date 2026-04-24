-- Restrict every overly-permissive "Service role can manage ..." policy to the
-- service_role only. The service_role JWT used by edge functions bypasses RLS,
-- so these policies were never actually needed for backend functionality —
-- they were just leaving an open write door for anonymous PostgREST clients.

-- bets
DROP POLICY IF EXISTS "Service role can insert bets" ON public.bets;
DROP POLICY IF EXISTS "Service role can update bets" ON public.bets;

-- predictions
DROP POLICY IF EXISTS "Service role can manage predictions" ON public.predictions;

-- prediction_stats
DROP POLICY IF EXISTS "Service role can manage prediction stats" ON public.prediction_stats;

-- outcomes
DROP POLICY IF EXISTS "Service role can manage outcomes" ON public.outcomes;

-- profiles
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.profiles;

-- raffles & raffle_entries
DROP POLICY IF EXISTS "Service role can manage raffles" ON public.raffles;
DROP POLICY IF EXISTS "Service role can manage raffle entries" ON public.raffle_entries;

-- sentiment
DROP POLICY IF EXISTS "Service role can manage sentiment topics" ON public.sentiment_topics;
DROP POLICY IF EXISTS "Service role can manage sentiment votes" ON public.sentiment_votes;

-- chat
DROP POLICY IF EXISTS "Service role can insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Service role can manage reactions" ON public.chat_reactions;

-- comments / likes
DROP POLICY IF EXISTS "Service role can manage comment likes" ON public.comment_likes;

-- mini games / leaderboards
DROP POLICY IF EXISTS "Service role can manage all" ON public.mini_games;
DROP POLICY IF EXISTS "Service role can manage leaderboards" ON public.game_leaderboards;
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Service role can manage winners" ON public.game_winners;

-- monthly rewards
DROP POLICY IF EXISTS "Service role can manage monthly rewards" ON public.monthly_rewards;

-- audit log & fees
DROP POLICY IF EXISTS "Service role can manage audit logs" ON public.bet_audit_log;
DROP POLICY IF EXISTS "Service can manage fees" ON public.platform_fees;

-- ── Recreate every policy correctly scoped to service_role only ──

CREATE POLICY "Service role can manage bets"
  ON public.bets FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage predictions"
  ON public.predictions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage prediction stats"
  ON public.prediction_stats FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage outcomes"
  ON public.outcomes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage profiles"
  ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage raffles"
  ON public.raffles FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage raffle entries"
  ON public.raffle_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sentiment topics"
  ON public.sentiment_topics FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage sentiment votes"
  ON public.sentiment_votes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage chat messages"
  ON public.chat_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage chat reactions"
  ON public.chat_reactions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage comment likes"
  ON public.comment_likes FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage mini games"
  ON public.mini_games FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage game leaderboards"
  ON public.game_leaderboards FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage game sessions"
  ON public.game_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage game winners"
  ON public.game_winners FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage monthly rewards"
  ON public.monthly_rewards FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage audit logs"
  ON public.bet_audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can manage platform fees"
  ON public.platform_fees FOR ALL TO service_role USING (true) WITH CHECK (true);