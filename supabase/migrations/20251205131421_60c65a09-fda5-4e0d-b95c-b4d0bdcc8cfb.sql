-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_update_prediction_pool ON public.bets;

-- Update the function to handle INSERT properly (OLD is NULL on INSERT)
CREATE OR REPLACE FUNCTION public.update_prediction_pool()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- On INSERT: check if new bet is confirmed
  -- On UPDATE: check if status changed to confirmed
  IF NEW.status = 'confirmed' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'confirmed')) THEN
    IF NEW.position = 'yes' THEN
      UPDATE public.predictions
      SET yes_pool = yes_pool + NEW.amount,
          updated_at = now()
      WHERE id = NEW.prediction_id;
    ELSE
      UPDATE public.predictions
      SET no_pool = no_pool + NEW.amount,
          updated_at = now()
      WHERE id = NEW.prediction_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER trigger_update_prediction_pool
AFTER INSERT OR UPDATE ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.update_prediction_pool();