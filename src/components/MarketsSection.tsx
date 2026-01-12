import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePredictions } from '@/hooks/usePredictions';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import PredictionCard from './PredictionCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { Skeleton } from '@/components/ui/skeleton';

interface MarketsSectionProps {
  activeCategory: string;
  searchQuery: string;
}

const MarketsSection = ({ activeCategory, searchQuery }: MarketsSectionProps) => {
  const { predictions, loading, error } = usePredictions();
  const { getPriceForCrypto } = useCryptoPrices();
  const { t } = useLanguage();

  // No longer show temperature on climate cards - remove weather data display
  const getClimateData = (_category: string) => {
    // Disabled - was showing single city temp which wasn't meaningful
    return null;
  };

  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      const matchesCategory = activeCategory === 'all' ? true : p.category === activeCategory;
      const matchesSearch = searchQuery.trim() === '' 
        ? true 
        : p.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [predictions, activeCategory, searchQuery]);

  return (
    <section id="markets" className="py-8 sm:py-12 relative">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
            {t.activeMarkets.split(' ')[0]}{' '}
            <span className="gradient-text">{t.activeMarkets.split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t.browseMarkets}
          </p>
        </motion.div>

        {/* Loading State - Skeleton Cards */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="glass-card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton className="h-12 w-full" />
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <p className="text-destructive">{t.failedToLoad}</p>
          </motion.div>
        )}

        {/* Markets Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredPredictions.map((prediction, index) => (
              <PredictionCard
                key={prediction.id}
                prediction={prediction}
                index={index}
                livePrice={prediction.category === 'crypto' ? getPriceForCrypto(prediction.question) : null}
                climateData={getClimateData(prediction.category)}
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
            <p className="text-muted-foreground">{t.noMarketsFound}</p>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default MarketsSection;
