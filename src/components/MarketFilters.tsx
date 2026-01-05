import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Globe, Landmark, Trophy, Bitcoin, DollarSign, Globe2, 
  BarChart3, Cpu, Theater, Map, TrendingUp, Leaf, Vote 
} from 'lucide-react';

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
    { id: 'all', name: t.all, Icon: Globe },
    { id: 'politics', name: t.politics, Icon: Landmark },
    { id: 'sports', name: t.sports, Icon: Trophy },
    { id: 'crypto', name: t.crypto, Icon: Bitcoin },
    { id: 'finance', name: t.finance, Icon: DollarSign },
    { id: 'geopolitics', name: t.geopolitics, Icon: Globe2 },
    { id: 'earnings', name: t.earnings, Icon: BarChart3 },
    { id: 'tech', name: t.tech, Icon: Cpu },
    { id: 'culture', name: t.culture, Icon: Theater },
    { id: 'world', name: t.world, Icon: Map },
    { id: 'economics', name: t.economics, Icon: TrendingUp },
    { id: 'climate', name: t.climate, Icon: Leaf },
    { id: 'elections', name: t.elections, Icon: Vote },
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
            relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-1.5
            ${activeCategory === category.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }
          `}
        >
          <category.Icon className="w-4 h-4" />
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
