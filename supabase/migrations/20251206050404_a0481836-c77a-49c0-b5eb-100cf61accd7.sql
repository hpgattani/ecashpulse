-- Create trigger to automatically update prediction pools on bet insert/update
DROP TRIGGER IF EXISTS trigger_update_prediction_pool ON public.bets;

CREATE TRIGGER trigger_update_prediction_pool
  AFTER INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prediction_pool();