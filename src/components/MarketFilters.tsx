import { motion } from 'framer-motion';
import { categories } from '@/data/predictions';

interface MarketFiltersProps {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
  activeTimeframe: 'all' | 'week' | 'month';
  onTimeframeChange: (timeframe: 'all' | 'week' | 'month') => void;
}

const timeframes: Array<{ id: 'all' | 'week' | 'month'; name: string; icon: string }> = [
  { id: 'all', name: 'Any time', icon: '🗂️' },
  { id: 'week', name: 'This week', icon: '📅' },
  { id: 'month', name: 'This month', icon: '🗓️' },
];

const MarketFilters = ({
  activeCategory,
  onCategoryChange,
  activeTimeframe,
  onTimeframeChange,
}: MarketFiltersProps) => {
  return (
    <div className="flex flex-col items-center gap-3 mb-8">
      <div className="flex flex-wrap gap-2 justify-center">
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

      <div className="flex flex-wrap gap-2 justify-center">
        {timeframes.map((tf) => (
          <motion.button
            key={tf.id}
            onClick={() => onTimeframeChange(tf.id)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`
              relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
              ${activeTimeframe === tf.id
                ? 'bg-secondary text-secondary-foreground shadow-lg'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }
            `}
          >
            <span className="mr-1.5">{tf.icon}</span>
            {tf.name}
            {activeTimeframe === tf.id && (
              <motion.div
                layoutId="activeTimeFilter"
                className="absolute inset-0 rounded-full bg-secondary -z-10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default MarketFilters;
