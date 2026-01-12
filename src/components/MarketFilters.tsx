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

  // Trigger haptic feedback for water-like vibration effect
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      // Short burst pattern mimicking water ripple/droplet vibration
      navigator.vibrate([8, 30, 5]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 justify-center mb-8 mx-auto">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          onClick={() => {
            triggerHaptic();
            onCategoryChange(category.id);
          }}
          whileTap={{ scale: 0.97 }}
          className={`
            relative px-4 py-2.5 text-sm font-medium flex items-center gap-2 rounded-full
            transition-colors duration-300
            ${activeCategory === category.id
              ? 'text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          {/* Liquid glass water-flow indicator - smooth flowing transition like water */}
          {activeCategory === category.id && (
            <motion.div
              layoutId="liquidWaterFlow"
              className="absolute inset-0 rounded-full overflow-hidden"
              style={{
                background: 'hsl(var(--primary))',
              }}
              initial={false}
              transition={{ 
                type: 'tween',
                ease: [0.25, 0.1, 0.25, 1], // Smooth cubic-bezier like water settling
                duration: 0.4,
              }}
            >
              {/* Water ripple effect overlay */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3) 0%, transparent 50%)',
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
              {/* Subtle shimmer flow */}
              <motion.div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
                }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ 
                  duration: 0.6, 
                  ease: 'easeInOut',
                  delay: 0.1,
                }}
              />
            </motion.div>
          )}
          
          {/* Inactive state background */}
          {activeCategory !== category.id && (
            <motion.div 
              className="absolute inset-0 rounded-full bg-muted/60 border border-border/40"
              initial={false}
              whileHover={{ 
                backgroundColor: 'hsl(var(--muted) / 0.8)',
                transition: { duration: 0.2 }
              }}
            />
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