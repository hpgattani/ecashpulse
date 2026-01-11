import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useLanguage } from '@/contexts/LanguageContext';

type Prediction = Tables<'predictions'>;

const ResolvedBets = () => {
  const navigate = useNavigate();
  const [resolvedPredictions, setResolvedPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, translateTitle, language } = useLanguage();

  useEffect(() => {
    fetchResolved();

    const channel = supabase
      .channel('resolved-predictions')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'predictions',
        },
        (payload) => {
          if (payload.new.status?.startsWith('resolved')) {
            fetchResolved();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchResolved = async () => {
    const { data } = await supabase
      .from('predictions')
      .select('*')
      .or('status.eq.resolved_yes,status.eq.resolved_no')
      .order('resolved_at', { ascending: false })
      .limit(6);

    if (data) {
      setResolvedPredictions(data);
    }
    setLoading(false);
  };

  const formatXEC = (satoshis: number) => {
    const xec = satoshis / 100;
    return xec.toLocaleString() + ' XEC';
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading || resolvedPredictions.length === 0) {
    return null;
  }

  return (
    <section className="py-8 sm:py-16 relative">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="font-display text-2xl md:text-3xl font-bold">
              {t.recentlyResolved.split(' ')[0]} <span className="gradient-text">{t.recentlyResolved.split(' ').slice(1).join(' ')}</span>
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            {t.resolvedSubtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resolvedPredictions.map((prediction, index) => {
            const isYesWin = prediction.status === 'resolved_yes';
            const totalPool = prediction.yes_pool + prediction.no_pool;

            return (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/prediction/${prediction.id}`)}
                className="glass-card p-4 border-l-4 cursor-pointer hover:bg-muted/30 transition-colors"
                style={{
                  borderLeftColor: isYesWin ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'
                }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge
                    variant="outline"
                    className={isYesWin 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-red-500/10 text-red-400 border-red-500/30'
                    }
                  >
                    {isYesWin ? (
                      <><TrendingUp className="w-3 h-3 mr-1" /> {t.yesWon}</>
                    ) : (
                      <><TrendingDown className="w-3 h-3 mr-1" /> {t.noWon}</>
                    )}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDate(prediction.resolved_at)}
                  </span>
                </div>

                <h3 className="font-display font-semibold text-foreground text-sm mb-3 line-clamp-2">
                  {translateTitle(prediction.title)}
                </h3>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{t.totalPool}</span>
                  <span className="font-semibold text-primary">{formatXEC(totalPool)}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ResolvedBets;
