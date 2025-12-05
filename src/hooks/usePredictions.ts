import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DBPrediction {
  id: string;
  title: string;
  description: string | null;
  category: string;
  image_url: string | null;
  end_date: string;
  status: string;
  yes_pool: number;
  no_pool: number;
  escrow_address: string;
  created_at: string;
}

export interface Prediction {
  id: string;
  question: string;
  description: string;
  category: 'crypto' | 'politics' | 'sports' | 'tech' | 'entertainment' | 'economics';
  yesOdds: number;
  noOdds: number;
  volume: number;
  endDate: string;
  image?: string;
  trending?: boolean;
  escrowAddress: string;
  status: string;
}

const transformPrediction = (p: DBPrediction): Prediction => {
  const totalPool = p.yes_pool + p.no_pool;
  const yesOdds = totalPool > 0 ? Math.round((p.yes_pool / totalPool) * 100) : 50;
  const noOdds = totalPool > 0 ? 100 - yesOdds : 50;
  
  // Convert satoshis to USD (rough estimate: 1 XEC ≈ $0.00003)
  const volumeUSD = (totalPool / 100) * 0.00003;

  return {
    id: p.id,
    question: p.title,
    description: p.description || '',
    category: p.category as Prediction['category'],
    yesOdds,
    noOdds,
    volume: volumeUSD,
    endDate: p.end_date,
    image: p.image_url || undefined,
    trending: totalPool > 100000, // Mark as trending if pool > 1000 XEC
    escrowAddress: p.escrow_address,
    status: p.status,
  };
};

export const usePredictions = () => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPredictions();

    // Subscribe to realtime updates on predictions
    const predictionsChannel = supabase
      .channel('predictions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'predictions',
        },
        (payload) => {
          console.log('Prediction update:', payload);
          // Update predictions instantly
          if (payload.eventType === 'UPDATE' && payload.new) {
            setPredictions(prev => 
              prev.map(p => 
                p.id === payload.new.id 
                  ? transformPrediction(payload.new as DBPrediction)
                  : p
              )
            );
          } else {
            fetchPredictions();
          }
        }
      )
      .subscribe();

    // Subscribe to bets to update pools in real-time
    const betsChannel = supabase
      .channel('bets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
        },
        (payload) => {
          console.log('Bet update:', payload);
          // Refetch predictions when bets change to get updated pools
          fetchPredictions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(predictionsChannel);
      supabase.removeChannel(betsChannel);
    };
  }, []);

  const fetchPredictions = async () => {
    const { data, error: fetchError } = await supabase
      .from('predictions')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      console.error('Error fetching predictions:', fetchError);
    } else {
      setPredictions((data as DBPrediction[]).map(transformPrediction));
    }
    setLoading(false);
  };

  return { predictions, loading, error, refetch: fetchPredictions };
};
