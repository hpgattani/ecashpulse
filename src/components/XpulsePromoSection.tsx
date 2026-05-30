import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Coins, TrendingUp, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import xpulseLogo from '@/assets/xpulse-logo.jpg';

const TOKEN_ID = '2d9064b3dcd32abf3f682a79e6cc1c7614f1092299d8a66877829faaa2f68680';
const CASHTAB_URL = `https://cashtab.com/#/token/${TOKEN_ID}`;

const XpulsePromoSection = () => {
  return (
    <section className="py-10 sm:py-14 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 glass-card"
        >
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[hsl(160,80%,40%)]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 w-72 h-72 rounded-full bg-[hsl(265,85%,60%)]/30 blur-3xl" />

          <div className="relative grid md:grid-cols-[auto,1fr,auto] gap-6 md:gap-8 items-center p-6 md:p-10">
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.85, rotate: -6 }}
              whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 180 }}
              className="flex justify-center md:justify-start"
            >
              <img
                src={xpulseLogo}
                alt="$XPULSE eToken"
                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl shadow-2xl ring-2 ring-primary/40"
              />
            </motion.div>

            {/* Copy */}
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                LIVE NOW · INTRODUCTORY PRICE
              </div>
              <h2 className="font-display font-bold text-2xl md:text-4xl text-foreground mb-2 leading-tight">
                Own a piece of <span className="text-primary">$XPULSE</span>
              </h2>
              <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto md:mx-0 mb-4">
                The official eToken powering eCash Pulse. Fund the platform, earn future revenue share — and if GNC funds the platform, all $XPULSE holders qualify for an airdrop.
              </p>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 md:gap-5 text-xs md:text-sm">
                <div className="flex items-center gap-1.5 text-foreground/90">
                  <Coins className="w-4 h-4 text-primary" />
                  <span className="font-semibold">25 XEC</span>
                  <span className="text-muted-foreground">/ token</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground/90">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="font-semibold">500M</span>
                  <span className="text-muted-foreground">supply</span>
                </div>
                <div className="flex items-center gap-1.5 text-foreground/90">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Rev share</span>
                  <span className="text-muted-foreground">for holders</span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2.5 w-full md:w-auto md:min-w-[180px]">
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/30">
                <a href={CASHTAB_URL} target="_blank" rel="noopener noreferrer">
                  Buy on Cashtab
                  <ArrowRight className="w-4 h-4 ml-1" />
                </a>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary/40 hover:bg-primary/10">
                <Link to="/token">Learn more</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default XpulsePromoSection;
