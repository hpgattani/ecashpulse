import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Sparkles, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const XpulseBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-50 bg-gradient-to-r from-primary via-accent to-primary overflow-hidden"
      >
        {/* Shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />

        <div className="relative flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-primary-foreground">
          <Sparkles className="h-4 w-4 shrink-0 animate-pulse" />
          <span className="text-center">
            <span className="font-bold">$XPULSE</span> eToken is LIVE!
            {' '}Fund the platform & earn revenue share.
            {' '}GNC funding = airdrop for holders!
          </span>
          <Link
            to="/token"
            className="inline-flex items-center gap-1 ml-2 px-3 py-1 rounded-full bg-background/20 hover:bg-background/30 transition-colors text-xs font-bold uppercase tracking-wide whitespace-nowrap"
          >
            <Rocket className="h-3 w-3" />
            Get $XPULSE
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-background/20 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default XpulseBanner;
