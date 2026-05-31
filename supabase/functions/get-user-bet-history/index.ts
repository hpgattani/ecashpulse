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
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user info
    const { data: user } = await supabase
      .from('users')
      .select('ecash_address')
      .eq('id', user_id)
      .maybeSingle();

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user_id)
      .maybeSingle();

    // Get recent bets for the display list (capped at 50 for UI performance)
    const { data: bets, error: betsError } = await supabase
      .from('bets')
      .select(`
        id,
        amount,
        position,
        status,
        payout_amount,
        created_at,
        confirmed_at,
        prediction_id,
        outcome_id,
        predictions!inner(title, category, status),
        outcomes(label)
      `)
      .eq('user_id', user_id)
      .in('status', ['confirmed', 'won', 'lost', 'refunded'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (betsError) {
      console.error('Error fetching user bets:', betsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch bet history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Aggregate full totals across ALL bets (not just the 50 shown).
    // Paginate to bypass the 1000-row limit on heavy users.
    let totalBets = 0, wins = 0, losses = 0, pending = 0, refunded = 0, totalVolume = 0;
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: pageErr } = await supabase
        .from('bets')
        .select('amount,status')
        .eq('user_id', user_id)
        .in('status', ['confirmed', 'won', 'lost', 'refunded'])
        .range(from, from + pageSize - 1);
      if (pageErr) break;
      if (!page || page.length === 0) break;
      for (const b of page) {
        totalBets++;
        totalVolume += b.amount || 0;
        if (b.status === 'won') wins++;
        else if (b.status === 'lost') losses++;
        else if (b.status === 'confirmed') pending++;
        else if (b.status === 'refunded') refunded++;
      }
      if (page.length < pageSize) break;
      from += pageSize;
    }

    // Format bets for display
    const formattedBets = (bets || []).map(bet => ({
      id: bet.id,
      prediction_title: (bet.predictions as any)?.title || 'Unknown',
      prediction_category: (bet.predictions as any)?.category || 'crypto',
      prediction_status: (bet.predictions as any)?.status || 'active',
      position: bet.position,
      outcome_label: (bet.outcomes as any)?.label || null,
      amount: bet.amount,
      status: bet.status,
      payout_amount: bet.payout_amount,
      created_at: bet.created_at,
      confirmed_at: bet.confirmed_at,
    }));

    // Redact address for privacy
    const redactAddress = (address: string) => {
      if (!address) return 'Unknown';
      const clean = address.replace('ecash:', '');
      if (clean.length <= 12) return `ecash:${clean}`;
      return `ecash:${clean.slice(0, 6)}...${clean.slice(-6)}`;
    };

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          display_name: profile?.display_name || null,
          ecash_address: redactAddress(user?.ecash_address || ''),
        },
        bets: formattedBets,
        totals: {
          total_bets: totalBets,
          wins,
          losses,
          pending,
          refunded,
          total_volume: totalVolume,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-user-bet-history:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
