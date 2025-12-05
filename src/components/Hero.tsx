import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Zap } from 'lucide-react';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-30" />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-[128px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card border-primary/30 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-muted-foreground">
              Powered by <span className="text-primary font-semibold">eCash (XEC)</span>
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight"
          >
            Predict the Future,
            <br />
            <span className="gradient-text">Bet with Confidence</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          >
            The decentralized prediction market built on eCash. 
            Trade on real-world events with instant settlements and near-zero fees.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-16 px-4 sm:px-0"
          >
            <Button variant="glow" size="lg" className="w-full sm:w-auto sm:size-xl text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4">
              Start Trading
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <Button variant="glass" size="lg" className="w-full sm:w-auto sm:size-xl text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-4">
              Explore Markets
            </Button>
          </motion.div>

          {/* Wallet Info */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <a 
              href="https://cashtab.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="glass-card px-6 py-3 flex items-center gap-2 hover:border-primary/50 transition-colors"
            >
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-foreground font-medium">Pay with Cashtab</span>
            </a>
            <a 
              href="https://marlinwallet.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="glass-card px-6 py-3 flex items-center gap-2 hover:border-primary/50 transition-colors"
            >
              <Shield className="w-5 h-5 text-accent" />
              <span className="text-foreground font-medium">Pay with Marlin</span>
            </a>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
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
