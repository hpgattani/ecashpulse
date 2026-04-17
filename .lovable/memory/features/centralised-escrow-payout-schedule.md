---
name: Centralised Escrow Payout Schedule
description: Centralised escrow payouts run monthly on the last day of the month (next: May 31)
type: feature
---
The centralised escrow (`ecash:qz6jsgshsv0v2tyuleptwr4at8xaxsakmstkhzc0pp`) is NOT used for per-market bet payouts (those run from per-market decentralised escrows on each market's resolution date).

Centralised escrow is used for:
- Monthly rewards payouts (run on the last day of each month — next: May 31)
- Manual refunds for failed transactions
- Special bonus events (e.g. ETH $4,475 resolution bonus)
- Platform fee custody

When auditing balance/UTXO health, time pressure aligns with the monthly payout date, not daily market resolutions.
