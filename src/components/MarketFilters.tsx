import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

interface MarketFiltersProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}

const MarketFilters = ({
  activeCategory,
  onCategoryChange,
}: MarketFiltersProps) => {
  const { t } = useLanguage();

  const categories = [
    { id: 'all', name: t.all, emoji: '🌐', gradient: 'from-blue-400 to-cyan-400' },
    { id: 'politics', name: t.politics, emoji: '🏛️', gradient: 'from-slate-400 to-zinc-500' },
    { id: 'sports', name: t.sports, emoji: '🏆', gradient: 'from-amber-400 to-yellow-500' },
    { id: 'crypto', name: t.crypto, emoji: '₿', gradient: 'from-orange-400 to-amber-500' },
    { id: 'finance', name: t.finance, emoji: '💵', gradient: 'from-emerald-400 to-green-500' },
    { id: 'geopolitics', name: t.geopolitics, emoji: '🌍', gradient: 'from-amber-500 to-orange-600' },
    { id: 'earnings', name: t.earnings, emoji: '📊', gradient: 'from-violet-400 to-purple-500' },
    { id: 'tech', name: t.tech, emoji: '💻', gradient: 'from-cyan-400 to-blue-500' },
    { id: 'entertainment', name: t.entertainment, emoji: '🎭', gradient: 'from-pink-400 to-rose-500' },
    { id: 'world', name: t.world, emoji: '🗺️', gradient: 'from-teal-400 to-cyan-500' },
    { id: 'economics', name: t.economics, emoji: '📈', gradient: 'from-lime-400 to-green-500' },
    { id: 'climate', name: t.climate, emoji: '🌱', gradient: 'from-green-400 to-emerald-500' },
    { id: 'elections', name: t.elections, emoji: '🗳️', gradient: 'from-indigo-400 to-blue-500' },
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-8">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          className={`
            relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-1.5
            ${activeCategory === category.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
            }
          `}
        >
          <span 
            className={`text-base drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] ${
              activeCategory !== category.id 
                ? `bg-gradient-to-br ${category.gradient} bg-clip-text` 
                : ''
            }`}
            style={{ 
              filter: activeCategory !== category.id ? 'drop-shadow(0 0 4px currentColor)' : 'none',
            }}
          >
            {category.emoji}
          </span>
          <span className={activeCategory !== category.id ? `bg-gradient-to-r ${category.gradient} bg-clip-text text-transparent font-semibold` : ''}>
            {category.name}
          </span>
          {activeCategory === category.id && (
            <motion.div
              layoutId="activeCategoryFilter"
              className="absolute inset-0 rounded-full bg-primary -z-10"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
        </motion.button>
      ))}
    </div>
  );
};

export default MarketFilters;
