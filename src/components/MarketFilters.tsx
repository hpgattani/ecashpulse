import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  Globe, Landmark, Trophy, Bitcoin, DollarSign, Globe2, 
  BarChart3, Cpu, Map, TrendingUp, Leaf, Vote, Film 
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
          <span className={`bg-gradient-to-br ${category.gradient} p-1 rounded-lg shadow-sm`}>
            <category.Icon className="w-3.5 h-3.5 text-white" />
          </span>
          <span>
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
