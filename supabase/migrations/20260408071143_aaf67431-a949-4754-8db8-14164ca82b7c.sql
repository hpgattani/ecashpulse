
-- Outcomes for "Highest grossing movie in 2026?"
INSERT INTO outcomes (prediction_id, label, pool)
SELECT p.id, t.label, 0
FROM predictions p,
LATERAL (VALUES ('Spider-Man: Brand New Day'), ('Avengers: Doomsday'), ('Fantastic Four: First Steps'), ('Ice Age 6'), ('Other')) AS t(label)
WHERE p.title = 'Highest grossing movie in 2026?' AND p.status = 'active';

-- 2. Next James Bond actor
INSERT INTO predictions (title, description, category, end_date, escrow_address, status)
VALUES ('Next James Bond actor?', 'Who will be officially announced as the next actor to play James Bond (007)?', 'entertainment', '2026-12-31', 'pending_escrow', 'active');

INSERT INTO outcomes (prediction_id, label, pool)
SELECT p.id, t.label, 0
FROM predictions p,
LATERAL (VALUES ('No Bond chosen'), ('Callum Turner'), ('Aaron Taylor-Johnson'), ('Other')) AS t(label)
WHERE p.title = 'Next James Bond actor?' AND p.status = 'active';

-- 3. Anime Awards Best Voice Artist
INSERT INTO predictions (title, description, category, end_date, escrow_address, status)
VALUES ('Anime Awards: Best English Voice Artist Winner?', 'Who will win Best Anime Voice Artist Performance (English) at the Anime Awards?', 'entertainment', '2026-12-31', 'pending_escrow', 'active');

INSERT INTO outcomes (prediction_id, label, pool)
SELECT p.id, t.label, 0
FROM predictions p,
LATERAL (VALUES ('Paul Castro Jr. (Hikaru Indou)'), ('Emi Lo (Maomao)'), ('Zeno Robinson'), ('Other')) AS t(label)
WHERE p.title = 'Anime Awards: Best English Voice Artist Winner?' AND p.status = 'active';

-- 4. Who will die in The Boys Season 5
INSERT INTO predictions (title, description, category, end_date, escrow_address, status)
VALUES ('Who will die in The Boys: Season 5?', 'Which major character will die in The Boys Season 5? Resolves based on confirmed on-screen death.', 'entertainment', '2026-12-31', 'pending_escrow', 'active');

INSERT INTO outcomes (prediction_id, label, pool)
SELECT p.id, t.label, 0
FROM predictions p,
LATERAL (VALUES ('A-Train'), ('Homelander'), ('Starlight'), ('Butcher'), ('Other')) AS t(label)
WHERE p.title = 'Who will die in The Boys: Season 5?' AND p.status = 'active';
