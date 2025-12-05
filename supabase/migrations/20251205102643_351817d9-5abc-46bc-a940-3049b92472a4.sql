-- Security hardening: Tighten RLS policies

-- Drop overly permissive INSERT policy on bets
DROP POLICY IF EXISTS "Users can create bets" ON public.bets;

-- Bets should only be created through edge functions (service role)
-- No direct client INSERT allowed - this prevents users from creating bets with arbitrary user_ids

-- Drop overly permissive INSERT policy on users  
DROP POLICY IF EXISTS "Users can insert during registration" ON public.users;

-- Users registration will go through edge functions
-- Keep a restrictive policy that at minimum blocks anonymous/unauthenticated inserts
CREATE POLICY "Restrict direct user creation" 
ON public.users 
FOR INSERT 
WITH CHECK (false);  -- Block all direct inserts, require going through edge function

-- Note: The application currently uses client-side auth without Supabase Auth
-- Full RLS lockdown requires migrating to proper Supabase Auth
-- For now, removing the overly permissive policies improves security