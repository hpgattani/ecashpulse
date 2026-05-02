import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { ExternalLink, Heart, PawPrint, Coins, Instagram } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';

const TOKEN_ID = 'ea005b6fef24cda8b18edbce081b8452be1';
const CASHTAB_URL = `https://cashtab.com/#/token/${TOKEN_ID}`;
const TWITTER_URL = 'https://twitter.com/eCashInu';
const INSTAGRAM_URL = 'https://www.instagram.com/ecashinu';

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const EcashInu = () => {
  // Load Twitter widgets script for embeds
  useEffect(() => {
    if (document.querySelector('script[src*="platform.twitter.com/widgets.js"]')) return;
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.body.appendChild(script);
  }, []);

  return (
    <>
      <Helmet>
        <title>eCash Inu - Charity Crypto Feeding Stray Dogs in India | eCash Pulse</title>
        <meta
          name="description"
          content="eCash Inu is a charity eToken on the eCash blockchain. Donations are used to buy food for stray dogs in India. Donate $XEC or buy $eCashInu to help."
        />
        <meta property="og:title" content="eCash Inu - Charity Crypto for Stray Dogs" />
        <meta property="og:description" content="Donations buy food for stray dogs in India. Powered by eCash." />
      </Helmet>

      <Header />

      <main className="min-h-screen pt-24 md:pt-28 pb-16 relative overflow-hidden">
        {/* Ambient orbs */}
        <div className="absolute top-32 -left-24 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container mx-auto px-4 max-w-5xl relative z-10">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center mb-10"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="relative mb-6"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-pink-500 to-amber-500 blur-2xl opacity-50" />
              <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-pink-500 flex items-center justify-center shadow-2xl">
                <PawPrint className="w-12 h-12 md:w-16 md:h-16 text-white" />
              </div>
            </motion.div>

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 border border-pink-500/40 text-pink-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Heart className="w-3 h-3 fill-pink-400" /> Charity Project
            </span>

            <h1 className="font-display text-4xl md:text-6xl font-bold text-foreground mb-3">
              <span className="bg-gradient-to-r from-orange-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                eCash Inu
              </span>
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-2xl">
              A charity eToken on the eCash blockchain. Every donation is used to buy food for{' '}
              <span className="text-foreground font-semibold">stray dogs in India</span> 🐕
            </p>
          </motion.div>

          {/* Action cards */}
          <div className="grid md:grid-cols-2 gap-4 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass-card p-6 border border-orange-500/30 relative overflow-hidden group"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-500/20 rounded-full blur-2xl group-hover:bg-orange-500/30 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="w-5 h-5 text-orange-400" />
                  <h3 className="font-display font-bold text-lg">Buy $eCashInu</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Buy the eCash Inu eToken on Cashtab. Every purchase directly funds dog food.
                </p>
                <Button asChild className="w-full gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0">
                  <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                    Buy on Cashtab
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="glass-card p-6 border border-pink-500/30 relative overflow-hidden group"
            >
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl group-hover:bg-pink-500/30 transition-colors" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-5 h-5 text-pink-400 fill-pink-400" />
                  <h3 className="font-display font-bold text-lg">Follow & Share</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Follow eCash Inu on social media to see daily feedings and spread the word.
                </p>
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer">
                      <XIcon className="w-4 h-4" />
                      Twitter
                    </a>
                  </Button>
                  <Button asChild variant="outline" className="flex-1 gap-2">
                    <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
                      <Instagram className="w-4 h-4" />
                      Instagram
                    </a>
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Story */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6 md:p-8 mb-10 border border-border/30"
          >
            <h2 className="font-display font-bold text-xl md:text-2xl mb-3 flex items-center gap-2">
              <PawPrint className="w-6 h-6 text-orange-400" />
              The mission
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              eCash Inu uses the proceeds from sold tokens and direct $XEC donations to feed stray dogs across India.
              Every meal served is funded by the eCash community. Watch the daily feedings on Twitter and Instagram —
              real dogs, real food, real impact, all settled on the eCash blockchain with near-zero fees.
            </p>
          </motion.div>

          {/* Twitter embed timeline (videos & posts) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="glass-card p-4 md:p-6 border border-border/30"
          >
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-display font-bold text-xl md:text-2xl flex items-center gap-2">
                <XIcon className="w-5 h-5" />
                Latest Feedings
              </h2>
              <Button asChild variant="ghost" size="sm" className="gap-2">
                <a href={TWITTER_URL} target="_blank" rel="noopener noreferrer">
                  View on X
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            </div>

            <div className="rounded-xl overflow-hidden bg-background/40">
              {/* Twitter timeline embed - shows latest tweets including videos */}
              <a
                className="twitter-timeline"
                data-height="800"
                data-theme="dark"
                data-chrome="noheader nofooter transparent"
                data-tweet-limit="6"
                href={`${TWITTER_URL}?ref_src=twsrc%5Etfw`}
              >
                Loading tweets from @eCashInu…
              </a>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Videos and photos load directly from Twitter. Click any post to view in full.
            </p>
          </motion.div>

          {/* Token ID footer */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center text-xs text-muted-foreground"
          >
            <p>
              Token ID:{' '}
              <code className="font-mono text-foreground/70 break-all">{TOKEN_ID}</code>
            </p>
          </motion.div>
        </div>
      </main>

      <Footer />
    </>
  );
};

export default EcashInu;
