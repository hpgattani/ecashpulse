import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Loader2, TrendingUp, TrendingDown, Minus, Zap, RefreshCw, Swords, LineChart, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface PredictionStatsProps {
  predictionId: string;
  category: string;
}

const PredictionStats = ({ predictionId, category }: PredictionStatsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const canRefresh = () => {
    if (!lastGenerated) return true;
    const hoursSince = (Date.now() - new Date(lastGenerated).getTime()) / (1000 * 60 * 60);
    return hoursSince >= 24;
  };

  const loadCachedStats = async () => {
    const { data } = await supabase
      .from('prediction_stats')
      .select('stats_json, generated_at')
      .eq('prediction_id', predictionId)
      .maybeSingle();

    if (data?.stats_json && typeof data.stats_json === 'object') {
      setStats(data.stats_json as Record<string, any>);
      if (data.generated_at) setLastGenerated(data.generated_at);
      return true;
    }

    return false;
  };

  const runStatsRequest = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-prediction-stats', {
        body: { prediction_id: predictionId, ...(forceRefresh ? { force_refresh: true } : {}) },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (data?.stats) {
        setStats(data.stats);
        const genAt = data.stats?._generated_at;
        if (genAt) setLastGenerated(genAt);
      }
    } catch (e: any) {
      if (!stats) {
        setError(e.message || 'Failed to load stats');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (stats) {
      setIsOpen(!isOpen);
      return;
    }

    setIsOpen(true);
    setError(null);
    const hadCachedStats = await loadCachedStats();

    if (hadCachedStats) {
      // Have cached data — show it instantly, don't re-fetch
      return;
    }

    // No cache — generate fresh
    await runStatsRequest(false);
  };

  const refreshStats = async () => {
    if (!canRefresh()) return;
    setError(null);
    await runStatsRequest(true);
  };

  const directionIcon = (dir: string) => {
    const d = dir?.toLowerCase();
    if (d === 'bullish' || d === 'for') return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    if (d === 'bearish' || d === 'against') return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const renderSportsStats = (s: Record<string, any>) => (
    <div className="space-y-4">
      {s.head_to_head && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Head-to-Head</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{s.head_to_head.summary}</p>
          {s.head_to_head.records?.map((r: any, i: number) => (
            <div key={i} className="flex justify-between text-xs py-1 border-t border-border/20">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="text-foreground font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {s.form_guide && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2 mb-3">
            <LineChart className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Form Guide</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[s.form_guide.team_a, s.form_guide.team_b].filter(Boolean).map((team: any, ti: number) => (
              <div key={ti}>
                <p className="text-xs font-semibold text-foreground mb-1">{team.name}</p>
                {team.recent?.slice(0, 4).map((m: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs py-0.5 gap-2">
                    <span className="text-muted-foreground truncate">{m.opponent}</span>
                    <span className={`font-medium ${m.result?.startsWith('W') ? 'text-emerald-400' : m.result?.startsWith('L') ? 'text-red-400' : 'text-amber-400'}`}>
                      {m.result}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {s.key_stats?.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Key Stats</h4>
          <div className="space-y-1">
            {s.key_stats.map((stat: any, i: number) => (
              <div key={i} className="grid grid-cols-3 text-xs py-1 border-t border-border/20 gap-2">
                <span className="text-foreground font-medium">{stat.team_a}</span>
                <span className="text-center text-muted-foreground">{stat.label}</span>
                <span className="text-right text-foreground font-medium">{stat.team_b}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderCryptoStats = (s: Record<string, any>) => (
    <div className="space-y-4">
      {s.price_context && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Price Context</h4>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-sm font-bold text-foreground">{s.price_context.current_price}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">7D</p>
              <p className={`text-sm font-bold ${s.price_context.price_7d_change?.includes('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                {s.price_context.price_7d_change}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">30D</p>
              <p className={`text-sm font-bold ${s.price_context.price_30d_change?.includes('-') ? 'text-red-400' : 'text-emerald-400'}`}>
                {s.price_context.price_30d_change}
              </p>
            </div>
          </div>
        </div>
      )}

      {s.key_metrics?.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Key Metrics</h4>
          {s.key_metrics.map((m: any, i: number) => (
            <div key={i} className="flex justify-between text-xs py-1 border-t border-border/20">
              <span className="text-muted-foreground">{m.label}</span>
              <span className="text-foreground font-medium">{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {s.market_sentiment && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Market Sentiment</h4>
          <p className="text-xs text-muted-foreground mb-2">{s.market_sentiment.summary}</p>
          {s.market_sentiment.signals?.map((sig: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs py-0.5">
              {directionIcon(sig.direction)}
              <span className="text-foreground">{sig.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDefaultStats = (s: Record<string, any>) => (
    <div className="space-y-4">
      {s.context?.summary && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-1">Context</h4>
          <p className="text-xs text-muted-foreground">{s.context.summary}</p>
        </div>
      )}

      {s.key_factors?.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-2">Key Factors</h4>
          {s.key_factors.map((f: any, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs py-1 border-t border-border/20">
              {directionIcon(f.direction)}
              <div>
                <span className="text-foreground font-medium">{f.label}</span>
                <p className="text-muted-foreground">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {s.historical_precedent?.summary && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
          <h4 className="text-sm font-semibold text-foreground mb-1">Historical Precedent</h4>
          <p className="text-xs text-muted-foreground">{s.historical_precedent.summary}</p>
        </div>
      )}
    </div>
  );

  const renderStats = () => {
    if (!stats) return null;
    if (category === 'sports') return renderSportsStats(stats);
    if (category === 'crypto') return renderCryptoStats(stats);
    return renderDefaultStats(stats);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card mt-6 overflow-hidden"
    >
      <button
        onClick={fetchStats}
        className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-display font-semibold text-lg text-foreground">AI Stats & Analysis</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">AI</span>
        </div>
        {isOpen ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 md:px-6 pb-4 md:pb-6">
              {loading && !stats ? (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Generating analysis...</span>
                </div>
              ) : error ? (
                <div className="text-center py-6">
                  <p className="text-sm text-red-400 mb-2">{error}</p>
                  <Button variant="outline" size="sm" onClick={refreshStats}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Retry
                  </Button>
                </div>
              ) : (
                <>
                  {renderStats()}
                  {stats?.insight && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/30">
                      <div className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground font-medium">{stats.insight}</p>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground gap-2">
                    <span>{isRefreshing ? 'Refreshing latest analysis…' : 'AI-generated • Refreshes every 24h'}</span>
                    <button onClick={refreshStats} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PredictionStats;
