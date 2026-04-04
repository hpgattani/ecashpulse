DELETE FROM prediction_stats WHERE prediction_id IN (
  SELECT id FROM predictions WHERE category = 'sports'
);