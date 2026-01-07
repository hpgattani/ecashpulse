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
    <div className="flex flex-wrap gap-2 justify-center mb-8 mx-auto">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => onCategoryChange(category.id)}
          whileTap={{ scale: 0.96 }}
          className={`
            relative px-4 py-2.5 text-sm font-medium flex items-center gap-2 rounded-full
            transition-colors duration-200
            ${activeCategory === category.id
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          {/* Liquid glass active indicator - morphs between buttons */}
          {activeCategory === category.id && (
            <motion.div
              layoutId="liquidGlassFilter"
              className="absolute inset-0 rounded-full liquid-glass-button"
              style={{
                background: 'hsl(var(--primary))',
              }}
              transition={{ 
                type: 'spring', 
                stiffness: 400, 
                damping: 30,
                mass: 0.8,
              }}
            />
          )}
          
          {/* Inactive state background */}
          {activeCategory !== category.id && (
            <div className="absolute inset-0 rounded-full bg-muted/60 border border-border/40" />
          )}
          
          {/* Icon with gradient */}
          <span className={`relative z-10 bg-gradient-to-br ${category.gradient} p-1 rounded-lg shadow-sm ring-1 ring-white/20`}>
            <span className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-white/30 via-transparent to-transparent" />
            <category.Icon className="relative w-3.5 h-3.5 text-white" />
          </span>
          
          {/* Label */}
          <span className="relative z-10">
            {category.name}
          </span>
        </motion.button>
      ))}
    </div>
  );
};

export default MarketFilters;