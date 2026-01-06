import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePredictions } from '@/hooks/usePredictions';
import { useCryptoPrices } from '@/hooks/useCryptoPrices';
import PredictionCard from './PredictionCard';
import MarketFilters from './MarketFilters';
import { Loader2, Search, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';

const MarketsSection = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const { predictions, loading, error } = usePredictions();
  const { getPriceForCrypto } = useCryptoPrices();
  const { t, translateTitle } = useLanguage();

  // No longer show temperature on climate cards - remove weather data display
  const getClimateData = (_category: string) => {
    // Disabled - was showing single city temp which wasn't meaningful
    return null;
  };

  // Generate search suggestions based on predictions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase();
    const matches = predictions
      .filter(p => 
        p.question.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .map(p => ({
        id: p.id,
        text: translateTitle(p.question),
        category: p.category,
      }));
    
    return matches;
  }, [searchQuery, predictions, translateTitle]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (suggestion: { text: string }) => {
    setSearchQuery(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const filteredPredictions = predictions.filter((p) => {
    const matchesCategory = activeCategory === 'all' ? true : p.category === activeCategory;
    const matchesSearch = searchQuery.trim() === '' 
      ? true 
      : p.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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
            {t.activeMarkets.split(' ')[0]}{' '}
            <span className="gradient-text">{t.activeMarkets.split(' ').slice(1).join(' ')}</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t.browseMarkets}
          </p>
        </motion.div>

        {/* Search Bar with Liquid Glass Effect & Neon Glow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-lg mx-auto mb-8 relative group"
        >
          {/* Neon glow layer - appears on focus/hover */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 opacity-0 group-focus-within:opacity-100 group-hover:opacity-60 blur-xl transition-opacity duration-500" />
          
          {/* Secondary neon pulse */}
          <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 opacity-0 group-focus-within:opacity-100 blur-md transition-opacity duration-300" />
          
          {/* Outer glass container with gradient border */}
          <div className="relative p-[2px] rounded-full bg-gradient-to-r from-primary/30 via-white/10 to-accent/30 dark:from-primary/40 dark:via-white/[0.08] dark:to-accent/40 group-focus-within:from-primary/50 group-focus-within:via-white/20 group-focus-within:to-accent/50 transition-all duration-300">
            {/* Inner liquid glass bar */}
            <div className="relative flex items-center rounded-full bg-background/70 dark:bg-[hsl(220,20%,12%)] backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25),inset_0_-1px_0_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08),0_0_20px_rgba(45,212,191,0.1)] group-focus-within:shadow-[0_8px_40px_rgba(45,212,191,0.2),inset_0_1px_0_rgba(255,255,255,0.3),0_0_30px_rgba(45,212,191,0.15)] dark:group-focus-within:shadow-[0_8px_50px_rgba(45,212,191,0.3),inset_0_1px_0_rgba(255,255,255,0.1),0_0_40px_rgba(45,212,191,0.2)] transition-shadow duration-300">
              <Search className="absolute left-4 h-5 w-5 text-primary/80 group-focus-within:text-primary transition-colors duration-300" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-12 pr-12 py-3 h-12 bg-transparent border-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-foreground/60 dark:placeholder:text-foreground/50 text-foreground font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSuggestions(false);
                  }}
                  className="absolute right-4 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Suggestions Dropdown */}
          <AnimatePresence>
            {showSuggestions && searchSuggestions.length > 0 && (
              <motion.div
                ref={suggestionsRef}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="absolute z-50 w-full mt-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
              >
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.id}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors flex items-center gap-3 ${
                      index !== searchSuggestions.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                  >
                    <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{suggestion.text}</p>
                      <p className="text-xs text-muted-foreground capitalize">{suggestion.category}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
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
