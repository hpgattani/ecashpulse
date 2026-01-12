import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { triggerHaptic } from '@/hooks/useHaptic';
import { 
  Globe, Landmark, Trophy, Bitcoin, DollarSign, Globe2, 
  BarChart3, Cpu, Map, TrendingUp, Leaf, Vote, Film 
} from 'lucide-react';

interface MarketNavProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  predictions: Array<{ id: string; question: string; category: string }>;
}

const MarketNav = ({
  activeCategory,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  predictions,
}: MarketNavProps) => {
  const { t, translateTitle } = useLanguage();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const categories = [
    { id: 'all', name: t.all, Icon: Globe, gradient: 'from-blue-400 via-sky-500 to-blue-600' },
    { id: 'politics', name: t.politics, Icon: Landmark, gradient: 'from-slate-400 via-slate-500 to-slate-600' },
    { id: 'sports', name: t.sports, Icon: Trophy, gradient: 'from-amber-400 via-yellow-500 to-amber-600' },
    { id: 'crypto', name: t.crypto, Icon: Bitcoin, gradient: 'from-orange-400 via-amber-500 to-orange-600' },
    { id: 'finance', name: t.finance, Icon: DollarSign, gradient: 'from-emerald-400 via-green-500 to-emerald-600' },
    { id: 'geopolitics', name: t.geopolitics, Icon: Globe2, gradient: 'from-amber-500 via-orange-500 to-amber-600' },
    { id: 'earnings', name: t.earnings, Icon: BarChart3, gradient: 'from-violet-400 via-purple-500 to-violet-600' },
    { id: 'tech', name: t.tech, Icon: Cpu, gradient: 'from-cyan-400 via-blue-500 to-cyan-600' },
    { id: 'entertainment', name: t.entertainment, Icon: Film, gradient: 'from-pink-400 via-rose-500 to-pink-600' },
    { id: 'world', name: t.world, Icon: Map, gradient: 'from-teal-400 via-cyan-500 to-teal-600' },
    { id: 'economics', name: t.economics, Icon: TrendingUp, gradient: 'from-lime-400 via-green-500 to-lime-600' },
    { id: 'climate', name: t.climate, Icon: Leaf, gradient: 'from-green-400 via-emerald-500 to-green-600' },
    { id: 'elections', name: t.elections, Icon: Vote, gradient: 'from-indigo-400 via-blue-500 to-indigo-600' },
  ];

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
    onSearchChange(suggestion.text);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  return (
    <section id="market-nav" className="sticky top-16 z-40 py-4 bg-background/80 backdrop-blur-xl border-b border-border/30">
      <div className="container mx-auto px-4">
        {/* Search Bar - Centered */}
        <div className="max-w-lg mx-auto mb-4 relative group">
          {/* Neon glow layer */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 opacity-0 group-focus-within:opacity-100 group-hover:opacity-60 blur-xl transition-opacity duration-500" />
          
          {/* Outer glass container with gradient border */}
          <div className="relative p-[2px] rounded-full bg-gradient-to-r from-primary/30 via-white/10 to-accent/30 dark:from-primary/40 dark:via-white/[0.08] dark:to-accent/40 group-focus-within:from-primary/50 group-focus-within:via-white/20 group-focus-within:to-accent/50 transition-all duration-300">
            {/* Inner liquid glass bar */}
            <div className="relative flex items-center rounded-full bg-background/70 dark:bg-[hsl(220,20%,12%)] backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.25)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.08)] group-focus-within:shadow-[0_8px_40px_rgba(45,212,191,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] dark:group-focus-within:shadow-[0_8px_50px_rgba(45,212,191,0.3),inset_0_1px_0_rgba(255,255,255,0.1)] transition-shadow duration-300">
              <Search className="absolute left-4 h-5 w-5 text-primary/80 group-focus-within:text-primary transition-colors duration-300" />
              <Input
                ref={inputRef}
                type="text"
                placeholder={t.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => {
                  onSearchChange(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="pl-12 pr-12 py-3 h-12 bg-transparent border-0 focus:border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-foreground/60 dark:placeholder:text-foreground/50 text-foreground font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    onSearchChange('');
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
        </div>

        {/* Category Filters - Horizontal Scrollable */}
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 justify-center min-w-max px-2">
            {categories.map((category) => (
              <motion.button
                key={category.id}
                onClick={() => {
                  triggerHaptic('water');
                  onCategoryChange(category.id);
                }}
                whileTap={{ scale: 0.97 }}
                className={`
                  relative px-3 py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 rounded-full
                  transition-colors duration-300 whitespace-nowrap
                  ${activeCategory === category.id
                    ? 'text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {/* Active state background */}
                {activeCategory === category.id && (
                  <motion.div
                    layoutId="marketNavActiveCategory"
                    className="absolute inset-0 rounded-full overflow-hidden"
                    style={{ background: 'hsl(var(--primary))' }}
                    initial={false}
                    transition={{ type: 'tween', ease: [0.25, 0.1, 0.25, 1], duration: 0.4 }}
                  >
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)' }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </motion.div>
                )}
                
                {/* Inactive state background */}
                {activeCategory !== category.id && (
                  <motion.div 
                    className="absolute inset-0 rounded-full bg-muted/60 border border-border/40"
                    initial={false}
                    whileHover={{ backgroundColor: 'hsl(var(--muted) / 0.8)', transition: { duration: 0.2 } }}
                  />
                )}
                
                {/* Icon with gradient */}
                <span className={`relative z-10 bg-gradient-to-br ${category.gradient} p-1 rounded-lg shadow-sm ring-1 ring-white/20`}>
                  <category.Icon className="relative w-3 h-3 text-white" />
                </span>
                
                {/* Label */}
                <span className="relative z-10">{category.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketNav;
