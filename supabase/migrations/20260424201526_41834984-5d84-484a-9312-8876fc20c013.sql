-- Remove ambiguous "2AM ET" time from title; resolution will be based on the actual end_date (end of April 24 UTC).
-- Preserves the existing 100K XEC NO bet's intent: betting on whether BTC closes above 79,600 on April 24.
UPDATE public.predictions
SET 
  title = 'Bitcoin above 79,600 on April 24?',
  description = 'Resolves YES if Bitcoin (BTC) is above $79,600 at the end of April 24, 2026 (UTC). Resolves NO otherwise. Resolution source: BTC/USDT closing price on Binance.'
WHERE id = '0852911b-b4d4-436b-b17f-7907aee8c0c8';

-- Also clean up the other two ambiguous "2AM ET" markets that have no bets yet
UPDATE public.predictions
SET 
  title = 'Bitcoin above 79,200 on April 24?',
  description = 'Resolves YES if Bitcoin (BTC) is above $79,200 at the end of April 24, 2026 (UTC). Resolves NO otherwise. Resolution source: BTC/USDT closing price on Binance.'
WHERE id = 'c7bb3c55-b661-49f2-a300-fb389f45c238';

UPDATE public.predictions
SET 
  title = 'Bitcoin above 78,800 on April 24?',
  description = 'Resolves YES if Bitcoin (BTC) is above $78,800 at the end of April 24, 2026 (UTC). Resolves NO otherwise. Resolution source: BTC/USDT closing price on Binance.'
WHERE id = 'c26d1950-1e88-419f-a6df-e353c000d5c4';