---
name: Ingestion category curation
description: Auto-ingestion is restricted to crypto/politics/sports with engagement-keyword filtering
type: constraint
---
Polymarket/AI ingestion (`fetch-trending-topics`) is restricted to three categories: **crypto, politics, sports**. Tech, entertainment, and economics were removed because they created clutter without bettor engagement.

Within sports and politics, an additional `passesEngagementFilter` allowlist requires marquee keywords (NFL/EPL/World Cup/UFC/F1/IPL for sports; elections/major leaders/war/major institutions for politics). Crypto passes through unconditionally.

If the user wants to re-enable a category, edit `CATEGORIES` and `AUTO_MAX_END_DAYS_BY_CATEGORY` in `supabase/functions/fetch-trending-topics/index.ts`.
