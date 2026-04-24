-- Realtime authorizes channel subscriptions via SELECT on realtime.messages.
-- Without policies, anon clients can subscribe to any topic. This project only
-- broadcasts public data (predictions, public bets, chat, raffles), so we
-- restrict subscriptions to authenticated clients and rely on each underlying
-- table's existing SELECT RLS for row-level filtering.

-- Enable RLS (no-op if already enabled).
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior version of our policy so this migration is idempotent.
DROP POLICY IF EXISTS "Authenticated clients can subscribe to public topics" ON realtime.messages;
DROP POLICY IF EXISTS "Service role can manage realtime messages" ON realtime.messages;

-- Allow authenticated subscribers to read broadcast payloads.
-- Underlying table RLS still controls which rows actually appear in the payload.
CREATE POLICY "Authenticated clients can subscribe to public topics"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role retains full access for server-side broadcasts.
CREATE POLICY "Service role can manage realtime messages"
  ON realtime.messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);