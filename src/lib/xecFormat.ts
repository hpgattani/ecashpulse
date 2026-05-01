// Helpers for formatting USD equivalents next to XEC amounts.

export const formatUsd = (usd: number): string => {
  if (!isFinite(usd) || usd <= 0) return '$0';
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(2)}`;
  return `<$0.01`;
};

/**
 * Returns "≈ $X.XX" for a given XEC amount and price.
 * Returns empty string when price is unavailable or amount is 0.
 */
export const usdNearXec = (xec: number, xecUsdPrice: number | null | undefined): string => {
  if (!xecUsdPrice || !xec || !isFinite(xec)) return '';
  const usd = xec * xecUsdPrice;
  if (usd <= 0) return '';
  return `≈ ${formatUsd(usd)}`;
};

/**
 * Same as usdNearXec but takes satoshis (1 XEC = 100 sats).
 */
export const usdNearSats = (sats: number, xecUsdPrice: number | null | undefined): string => {
  return usdNearXec(sats / 100, xecUsdPrice);
};
