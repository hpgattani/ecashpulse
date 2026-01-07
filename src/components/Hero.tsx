import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap, Plus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Hero = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax scroll effect
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"]
  });

  const leftOrbY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const rightOrbY = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const centerOrbY = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const leftOrbX = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const rightOrbX = useTransform(scrollYProgress, [0, 1], [0, 50]);

  return (
    <section ref={sectionRef} className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Parallax ambient orbs - very subtle */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          style={{ y: leftOrbY, x: leftOrbX }}
          className="absolute top-1/4 left-[10%] w-[500px] h-[500px] bg-primary/[0.03] rounded-full blur-[150px]" 
        />
        <motion.div 
          style={{ y: rightOrbY, x: rightOrbX }}
          className="absolute top-1/3 right-[10%] w-[400px] h-[400px] bg-accent/[0.03] rounded-full blur-[120px]" 
        />
        <motion.div 
          style={{ y: centerOrbY }}
          className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/[0.02] rounded-full blur-[100px]" 
        />
      </div>
      
      {/* Background grid - handled by LightModeOrbs component */}
      {/* Background grid - handled by LightModeOrbs component */}
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.a
            href="https://e.cash"
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-primary/30 mb-8 cursor-pointer no-hover-effect"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              {t.poweredBy} <span className="text-primary font-semibold">eCash (XEC)</span>
            </span>
          </motion.a>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            {t.heroTitle1}
            <br />
            <span className="gradient-text">{t.heroTitle2}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            {t.heroSubtitle}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 px-4 sm:px-0"
          >
            <Button 
              variant="glow" 
              size="lg" 
              className="w-full sm:w-auto text-base px-8 py-4 h-auto"
              onClick={() => document.getElementById('markets')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.startTrading}
              <ArrowRight className="w-5 h-5" />
            </Button>
            <Button 
              variant="glass" 
              size="lg" 
              className="w-full sm:w-auto text-base px-8 py-4 h-auto"
              onClick={() => document.getElementById('trending')?.scrollIntoView({ behavior: 'smooth' })}
            >
              {t.exploreMarkets}
            </Button>
          </motion.div>

          {/* Create Prediction CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mb-16"
          >
            <button
              onClick={() => navigate('/create-prediction')}
              className="group inline-flex items-center gap-2 px-6 py-3 rounded-full border border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <Plus className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {t.createPrediction || "Create Your Own Prediction"} 
                <span className="text-primary ml-1">($1)</span>
              </span>
            </button>
          </motion.div>

          {/* Wallet Info - Separate Liquid Glass buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="inline-flex flex-col sm:flex-row items-center justify-center gap-4 px-4"
          >
            <a 
              href="https://cashtab.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="liquid-glass-button group px-6 py-3.5 flex items-center justify-center gap-3 w-full sm:w-[240px] whitespace-nowrap"
            >
              <Zap className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              <span className="text-foreground font-medium">{t.payWithCashtab}</span>
            </a>
            <a 
              href="https://marlinwallet.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="liquid-glass-button group px-6 py-3.5 flex items-center justify-center gap-3 w-full sm:w-[240px] whitespace-nowrap"
            >
              <Shield className="w-5 h-5 text-accent group-hover:scale-110 transition-transform" />
              <span className="text-foreground font-medium">{t.payWithMarlin}</span>
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator - Centered */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 inset-x-0 flex justify-center"
      >
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-1">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-3 rounded-full bg-primary"
          />
        </div>
      </motion.div>
    </section>
  );
};

export default Hero;
