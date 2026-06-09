ALTER TABLE public.raffle_entries
  ADD CONSTRAINT raffle_entries_raffle_team_unique UNIQUE (raffle_id, assigned_team);