-- Create profiles table linked to users
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text,
  avatar_url text,
  bio text,
  total_bets integer DEFAULT 0,
  total_wins integer DEFAULT 0,
  total_volume bigint DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles (for leaderboards, public stats)
CREATE POLICY "Anyone can view profiles"
ON public.profiles
FOR SELECT
USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (user_id IN (SELECT id FROM public.users WHERE ecash_address = current_setting('request.jwt.claims', true)::json->>'ecash_address'))
WITH CHECK (user_id IN (SELECT id FROM public.users WHERE ecash_address = current_setting('request.jwt.claims', true)::json->>'ecash_address'));

-- Service role can manage profiles (for edge functions)
CREATE POLICY "Service role can manage profiles"
ON public.profiles
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger to auto-create profile when user registers
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, SUBSTRING(NEW.ecash_address FROM 7 FOR 8) || '...');
  RETURN NEW;
END;
$$;

-- Trigger on users table
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Update timestamp trigger
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();