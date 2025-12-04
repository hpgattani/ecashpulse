import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import TrendingSection from '@/components/TrendingSection';
import MarketsSection from '@/components/MarketsSection';
import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';

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
          <HowItWorks />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
