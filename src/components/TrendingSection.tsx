import { motion } from 'framer-motion';
import { predictions } from '@/data/predictions';
import { TrendingUp, Flame } from 'lucide-react';

const TrendingSection = () => {
  const trendingPredictions = predictions.filter(p => p.trending);

  return (
    <section id="trending" className="py-16 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="p-2 rounded-lg bg-primary/10">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold">Trending Now</h2>
        </motion.div>

        {/* Trending Cards */}
        <div className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x">
          {trendingPredictions.map((prediction, index) => (
            <motion.div
              key={prediction.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="flex-shrink-0 w-[300px] md:w-[350px] glass-card p-4 snap-start"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  {prediction.category}
                </span>
                {prediction.change24h && prediction.change24h > 0 && (
                  <div className="flex items-center gap-1 text-emerald-400 text-sm">
                    <TrendingUp className="w-3 h-3" />
                    +{prediction.change24h}%
                  </div>
                )}
              </div>
              
              <h3 className="font-display font-semibold text-foreground mb-4 line-clamp-2">
                {prediction.question}
              </h3>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-400">{prediction.yesOdds}%</div>
                    <div className="text-xs text-muted-foreground">Yes</div>
                  </div>
                  <div className="w-px h-8 bg-border" />
                  <div className="text-center">
                    <div className="text-lg font-bold text-red-400">{prediction.noOdds}%</div>
                    <div className="text-xs text-muted-foreground">No</div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-semibold text-foreground">
                    ${(prediction.volume / 1000000).toFixed(1)}M
                  </div>
                  <div className="text-xs text-muted-foreground">Volume</div>
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
