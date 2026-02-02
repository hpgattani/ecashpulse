import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import MarketNav from '@/components/MarketNav';
import PendingBetsSection from '@/components/PendingBetsSection';
import TrendingSection from '@/components/TrendingSection';
import MarketsSection from '@/components/MarketsSection';
import ResolvedBets from '@/components/ResolvedBets';
import { Leaderboard } from '@/components/Leaderboard';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';
import PublicBets from '@/components/PublicBets';
import { ChatRoom } from '@/components/ChatRoom';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePredictions } from '@/hooks/usePredictions';

const Index = () => {
  const location = useLocation();
  const { t } = useLanguage();
  const { predictions } = usePredictions();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!location.hash) return;

    const id = location.hash.slice(1);
    const HEADER_OFFSET = 96;

    let tries = 0;
    const maxTries = 40; // ~2s total

    const attempt = () => {
      const element = document.getElementById(id);
      if (element) {
        const top = element.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        window.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' });
        return;
      }
      if (tries++ < maxTries) window.setTimeout(attempt, 50);
    };

    // Wait a tick so layout is ready, then retry until the element exists.
    window.setTimeout(attempt, 0);
  }, [location.hash]);

  return (
    <>
      <Helmet>
        <title>eCash Pulse - Decentralized Prediction Market | Bet with XEC</title>
        <meta name="description" content="Trade on real-world events with eCash Pulse. The decentralized prediction market built on eCash (XEC) with instant settlements and near-zero fees." />
        <meta name="keywords" content="eCash, XEC, prediction market, crypto betting, decentralized, blockchain" />
      </Helmet>
      
      <div className="min-h-screen">
        <Header />
          <main>
            <Hero />
            <MarketNav 
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              predictions={predictions.map(p => ({ id: p.id, question: p.question, category: p.category }))}
            />
            <PendingBetsSection />
            <TrendingSection />
            <MarketsSection 
              activeCategory={activeCategory}
              searchQuery={searchQuery}
            />
            <ResolvedBets />
            <Leaderboard />
          
          {/* Transparent Public Bets Section */}
          <section className="py-8 sm:py-16 px-4">
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
        <ChatRoom />
      </div>
    </>
  );
};

export default Index;
