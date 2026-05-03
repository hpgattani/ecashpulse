import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame, TrendingUp, TrendingDown, Swords } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import { usdNearXec } from '@/lib/xecFormat';

const FEATURED_ID = 'd776be9d-afc6-4248-abbc-64c3bc19b950';

interface OutcomeRow {
  id: string;
  label: string;
  pool: number;
}

const FeaturedTruthcoinSection = () => {
  const navigate = useNavigate();
  const { prices } = useCryptoPrices();
  const xecUsd = prices.ecash;
  const [title, setTitle] = useState<string>('');
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: pred }, { data: outs }] = await Promise.all([
      supabase.from('predictions').select('title, status').eq('id', FEATURED_ID).maybeSingle(),
      supabase.from('outcomes').select('id, label, pool').eq('prediction_id', FEATURED_ID),
    ]);
    if (pred) setTitle(pred.title);
    if (outs) setOutcomes(outs as OutcomeRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('predictions:refetch', handler);
    const id = window.setInterval(load, 30000);
    return () => {
      window.removeEventListener('predictions:refetch', handler);
      window.clearInterval(id);
    };
  }, []);

  if (loading || outcomes.length === 0) return null;

  const above = outcomes.find(o => o.label.toLowerCase() === 'above');
  const below = outcomes.find(o => o.label.toLowerCase() === 'below');
  if (!above || !below) return null;

  const totalSats = above.pool + below.pool;
  const aboveOdds = totalSats > 0 ? Math.round((above.pool / totalSats) * 100) : 50;
  const belowOdds = 100 - aboveOdds;
  const totalXec = totalSats / 100;

  return (
    <section className="relative py-8 sm:py-12 px-4 -mt-4 sm:-mt-8">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[420px] h-[420px] bg-primary/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[360px] h-[360px] bg-red-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto max-w-5xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => navigate(`/prediction/${FEATURED_ID}`)}
          className="glass-card cursor-pointer relative overflow-hidden p-5 sm:p-7 group hover:scale-[1.01] transition-transform"
        >
          {/* Vibrant gradient border accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

          <div className="flex items-center gap-2 mb-3">
            <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/30 to-red-500/20 border border-primary/30">
              <Swords className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-primary">
              Featured Showdown
            </span>
            <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-semibold">
              <Flame className="w-3 h-3" /> Controversial
            </span>
          </div>

          <h2 className="font-display font-bold text-xl sm:text-2xl md:text-3xl text-foreground mb-2 leading-tight">
            eCash <span className="gradient-text">$XEC</span> vs Truthcoin BTC fork
          </h2>
          <p className="text-sm text-muted-foreground mb-5 line-clamp-2">
            {title || 'Will the Truthcoin BTC fork (for Drivechains) trade Above or Below eCash $XEC one year from now?'}
          </p>

          {/* Above / Below */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div className="relative p-3 sm:p-4 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/40 group-hover:shadow-[0_0_24px_rgba(16,185,129,0.25)] transition-all">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Above (Truthcoin wins)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-emerald-400">{aboveOdds}%</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {(above.pool / 100).toLocaleString()} XEC pool
                {xecUsd ? <span className="ml-1">{usdNearXec(above.pool / 100, xecUsd)}</span> : null}
              </div>
            </div>
            <div className="relative p-3 sm:p-4 rounded-xl bg-gradient-to-br from-red-500/15 to-red-600/5 border border-red-500/40 group-hover:shadow-[0_0_24px_rgba(239,68,68,0.25)] transition-all">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Below ($XEC wins)</span>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-red-400">{belowOdds}%</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {(below.pool / 100).toLocaleString()} XEC pool
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="text-muted-foreground">
              Total volume: <span className="font-semibold text-foreground">{totalXec.toLocaleString()} XEC</span>
              {xecUsd ? <span className="ml-1 text-muted-foreground/80">{usdNearXec(totalXec, xecUsd)}</span> : null}
            </div>
            <span className="text-primary font-semibold group-hover:underline">Place your bet →</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedTruthcoinSection;
