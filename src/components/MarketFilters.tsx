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
    { id: 'all', name: t.all, emoji: '🌐', color: 'text-blue-400' },
    { id: 'politics', name: t.politics, emoji: '🏛️', color: 'text-slate-400' },
    { id: 'sports', name: t.sports, emoji: '🏆', color: 'text-amber-400' },
    { id: 'crypto', name: t.crypto, emoji: '₿', color: 'text-orange-400' },
    { id: 'finance', name: t.finance, emoji: '💵', color: 'text-emerald-400' },
    { id: 'geopolitics', name: t.geopolitics, emoji: '🌍', color: 'text-amber-500' },
    { id: 'earnings', name: t.earnings, emoji: '📊', color: 'text-violet-400' },
    { id: 'tech', name: t.tech, emoji: '💻', color: 'text-cyan-400' },
    { id: 'entertainment', name: t.entertainment, emoji: '🎭', color: 'text-pink-400' },
    { id: 'world', name: t.world, emoji: '🗺️', color: 'text-teal-400' },
    { id: 'economics', name: t.economics, emoji: '📈', color: 'text-lime-400' },
    { id: 'climate', name: t.climate, emoji: '🌱', color: 'text-green-400' },
    { id: 'elections', name: t.elections, emoji: '🗳️', color: 'text-indigo-400' },
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
          <span className="text-base">
            {category.emoji}
          </span>
          <span className={activeCategory !== category.id ? category.color : ''}>
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
