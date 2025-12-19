import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePredictions } from '@/hooks/usePredictions';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import PredictionCard from './PredictionCard';
import MarketFilters from './MarketFilters';
import { Loader2 } from 'lucide-react';

const MarketsSection = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeTimeframe, setActiveTimeframe] = useState<'all' | 'week' | 'month'>('all');
  const { predictions, loading, error } = usePredictions();
  const { getPriceForCrypto } = useCryptoPrices();


  // Timeframe filter:
  // - matches markets CREATED within the last N days ("new this week/month")
  // - OR markets ENDING within the next N days ("ending soon")
  const matchesTimeframe = (createdAt: string | undefined, endDate: string | undefined, days: number) => {
    const nowMs = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;

    const createdMs = createdAt ? new Date(createdAt).getTime() : NaN;
    const endMs = endDate ? new Date(endDate).getTime() : NaN;

    const createdDiff = nowMs - createdMs; // how long ago it was created
    const endDiff = endMs - nowMs; // how long until it ends

    const isNewWithinWindow = Number.isFinite(createdDiff) && createdDiff >= 0 && createdDiff <= windowMs;
    const isEndingWithinWindow = Number.isFinite(endDiff) && endDiff >= 0 && endDiff <= windowMs;

    return isNewWithinWindow || isEndingWithinWindow;
  };

  const filteredPredictions = predictions.filter((p) => {
    const categoryOk = activeCategory === 'all' ? true : p.category === activeCategory;
    const timeOk =
      activeTimeframe === 'all'
        ? true
        : activeTimeframe === 'week'
          ? matchesTimeframe(p.createdAt, p.endDate, 7)
          : matchesTimeframe(p.createdAt, p.endDate, 30);

    return categoryOk && timeOk;
  });

  return (
    <section id="markets" className="py-20 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            Active <span className="gradient-text">Markets</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Browse prediction markets across categories. Place bets using eCash and win if your prediction is correct.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex justify-center"
        >
          <MarketFilters
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
            activeTimeframe={activeTimeframe}
            onTimeframeChange={setActiveTimeframe}
          />
        </motion.div>

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-destructive">Failed to load markets. Please try again.</p>
          </motion.div>
        )}

        {/* Markets Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPredictions.map((prediction, index) => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                index={index}
                livePrice={prediction.category === 'crypto' ? getPriceForCrypto(prediction.question) : null}
              />
            ))}
          </div>
        )}

        {!loading && !error && filteredPredictions.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-muted-foreground">No markets found in this category.</p>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default MarketsSection;
