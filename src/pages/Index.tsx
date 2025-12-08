import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import TrendingSection from '@/components/TrendingSection';
import MarketsSection from '@/components/MarketsSection';
import ResolvedBets from '@/components/ResolvedBets';
import { Leaderboard } from '@/components/Leaderboard';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';
import PublicBets from '@/components/PublicBets';

const Index = () => {
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
          <TrendingSection />
          <MarketsSection />
          <ResolvedBets />
          <Leaderboard />
          
          {/* Transparent Public Bets Section */}
          <section className="py-16 px-4">
            <div className="max-w-7xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground mb-2">
                  Transparent Betting
                </h2>
                <p className="text-muted-foreground">
                  All bets are publicly visible with verifiable transaction IDs
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
