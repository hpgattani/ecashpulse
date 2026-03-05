import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const XpulseBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const repeated = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="mx-8 whitespace-nowrap">
      🚀 <span className="font-bold">$XPULSE</span> eToken is LIVE — Fund the platform &amp; earn revenue share — GNC funding = airdrop for all holders! 🪂 —{' '}
      <Link to="/token" className="underline underline-offset-2 font-bold hover:opacity-80">
        Get $XPULSE →
      </Link>
    </span>
  ));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: 'auto' }}
        exit={{ height: 0 }}
        className="relative w-full bg-[hsl(160,80%,40%)] text-white overflow-hidden"
        style={{ zIndex: 40 }}
      >
        <div className="relative flex items-center py-2.5 text-sm font-medium">
          <div className="flex animate-marquee">
            {repeated}
          </div>
          <div className="flex animate-marquee2 absolute">
            {repeated}
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-10"
            aria-label="Dismiss banner"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default XpulseBanner;
