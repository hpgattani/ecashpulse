import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch resolved bets for this user
    const { data: bets, error } = await supabase
      .from('bets')
      .select('status, amount, payout_amount, confirmed_at')
      .eq('user_id', user_id)
      .in('status', ['won', 'lost'])
      .order('confirmed_at', { ascending: true })
      .limit(500);

    if (error) {
      console.error('Error fetching bets:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch stats' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedBets = bets || [];
    const wins = resolvedBets.filter(b => b.status === 'won').length;
    const losses = resolvedBets.filter(b => b.status === 'lost').length;
    const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    let totalProfit = 0;
    const profitCurve: number[] = [];
    
    for (const b of resolvedBets) {
      if (b.status === 'won') totalProfit += ((b.payout_amount || 0) - b.amount);
      else if (b.status === 'lost') totalProfit -= b.amount;
      profitCurve.push(totalProfit);
    }

    return new Response(
      JSON.stringify({
        wins,
        losses,
        winRate,
        totalProfit,
        profitCurve,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
