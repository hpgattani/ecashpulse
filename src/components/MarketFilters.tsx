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
    { id: 'all', name: t.all, icon: '🌐' },
    { id: 'crypto', name: t.crypto, icon: '₿' },
    { id: 'politics', name: t.politics, icon: '🏛️' },
    { id: 'elections', name: t.elections, icon: '🗳️' },
    { id: 'sports', name: t.sports, icon: '⚽' },
    { id: 'economics', name: t.economics, icon: '📈' },
    { id: 'entertainment', name: t.entertainment, icon: '🎬' },
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-8">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`
            relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
            ${activeCategory === category.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }
          `}
        >
          <span className="mr-1.5">{category.icon}</span>
          {category.name}
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
