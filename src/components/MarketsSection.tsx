import { useState } from 'react';
import { motion } from 'framer-motion';
import { predictions } from '@/data/predictions';
import PredictionCard from './PredictionCard';
import MarketFilters from './MarketFilters';

const MarketsSection = () => {
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredPredictions = activeCategory === 'all'
    ? predictions
    : predictions.filter(p => p.category === activeCategory);

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
          />
        </motion.div>

        {/* Markets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPredictions.map((prediction, index) => (
            <PredictionCard
              key={prediction.id}
              prediction={prediction}
              index={index}
            />
          ))}
        </div>

        {filteredPredictions.length === 0 && (
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
