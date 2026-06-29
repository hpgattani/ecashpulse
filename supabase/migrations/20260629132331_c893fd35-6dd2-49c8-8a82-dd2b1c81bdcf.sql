UPDATE public.predictions
SET category = 'economics', updated_at = now()
WHERE category = 'politics'
  AND (
    title ILIKE '%crude oil%' OR title ILIKE '%wti%' OR title ILIKE '%brent%'
    OR title ILIKE '%natural gas%' OR title ILIKE '% gold %' OR title ILIKE 'gold %' OR title ILIKE '%(xauusd)%'
    OR title ILIKE '%silver %' OR title ILIKE '%(xagusd)%' OR title ILIKE '%(si)%'
    OR title ILIKE '%copper%' OR title ILIKE '%platinum%' OR title ILIKE '%palladium%'
    OR title ILIKE '%commodity%' OR title ILIKE '%(cl)%'
  );