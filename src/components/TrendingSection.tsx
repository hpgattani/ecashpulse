import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { usePredictions } from '@/hooks/usePredictions';
import { TrendingUp, Flame, Loader2, ChevronLeft, ChevronRight, Bitcoin, Landmark, Trophy, Cpu, Film, Vote, DollarSign, Globe2, BarChart3, Map, Leaf, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const TrendingSection = () => {
  const { predictions, loading } = usePredictions();
  const { t, translateTitle } = useLanguage();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Parallax scroll effect
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });

  const leftOrbY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const rightOrbY = useTransform(scrollYProgress, [0, 1], [-40, 80]);
  const leftOrbX = useTransform(scrollYProgress, [0, 1], [-20, 20]);
  const rightOrbX = useTransform(scrollYProgress, [0, 1], [20, -20]);
  
  // Show top 5 predictions sorted by volume (highest XEC first)
  const trendingPredictions = [...predictions]
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 5);

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container || trendingPredictions.length === 0) return;

    const child = container.children.item(index) as HTMLElement | null;
    if (!child) return;

    container.scrollTo({
      left: child.offsetLeft,
      behavior: 'smooth',
    });
  }, [trendingPredictions.length]);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (isPaused || trendingPredictions.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % trendingPredictions.length;
        scrollToIndex(next);
        return next;
      });
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isPaused, trendingPredictions.length, scrollToIndex]);

  const handlePrev = () => {
    const prev = currentIndex === 0 ? trendingPredictions.length - 1 : currentIndex - 1;
    setCurrentIndex(prev);
    scrollToIndex(prev);
  };

  const handleNext = () => {
    const next = (currentIndex + 1) % trendingPredictions.length;
    setCurrentIndex(next);
    scrollToIndex(next);
  };

  const getCategoryIcon = (category: string) => {
    const categoryConfig: Record<string, { Icon: React.ComponentType<{ className?: string }>, gradient: string }> = {
      crypto: { Icon: Bitcoin, gradient: 'from-orange-400 via-amber-500 to-orange-600' },
      politics: { Icon: Landmark, gradient: 'from-slate-400 via-slate-500 to-slate-600' },
      sports: { Icon: Trophy, gradient: 'from-amber-400 via-yellow-500 to-amber-600' },
      tech: { Icon: Cpu, gradient: 'from-cyan-400 via-blue-500 to-cyan-600' },
      entertainment: { Icon: Film, gradient: 'from-pink-400 via-rose-500 to-pink-600' },
      economics: { Icon: TrendingUp, gradient: 'from-lime-400 via-green-500 to-lime-600' },
      elections: { Icon: Vote, gradient: 'from-indigo-400 via-blue-500 to-indigo-600' },
      finance: { Icon: DollarSign, gradient: 'from-emerald-400 via-green-500 to-emerald-600' },
      geopolitics: { Icon: Globe2, gradient: 'from-amber-500 via-orange-500 to-amber-600' },
      earnings: { Icon: BarChart3, gradient: 'from-violet-400 via-purple-500 to-violet-600' },
      world: { Icon: Map, gradient: 'from-teal-400 via-cyan-500 to-teal-600' },
      climate: { Icon: Leaf, gradient: 'from-green-400 via-emerald-500 to-green-600' },
      culture: { Icon: Film, gradient: 'from-pink-400 via-rose-500 to-pink-600' },
    };
    const config = categoryConfig[category] || { Icon: Globe, gradient: 'from-blue-400 via-sky-500 to-blue-600' };
    return (
      <span className={`relative bg-gradient-to-br ${config.gradient} p-1.5 rounded-lg shadow-sm ring-1 ring-border/40`}>
        <span className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-b from-foreground/20 via-transparent to-transparent opacity-70" />
        <config.Icon className="relative w-3.5 h-3.5 text-white" />
      </span>
    );
  };

  const getCategoryLabel = (category: string) => {
    const categoryMap: Record<string, keyof typeof t> = {
      crypto: 'crypto',
      politics: 'politics',
      sports: 'sports',
      tech: 'tech',
      entertainment: 'entertainment',
      economics: 'economics',
      elections: 'elections',
      finance: 'finance',
      geopolitics: 'geopolitics',
      earnings: 'earnings',
      world: 'world',
      climate: 'climate',
      culture: 'entertainment',
    };

    const key = categoryMap[category];
    return key ? (t[key] || category) : category;
  };

  if (loading) {
    return (
      <section id="trending" className="py-12 sm:py-16 relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </div>
      </section>
    );
  }

  if (trendingPredictions.length === 0) {
    return null;
  }

  return (
    <section ref={sectionRef} id="trending" className="py-12 sm:py-16 relative overflow-hidden">
      {/* Parallax ambient glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          style={{ y: leftOrbY, x: leftOrbX }}
          className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" 
        />
        <motion.div 
          style={{ y: rightOrbY, x: rightOrbX }}
          className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-accent/10 rounded-full blur-[80px]" 
        />
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Liquid glass container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="glass-card p-4 sm:p-6 relative overflow-hidden"
        >
          {/* Inner glow effects */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
          
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="relative p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <div className="absolute inset-0 rounded-xl bg-primary/10 blur-sm" />
                <Flame className="relative w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold">{t.trendingNow}</h2>
            </div>
            
            {/* Navigation arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrev}
                className="p-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-2 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-primary/10 hover:border-primary/30 transition-all duration-300"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Trending Cards */}
          <div 
            ref={scrollRef}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
            className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 snap-x snap-mandatory scrollbar-hide scroll-smooth -mx-1 px-1"
            style={{ scrollBehavior: 'smooth' }}
          >
            {trendingPredictions.map((prediction, index) => (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94], delay: index * 0.08 }}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => navigate(`/prediction/${prediction.id}`)}
                className="flex-shrink-0 w-[260px] sm:w-[300px] md:w-[340px] snap-start cursor-pointer group"
              >
                {/* Inner card with layered glass effect */}
                <div className="relative h-full p-3 sm:p-4 rounded-xl bg-background/40 dark:bg-background/60 backdrop-blur-md border border-border/40 hover:border-primary/40 transition-all duration-300 overflow-hidden">
                  {/* Hover glow */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-xl" />
                  
                  <div className="relative z-10">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(prediction.category)}
                        <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-medium">
                          {getCategoryLabel(prediction.category)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 text-xs font-medium">{t.hot}</span>
                      </div>
                    </div>
                    
                    <h3 className="font-display font-semibold text-foreground text-sm sm:text-base mb-3 sm:mb-4 line-clamp-2">
                      {translateTitle(prediction.question)}
                    </h3>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <div className="text-base sm:text-lg font-bold text-emerald-400">{prediction.yesOdds}%</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{t.yes}</div>
                        </div>
                        <div className="text-center px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                          <div className="text-base sm:text-lg font-bold text-red-400">{prediction.noOdds}%</div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground">{t.no}</div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-xs sm:text-sm font-semibold text-foreground">
                          {prediction.volume >= 1 
                            ? `$${(prediction.volume / 1000).toFixed(1)}K`
                            : `${(prediction.volume * 33333).toFixed(0)} XEC`
                          }
                        </div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground">{t.volume}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dot indicators */}
          <div className="flex justify-center gap-2 mt-4 pt-2">
            {trendingPredictions.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentIndex(index);
                  scrollToIndex(index);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentIndex 
                    ? 'bg-primary w-6 shadow-[0_0_8px_hsl(var(--primary)/0.5)]' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default TrendingSection;
