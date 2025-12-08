import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OracleResult {
  resolved: boolean;
  outcome?: 'yes' | 'no';
  reason?: string;
  currentValue?: string;
}

// Fetch crypto prices from CoinGecko
async function getCryptoPrice(coinId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data[coinId]?.usd || null;
  } catch (error) {
    console.error(`CoinGecko error for ${coinId}:`, error);
    return null;
  }
}

// Check crypto price predictions
async function checkCryptoPrediction(title: string, description: string): Promise<OracleResult> {
  const titleLower = title.toLowerCase();
  
  // Bitcoin price checks
  if (titleLower.includes('bitcoin') || titleLower.includes('btc')) {
    const price = await getCryptoPrice('bitcoin');
    if (!price) return { resolved: false };
    
    // Extract target price from title (e.g., "$150,000", "$100k")
    const priceMatch = title.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:k|K)?/);
    if (priceMatch) {
      let targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (title.toLowerCase().includes('k') && targetPrice < 1000) targetPrice *= 1000;
      
      if (titleLower.includes('above') || titleLower.includes('reach') || titleLower.includes('hit')) {
        const reached = price >= targetPrice;
        return {
          resolved: true,
          outcome: reached ? 'yes' : 'no',
          reason: `Bitcoin price: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()})`,
          currentValue: `$${price.toLocaleString()}`
        };
      }
    }
  }
  
  // Ethereum price checks
  if (titleLower.includes('ethereum') || titleLower.includes('eth')) {
    const price = await getCryptoPrice('ethereum');
    if (!price) return { resolved: false };
    
    const priceMatch = title.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:k|K)?/);
    if (priceMatch) {
      let targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (title.toLowerCase().includes('k') && targetPrice < 1000) targetPrice *= 1000;
      
      if (titleLower.includes('above') || titleLower.includes('reach') || titleLower.includes('hit')) {
        const reached = price >= targetPrice;
        return {
          resolved: true,
          outcome: reached ? 'yes' : 'no',
          reason: `Ethereum price: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()})`,
          currentValue: `$${price.toLocaleString()}`
        };
      }
    }
  }
  
  // Solana price checks
  if (titleLower.includes('solana') || titleLower.includes('sol')) {
    const price = await getCryptoPrice('solana');
    if (!price) return { resolved: false };
    
    const priceMatch = title.match(/\$?([\d,]+(?:\.\d+)?)/);
    if (priceMatch) {
      const targetPrice = parseFloat(priceMatch[1].replace(/,/g, ''));
      
      if (titleLower.includes('above') || titleLower.includes('reach') || titleLower.includes('hit') || titleLower.includes('trade')) {
        const reached = price >= targetPrice;
        return {
          resolved: true,
          outcome: reached ? 'yes' : 'no',
          reason: `Solana price: $${price.toLocaleString()} (target: $${targetPrice.toLocaleString()})`,
          currentValue: `$${price.toLocaleString()}`
        };
      }
    }
  }

  // eCash (XEC) price checks
  if (titleLower.includes('ecash') || titleLower.includes('xec')) {
    const price = await getCryptoPrice('ecash');
    if (!price) return { resolved: false };
    
    const priceMatch = title.match(/\$?([\d.]+)/);
    if (priceMatch) {
      const targetPrice = parseFloat(priceMatch[1]);
      
      if (titleLower.includes('above') || titleLower.includes('reach') || titleLower.includes('hit')) {
        const reached = price >= targetPrice;
        return {
          resolved: true,
          outcome: reached ? 'yes' : 'no',
          reason: `eCash price: $${price} (target: $${targetPrice})`,
          currentValue: `$${price}`
        };
      }
    }
  }

  // XRP price checks
  if (titleLower.includes('xrp') || titleLower.includes('ripple')) {
    const price = await getCryptoPrice('ripple');
    if (!price) return { resolved: false };
    
    const priceMatch = title.match(/\$?([\d.]+)/);
    if (priceMatch) {
      const targetPrice = parseFloat(priceMatch[1]);
      
      if (titleLower.includes('above') || titleLower.includes('reach') || titleLower.includes('hit')) {
        const reached = price >= targetPrice;
        return {
          resolved: true,
          outcome: reached ? 'yes' : 'no',
          reason: `XRP price: $${price.toFixed(4)} (target: $${targetPrice})`,
          currentValue: `$${price.toFixed(4)}`
        };
      }
    }
  }

  return { resolved: false };
}

// Check ETH/BTC flippening
async function checkFlippening(): Promise<OracleResult> {
  try {
    const [btcData, ethData] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/coins/bitcoin').then(r => r.json()),
      fetch('https://api.coingecko.com/api/v3/coins/ethereum').then(r => r.json())
    ]);
    
    const btcMcap = btcData.market_data?.market_cap?.usd;
    const ethMcap = ethData.market_data?.market_cap?.usd;
    
    if (btcMcap && ethMcap) {
      const flipped = ethMcap > btcMcap;
      return {
        resolved: true,
        outcome: flipped ? 'yes' : 'no',
        reason: `ETH mcap: $${(ethMcap/1e9).toFixed(0)}B, BTC mcap: $${(btcMcap/1e9).toFixed(0)}B`,
        currentValue: `ETH/BTC ratio: ${(ethMcap/btcMcap*100).toFixed(1)}%`
      };
    }
  } catch (error) {
    console.error('Flippening check error:', error);
  }
  return { resolved: false };
}

