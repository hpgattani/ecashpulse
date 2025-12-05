-- Create trigger to update prediction pools when bets are confirmed
CREATE TRIGGER update_prediction_pool_trigger
AFTER INSERT OR UPDATE ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.update_prediction_pool();