
-- Move 3 duplicate-raffle tickets into the master FIFA raffle and reassign collided teams

-- Ticket 1: tx 8e28...  (was Ivory Coast + Austria) -> Austria + Iran
UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Austria'
WHERE tx_hash = '8e280940824096940f5e013acab3a3630dc168871a5b22d64c1fc81c2b4cb503'
  AND assigned_team = 'Austria';

UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Iran'
WHERE tx_hash = '8e280940824096940f5e013acab3a3630dc168871a5b22d64c1fc81c2b4cb503'
  AND assigned_team = 'Ivory Coast';

-- Ticket 2: tx 2324...  (was Brazil + Bolivia) -> Argentina + Uruguay
UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Argentina'
WHERE tx_hash = '2324f9609d88df44fe3172194f7dee3e074ac69816c92550c804162709557b3b'
  AND assigned_team = 'Brazil';

UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Uruguay'
WHERE tx_hash = '2324f9609d88df44fe3172194f7dee3e074ac69816c92550c804162709557b3b'
  AND assigned_team = 'Bolivia';

-- Ticket 3: tx 9338...  (was Congo DR + Qatar) -> Spain + Germany
UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Spain'
WHERE tx_hash = '933897076b42103c7d141a722d20db86c7b1e4edffd9e49225c3110d533374a9'
  AND assigned_team = 'Congo DR';

UPDATE public.raffle_entries
SET raffle_id = '9411f054-0e99-4cd5-a4a5-9503682e9273',
    assigned_team = 'Germany'
WHERE tx_hash = '933897076b42103c7d141a722d20db86c7b1e4edffd9e49225c3110d533374a9'
  AND assigned_team = 'Qatar';

-- Delete the 3 now-empty duplicate raffles
DELETE FROM public.raffles
WHERE id IN (
  'bcecfbfa-b25f-4e55-b0a9-fa25337a8ebb',
  '1ceaef84-dfdb-450b-8567-063d1bcf9b09',
  '106455aa-ef4e-4ac7-b537-ea4adacebaa6'
);

-- Add the 3 ticket payments (3 x 50,000 XEC) to the master raffle pot
UPDATE public.raffles
SET total_pot = total_pot + 150000
WHERE id = '9411f054-0e99-4cd5-a4a5-9503682e9273';