// Payout winners for resolved predictions
async function processPayouts(supabase: any, predictionId: string, winningPosition: 'yes' | 'no'): Promise<void> {
  console.log(`Processing payouts for prediction ${predictionId}, winning: ${winningPosition}`);
  
  const { data: prediction } = await supabase
    .from('predictions')
    .select('yes_pool, no_pool, title')
    .eq('id', predictionId)
    .single();
  
  if (!prediction) return;
  
  const totalPool = prediction.yes_pool + prediction.no_pool;
  const winningPool = winningPosition === 'yes' ? prediction.yes_pool : prediction.no_pool;
  
  if (totalPool === 0) {
    console.log('No bets placed, skipping payouts');
    return;
  }
  
  const { data: winningBets } = await supabase
    .from('bets')
    .select('id, user_id, amount')
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition)
    .eq('status', 'confirmed');
  
  if (!winningBets?.length) {
    console.log('No winning bets found');
    return;
  }
  
  for (const bet of winningBets) {
    const payout = winningPool > 0 ? Math.floor((bet.amount / winningPool) * totalPool) : bet.amount;
    
    await supabase
      .from('bets')
      .update({ status: 'won', payout_amount: payout })
      .eq('id', bet.id);
    
    console.log(`Bet ${bet.id}: payout ${payout} sats`);
  }
  
  // Mark losing bets
  await supabase
    .from('bets')
    .update({ status: 'lost', payout_amount: 0 })
    .eq('prediction_id', predictionId)
    .eq('position', winningPosition === 'yes' ? 'no' : 'yes')
    .eq('status', 'confirmed');
  
  console.log(`Payouts processed for "${prediction.title}"`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log('Oracle resolver started...');
    
    // Get active predictions that have ended
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'active')
      .lt('end_date', new Date().toISOString());
    
    if (error) throw error;
    
    const results: Array<{ id: string; title: string; outcome: string; reason: string }> = [];
    
    for (const pred of (predictions || [])) {
      console.log(`Checking: ${pred.title.slice(0, 60)}...`);
      
      let oracleResult: OracleResult = { resolved: false };
      
      // Check for flippening predictions
      if (pred.title.toLowerCase().includes('flippen') || 
          (pred.title.toLowerCase().includes('ethereum') && pred.title.toLowerCase().includes('bitcoin') && pred.title.toLowerCase().includes('market cap'))) {
        oracleResult = await checkFlippening();
      }
      // Check crypto price predictions
      else if (pred.category === 'crypto' || 
               pred.title.toLowerCase().includes('bitcoin') || 
               pred.title.toLowerCase().includes('ethereum') ||
               pred.title.toLowerCase().includes('solana') ||
               pred.title.toLowerCase().includes('xec') ||
               pred.title.toLowerCase().includes('xrp')) {
        oracleResult = await checkCryptoPrediction(pred.title, pred.description || '');
      }
      
      if (oracleResult.resolved && oracleResult.outcome) {
        const status = oracleResult.outcome === 'yes' ? 'resolved_yes' : 'resolved_no';
        
        await supabase
          .from('predictions')
          .update({ 
            status, 
            resolved_at: new Date().toISOString(),
            description: `${pred.description || ''}\n\n🔮 Oracle Resolution: ${oracleResult.reason}`
          })
          .eq('id', pred.id);
        
        await processPayouts(supabase, pred.id, oracleResult.outcome);
        
        results.push({
          id: pred.id,
          title: pred.title,
          outcome: oracleResult.outcome,
          reason: oracleResult.reason || 'Oracle verified'
        });
        
        console.log(`Resolved: ${pred.title} -> ${oracleResult.outcome} (${oracleResult.reason})`);
      } else {
        // If no oracle data, resolve based on pool majority (fallback)
        const winningPosition = pred.yes_pool >= pred.no_pool ? 'yes' : 'no';
        const status = winningPosition === 'yes' ? 'resolved_yes' : 'resolved_no';
        
        await supabase
          .from('predictions')
          .update({ 
            status, 
            resolved_at: new Date().toISOString(),
            description: `${pred.description || ''}\n\n⚖️ Resolved by market consensus`
          })
          .eq('id', pred.id);
        
        await processPayouts(supabase, pred.id, winningPosition);
        
        results.push({
          id: pred.id,
          title: pred.title,
          outcome: winningPosition,
          reason: 'Market consensus (no oracle data available)'
        });
        
        console.log(`Resolved by consensus: ${pred.title} -> ${winningPosition}`);
      }
      
      // Rate limit CoinGecko API
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        resolved: results.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Oracle resolver error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});