import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import PendingBetsSection from '@/components/PendingBetsSection';
import TrendingSection from '@/components/TrendingSection';
import MarketsSection from '@/components/MarketsSection';
import ResolvedBets from '@/components/ResolvedBets';
import { Leaderboard } from '@/components/Leaderboard';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';
import PublicBets from '@/components/PublicBets';
import { useLanguage } from '@/contexts/LanguageContext';

const Index = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.slice(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);
  return (
    <>
      <Helmet>
        <title>eCash Pulse - Decentralized Prediction Market | Bet with XEC</title>
        <meta name="description" content="Trade on real-world events with eCash Pulse. The decentralized prediction market built on eCash (XEC) with instant settlements and near-zero fees." />
        <meta name="keywords" content="eCash, XEC, prediction market, crypto betting, decentralized, blockchain" />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <Header />
        <main>
          <Hero />
          <PendingBetsSection />
          <TrendingSection />
          <MarketsSection />
          <ResolvedBets />
          <Leaderboard />
          
          {/* Transparent Public Bets Section */}
          <section className="py-16 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
                  {t.transparentBetting}
                </h2>
                <p className="text-muted-foreground">
                  {t.transparentBettingDesc}
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <PublicBets />
              </div>
            </div>
          </section>
          
          <HowItWorks />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
