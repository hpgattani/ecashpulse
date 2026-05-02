import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, TrendingUp, TrendingDown, Flame } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { usdNearXec } from '@/lib/xecFormat';

const SPOTLIGHT_ID = 'd776be9d-afc6-4248-abbc-64c3bc19b950';

interface SpotlightData {
  id: string;
  title: string;
  yes_pool: number;
  no_pool: number;
  end_date: string;
}

const SpotlightMarket = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<SpotlightData | null>(null);
  const { prices } = useCryptoPrices();
  const xecUsd = prices.ecash;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data: row } = await supabase
        .from('predictions')
        .select('id, title, yes_pool, no_pool, end_date')
        .eq('id', SPOTLIGHT_ID)
        .maybeSingle();
      if (mounted && row) setData(row as SpotlightData);
    };
    load();
    const channel = supabase
      .channel('spotlight-truthcoin')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'predictions', filter: `id=eq.${SPOTLIGHT_ID}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(channel); };
  }, []);

  if (!data) return null;

  const totalSats = (data.yes_pool || 0) + (data.no_pool || 0);
  const totalXec = totalSats / 100;
  const aboveOdds = totalSats > 0 ? Math.round((data.yes_pool / totalSats) * 100) : 50;
  const belowOdds = 100 - aboveOdds;

  return (
    <section className="px-4 pt-4 pb-2 sm:pt-6 sm:pb-4">
      <div className="container mx-auto">
        <div
          onClick={() => navigate(`/prediction/${data.id}`)}
          className="relative overflow-hidden rounded-2xl cursor-pointer group glass-card p-[2px] bg-gradient-to-r from-orange-500/40 via-primary/40 to-emerald-500/40 hover:from-orange-500/70 hover:via-primary/70 hover:to-emerald-500/70 transition-all duration-500"
        >
          {/* Animated glow orbs */}
          <div className="absolute -top-16 -left-16 w-48 h-48 bg-orange-500/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="relative rounded-2xl bg-background/85 backdrop-blur-xl p-4 sm:p-6">
            {/* Badge row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/40 text-orange-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <Flame className="w-3 h-3" /> Spotlight
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40 text-primary text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                <Swords className="w-3 h-3" /> eCash vs eCash
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Truthcoin fork ($XEC2) vs real eCash ($XEC)
              </span>
            </div>

            {/* Title */}
            <h2 className="font-display font-bold text-lg sm:text-2xl md:text-3xl mb-1 leading-tight">
              The <span className="bg-gradient-to-r from-orange-400 via-primary to-emerald-400 bg-clip-text text-transparent">Truthcoin BTC fork</span> vs real <span className="text-primary">eCash $XEC</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              Truthcoin is launching in August using the "eCash" name — but real eCash $XEC already exists. Will the impostor trade above or below the OG one year from now?
            </p>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 group-hover:bg-emerald-500/15 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider text-emerald-400 font-semibold">Above $XEC</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{aboveOdds}%</div>
              </div>
              <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 group-hover:bg-red-500/15 transition-colors">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider text-red-400 font-semibold">Below $XEC</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold text-red-400">{belowOdds}%</div>
              </div>
            </div>

            {/* Volume + CTA */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider">Total volume</div>
                <div className="text-sm sm:text-base font-bold">
                  {totalXec >= 1000 ? `${(totalXec / 1000).toFixed(1)}K` : totalXec.toLocaleString()} XEC
                  {xecUsd && totalXec > 0 ? <span className="ml-2 text-muted-foreground font-normal">{usdNearXec(totalXec, xecUsd)}</span> : null}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/prediction/${data.id}`); }}
                className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground text-xs sm:text-sm font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all"
              >
                Place your bet →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpotlightMarket;
