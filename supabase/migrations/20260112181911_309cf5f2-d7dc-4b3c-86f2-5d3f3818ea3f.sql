-- Add resolution_date column for delayed resolution scenarios
ALTER TABLE public.predictions 
ADD COLUMN resolution_date TIMESTAMPTZ DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.predictions.resolution_date IS 'Optional date when the prediction should be resolved. If null, resolution happens after end_date.';