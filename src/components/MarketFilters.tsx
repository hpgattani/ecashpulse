import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Globe, Landmark, Trophy, Bitcoin, DollarSign, Globe2, 
  BarChart3, Cpu, Theater, Map, TrendingUp, Leaf, Vote, Film 
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
    { id: 'all', name: t.all, Icon: Globe, color: 'text-blue-400' },
    { id: 'politics', name: t.politics, Icon: Landmark, color: 'text-slate-400' },
    { id: 'sports', name: t.sports, Icon: Trophy, color: 'text-amber-400' },
    { id: 'crypto', name: t.crypto, Icon: Bitcoin, color: 'text-orange-400' },
    { id: 'finance', name: t.finance, Icon: DollarSign, color: 'text-emerald-400' },
    { id: 'geopolitics', name: t.geopolitics, Icon: Globe2, color: 'text-amber-500' },
    { id: 'earnings', name: t.earnings, Icon: BarChart3, color: 'text-violet-400' },
    { id: 'tech', name: t.tech, Icon: Cpu, color: 'text-cyan-400' },
    { id: 'entertainment', name: t.entertainment, Icon: Film, color: 'text-pink-400' },
    { id: 'culture', name: t.culture, Icon: Theater, color: 'text-fuchsia-400' },
    { id: 'world', name: t.world, Icon: Map, color: 'text-teal-400' },
    { id: 'economics', name: t.economics, Icon: TrendingUp, color: 'text-lime-400' },
    { id: 'climate', name: t.climate, Icon: Leaf, color: 'text-green-400' },
    { id: 'elections', name: t.elections, Icon: Vote, color: 'text-indigo-400' },
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
          <category.Icon 
            className={`w-4 h-4 ${activeCategory === category.id ? 'text-primary-foreground' : category.color}`}
          />
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
