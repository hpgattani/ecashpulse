-- Create mini games tables
CREATE TABLE public.mini_games (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Game sessions (each play attempt)
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.mini_games(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  player_address_hash TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  is_competitive BOOLEAN NOT NULL DEFAULT false,
  entry_fee INTEGER NOT NULL,
  tx_hash TEXT,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Weekly leaderboards
CREATE TABLE public.game_leaderboards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.mini_games(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_pot INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(game_id, week_number, year)
);

-- Leaderboard winners
CREATE TABLE public.game_winners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  leaderboard_id UUID NOT NULL REFERENCES public.game_leaderboards(id) ON DELETE CASCADE,
  player_address_hash TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  prize_amount INTEGER NOT NULL,
  payout_tx_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mini_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_winners ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view games" ON public.mini_games FOR SELECT USING (true);
CREATE POLICY "Anyone can view leaderboards" ON public.game_leaderboards FOR SELECT USING (true);
CREATE POLICY "Anyone can view winners" ON public.game_winners FOR SELECT USING (true);
CREATE POLICY "Anyone can view competitive sessions" ON public.game_sessions FOR SELECT USING (is_competitive = true);
CREATE POLICY "Service role can manage all" ON public.mini_games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage sessions" ON public.game_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage leaderboards" ON public.game_leaderboards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role can manage winners" ON public.game_winners FOR ALL USING (true) WITH CHECK (true);

-- Insert default games
INSERT INTO public.mini_games (slug, name, description, icon) VALUES
  ('snake', 'Snake', 'Classic snake game - eat food, grow longer, avoid walls!', '🐍'),
  ('tetris', 'Tetris', 'Stack blocks, clear lines, score big!', '🧱'),
  ('lumberjack', 'Lumberjack', 'Chop wood and dodge branches!', '🪓'),
  ('space-shooter', 'Space Shooter', 'Blast aliens and survive waves!', '🚀');

-- Create index for leaderboard queries
CREATE INDEX idx_game_sessions_leaderboard ON public.game_sessions(game_id, week_number, year, is_competitive, score DESC);
CREATE INDEX idx_game_sessions_player ON public.game_sessions(player_address_hash);