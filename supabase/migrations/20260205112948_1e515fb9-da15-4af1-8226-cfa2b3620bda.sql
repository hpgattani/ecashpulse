-- Create permanent bet audit log table
CREATE TABLE public.bet_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL, -- 'bet_created', 'bet_confirmed', 'bet_won', 'bet_lost', 'bet_refunded', 'payout_sent'
  bet_id UUID, -- nullable because some events may occur before bet is inserted
  prediction_id UUID,
  user_id UUID,
  tx_hash TEXT,
  amount BIGINT,
  position TEXT,
  status TEXT,
  metadata JSONB DEFAULT '{}', -- additional context like error messages, etc.
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX idx_bet_audit_log_bet_id ON public.bet_audit_log(bet_id);
CREATE INDEX idx_bet_audit_log_prediction_id ON public.bet_audit_log(prediction_id);
CREATE INDEX idx_bet_audit_log_user_id ON public.bet_audit_log(user_id);
CREATE INDEX idx_bet_audit_log_tx_hash ON public.bet_audit_log(tx_hash);
CREATE INDEX idx_bet_audit_log_created_at ON public.bet_audit_log(created_at DESC);
CREATE INDEX idx_bet_audit_log_event_type ON public.bet_audit_log(event_type);

-- Enable RLS
ALTER TABLE public.bet_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies: Service role can manage, admins can view, users can view their own
CREATE POLICY "Service role can manage audit logs"
  ON public.bet_audit_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view all audit logs"
  ON public.bet_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own audit logs"
  ON public.bet_audit_log
  FOR SELECT
  USING (user_id IN (
    SELECT id FROM public.users
    WHERE ecash_address = (current_setting('request.jwt.claims', true)::json ->> 'ecash_address')
  ));

COMMENT ON TABLE public.bet_audit_log IS 'Permanent audit log for all bet-related events. Unlike edge function logs, this data is never purged.';