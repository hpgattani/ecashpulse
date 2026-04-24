DROP POLICY IF EXISTS "Users can create comments" ON public.comments;

CREATE POLICY "Users can create their own comments"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    user_id IN (
      SELECT users.id FROM public.users
      WHERE users.ecash_address = ((current_setting('request.jwt.claims', true))::json ->> 'ecash_address')
    )
  );