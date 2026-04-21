DELETE FROM outcomes WHERE prediction_id IN (
  SELECT id FROM predictions WHERE category = 'politics' AND (
    title ILIKE '%RBC Heritage%' OR
    title ~* 'win on 20' OR
    title ILIKE '%FC %' OR
    title ILIKE '% FC%' OR
    title ILIKE '%finish in the Top%'
  )
);
DELETE FROM prediction_stats WHERE prediction_id IN (
  SELECT id FROM predictions WHERE category = 'politics' AND (
    title ILIKE '%RBC Heritage%' OR
    title ~* 'win on 20' OR
    title ILIKE '%FC %' OR
    title ILIKE '% FC%' OR
    title ILIKE '%finish in the Top%'
  )
);
DELETE FROM predictions WHERE category = 'politics' AND (
  title ILIKE '%RBC Heritage%' OR
  title ~* 'win on 20' OR
  title ILIKE '%FC %' OR
  title ILIKE '% FC%' OR
  title ILIKE '%finish in the Top%'
);