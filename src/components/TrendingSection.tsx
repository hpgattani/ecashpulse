import { motion } from 'framer-motion';
import { usePredictions } from '@/hooks/usePredictions';
import { TrendingUp, Flame, Loader2 } from 'lucide-react';

const TrendingSection = () => {
  const { predictions, loading } = usePredictions();
  
  // Show top 5 predictions by volume as trending
  const trendingPredictions = predictions
    .sort((a, b) => (b.yesOdds + b.noOdds) - (a.yesOdds + a.noOdds))
    .slice(0, 5);

  if (loading) {
    return (
      <section id="trending" className="py-12 sm:py-16 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (trendingPredictions.length === 0) {
    return null;
  }

  return (
    <section id="trending" className="py-12 sm:py-16 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-6 sm:mb-8"
        >
          <div className="p-2 rounded-lg bg-primary/10">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold">Trending Now</h2>
        </motion.div>

        {/* Trending Cards */}
        <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-4 -mx-4 px-4 snap-x scrollbar-hide">
          {trendingPredictions.map((prediction, index) => (
            <motion.div
              key={prediction.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 w-[260px] sm:w-[300px] md:w-[350px] glass-card p-3 sm:p-4 snap-start"
            >
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {prediction.category}
                </span>
                <div className="flex items-center gap-1 text-emerald-400 text-xs sm:text-sm">
                  <TrendingUp className="w-3 h-3" />
                  Hot
                </div>
              </div>
              
              <h3 className="font-display font-semibold text-foreground text-sm sm:text-base mb-3 sm:mb-4 line-clamp-2">
                {prediction.question}
              </h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="text-center">
                    <div className="text-base sm:text-lg font-bold text-emerald-400">{prediction.yesOdds}%</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">Yes</div>
                  </div>
                  <div className="w-px h-6 sm:h-8 bg-border" />
                  <div className="text-center">
                    <div className="text-base sm:text-lg font-bold text-red-400">{prediction.noOdds}%</div>
                    <div className="text-[10px] sm:text-xs text-muted-foreground">No</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs sm:text-sm font-semibold text-foreground">
                    {prediction.volume >= 1 
                      ? `$${(prediction.volume / 1000).toFixed(1)}K`
                      : `${(prediction.volume * 33333).toFixed(0)} XEC`
                    }
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">Volume</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrendingSection;