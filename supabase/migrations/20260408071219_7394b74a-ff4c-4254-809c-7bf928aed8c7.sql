
INSERT INTO predictions (title, description, category, end_date, escrow_address, status)
VALUES ('Highest grossing movie in 2026?', 'Which movie will be the highest grossing film at the worldwide box office in 2026?', 'entertainment', '2026-12-31', 'pending_escrow', 'active');

INSERT INTO outcomes (prediction_id, label, pool)
SELECT p.id, t.label, 0
FROM predictions p,
LATERAL (VALUES ('Spider-Man: Brand New Day'), ('Avengers: Doomsday'), ('Fantastic Four: First Steps'), ('Ice Age 6'), ('Other')) AS t(label)
WHERE p.title = 'Highest grossing movie in 2026?' AND p.status = 'active';
