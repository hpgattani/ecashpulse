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
    { id: 'all', name: t.all, Icon: Globe, color: 'from-blue-400 to-cyan-400' },
    { id: 'politics', name: t.politics, Icon: Landmark, color: 'from-slate-400 to-zinc-300' },
    { id: 'sports', name: t.sports, Icon: Trophy, color: 'from-amber-400 to-yellow-300' },
    { id: 'crypto', name: t.crypto, Icon: Bitcoin, color: 'from-orange-400 to-amber-300' },
    { id: 'finance', name: t.finance, Icon: DollarSign, color: 'from-emerald-400 to-green-300' },
    { id: 'geopolitics', name: t.geopolitics, Icon: Globe2, color: 'from-red-400 to-rose-300' },
    { id: 'earnings', name: t.earnings, Icon: BarChart3, color: 'from-violet-400 to-purple-300' },
    { id: 'tech', name: t.tech, Icon: Cpu, color: 'from-cyan-400 to-blue-300' },
    { id: 'entertainment', name: t.entertainment, Icon: Film, color: 'from-pink-400 to-rose-300' },
    { id: 'culture', name: t.culture, Icon: Theater, color: 'from-fuchsia-400 to-pink-300' },
    { id: 'world', name: t.world, Icon: Map, color: 'from-teal-400 to-emerald-300' },
    { id: 'economics', name: t.economics, Icon: TrendingUp, color: 'from-lime-400 to-green-300' },
    { id: 'climate', name: t.climate, Icon: Leaf, color: 'from-green-400 to-emerald-300' },
    { id: 'elections', name: t.elections, Icon: Vote, color: 'from-indigo-400 to-blue-300' },
  ];

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-8">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          className={`
            relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-1.5 overflow-hidden
            ${activeCategory === category.id
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
              : 'bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50'
            }
          `}
        >
          <span className={`relative bg-gradient-to-br ${category.color} bg-clip-text`}>
            <category.Icon 
              className={`w-4 h-4 ${activeCategory === category.id ? 'text-primary-foreground' : ''}`}
              style={activeCategory !== category.id ? { 
                filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.3))',
              } : {}}
            />
          </span>
          <span className={activeCategory !== category.id ? `bg-gradient-to-r ${category.color} bg-clip-text text-transparent font-semibold` : ''}>
            {category.name}
          </span>
          {activeCategory === category.id && (
            <motion.div
              layoutId="activeCategoryFilter"
              className="absolute inset-0 rounded-full bg-primary -z-10"
              transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
            />
          )}
          {/* Sheen effect on hover */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
            whileHover={{ translateX: '100%' }}
            transition={{ duration: 0.5 }}
          />
        </motion.button>
      ))}
    </div>
  );
};

export default MarketFilters;
