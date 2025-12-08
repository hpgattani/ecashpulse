import { useState, useEffect } from 'react';

interface CryptoPrices {
  bitcoin: number | null;
  ethereum: number | null;
  solana: number | null;
  ecash: number | null;
  ripple: number | null;
  cardano: number | null;
  dogecoin: number | null;
}

const COINGECKO_IDS = 'bitcoin,ethereum,solana,ecash,ripple,cardano,dogecoin';

export const useCryptoPrices = () => {
  const [prices, setPrices] = useState<CryptoPrices>({
    bitcoin: null,
    ethereum: null,
    solana: null,
    ecash: null,
    ripple: null,
    cardano: null,
    dogecoin: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd&include_24hr_change=true`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch prices');
        }
        
        const data = await response.json();
        
        setPrices({
          bitcoin: data.bitcoin?.usd || null,
          ethereum: data.ethereum?.usd || null,
          solana: data.solana?.usd || null,
          ecash: data.ecash?.usd || null,
          ripple: data.ripple?.usd || null,
          cardano: data.cardano?.usd || null,
          dogecoin: data.dogecoin?.usd || null,
        });
        setError(null);
      } catch (err) {
        console.error('CoinGecko fetch error:', err);
        setError('Failed to load prices');
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    
    return () => clearInterval(interval);
  }, []);

  const getPriceForCrypto = (title: string): { price: number | null; symbol: string } | null => {
    const titleLower = title.toLowerCase();
    
    if (titleLower.includes('bitcoin') || titleLower.includes('btc')) {
      return { price: prices.bitcoin, symbol: 'BTC' };
    }
    if (titleLower.includes('ethereum') || titleLower.includes('eth')) {
      return { price: prices.ethereum, symbol: 'ETH' };
    }
    if (titleLower.includes('solana') || titleLower.includes('sol')) {
      return { price: prices.solana, symbol: 'SOL' };
    }
    if (titleLower.includes('ecash') || titleLower.includes('xec')) {
      return { price: prices.ecash, symbol: 'XEC' };
    }
    if (titleLower.includes('xrp') || titleLower.includes('ripple')) {
      return { price: prices.ripple, symbol: 'XRP' };
    }
    if (titleLower.includes('cardano') || titleLower.includes('ada')) {
      return { price: prices.cardano, symbol: 'ADA' };
    }
    if (titleLower.includes('doge') || titleLower.includes('dogecoin')) {
      return { price: prices.dogecoin, symbol: 'DOGE' };
    }
    
    return null;
  };

  return { prices, loading, error, getPriceForCrypto };
};

export default useCryptoPrices;