-- Remove duplicate pool update triggers (these were causing pools/volume to be over-counted)
DROP TRIGGER IF EXISTS trigger_update_prediction_pool ON public.bets;
DROP TRIGGER IF EXISTS update_prediction_pool_trigger ON public.bets;

-- Ensure exactly one pool update trigger remains
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'update_pool_on_bet_confirm'
      AND tgrelid = 'public.bets'::regclass
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER update_pool_on_bet_confirm
      AFTER INSERT OR UPDATE ON public.bets
      FOR EACH ROW
      EXECUTE FUNCTION public.update_prediction_pool();
  END IF;
END $$;
