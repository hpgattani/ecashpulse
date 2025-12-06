import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Categories for prediction markets
const CATEGORIES = ['crypto', 'politics', 'sports', 'tech', 'entertainment', 'economics'] as const;

// Generate a random escrow address (placeholder - in production, generate real eCash addresses)
function generateEscrowAddress(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let address = 'ecash:qp';
  for (let i = 0; i < 38; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

// Calculate end date based on topic type
function calculateEndDate(category: string): string {
  const now = new Date();
  let daysToAdd = 30; // Default 30 days
  
  if (category === 'sports') daysToAdd = 7; // Sports events usually sooner
  if (category === 'politics') daysToAdd = 90; // Political events often longer term
  if (category === 'crypto') daysToAdd = 14; // Crypto is volatile
  
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
}

// Fetch trending topics and generate predictions using AI
async function generateTrendingPredictions(supabase: any): Promise<{ created: number; errors: string[] }> {
  const errors: string[] = [];
  let created = 0;

  // Use Lovable AI to generate relevant prediction market topics
  const prompt = `You are a prediction market analyst. Generate 3-5 timely prediction market questions based on current events and trends.

For each prediction, provide:
1. A clear yes/no question (max 100 chars)
2. Brief description (max 200 chars)
3. Category: one of [crypto, politics, sports, tech, entertainment, economics]

Focus on:
- Cryptocurrency price milestones (Bitcoin, Ethereum, XRP, Solana)
- Political events and elections
- Major sports events and championships
- Tech company announcements and product launches
- Entertainment awards and releases
- Economic indicators and central bank decisions

Format your response as JSON array:
[
  {"title": "Will Bitcoin reach $200,000 by March 2026?", "description": "Bitcoin has been rallying. Will it hit the next major milestone?", "category": "crypto"},
  ...
]

Generate diverse, interesting predictions that people would want to bet on. Use current date context: ${new Date().toISOString().split('T')[0]}`;

  try {
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a prediction market analyst. Always respond with valid JSON arrays only, no markdown formatting.' },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      errors.push(`AI API error: ${aiResponse.status}`);
      return { created, errors };
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    
    console.log('AI response:', content);

    // Parse the JSON response
    let predictions: Array<{ title: string; description: string; category: string }>;
    try {
      // Clean the response (remove markdown code blocks if present)
      const cleanedContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      predictions = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      errors.push('Failed to parse AI response');
      return { created, errors };
    }

    if (!Array.isArray(predictions)) {
      errors.push('AI response is not an array');
      return { created, errors };
    }

    // Get existing prediction titles to avoid duplicates
    const { data: existingPredictions } = await supabase
      .from('predictions')
      .select('title')
      .eq('status', 'active');
    
    const existingTitles = new Set((existingPredictions || []).map((p: any) => p.title.toLowerCase()));

    // Insert new predictions
    for (const prediction of predictions) {
      if (!prediction.title || !prediction.category) continue;
      
      // Skip if similar prediction exists
      if (existingTitles.has(prediction.title.toLowerCase())) {
        console.log('Skipping duplicate:', prediction.title);
        continue;
      }

      // Validate category
      const category = CATEGORIES.includes(prediction.category as any) 
        ? prediction.category 
        : 'tech';

      const newPrediction = {
        title: prediction.title.slice(0, 200),
        description: (prediction.description || '').slice(0, 500),
        category,
        escrow_address: generateEscrowAddress(),
        end_date: calculateEndDate(category),
        status: 'active',
        yes_pool: 0,
        no_pool: 0,
      };

      const { error: insertError } = await supabase
        .from('predictions')
        .insert(newPrediction);

      if (insertError) {
        console.error('Insert error:', insertError);
        errors.push(`Failed to insert: ${prediction.title}`);
      } else {
        console.log('Created prediction:', newPrediction.title);
        created++;
      }
    }
  } catch (error) {
    console.error('Error generating predictions:', error);
    errors.push(`Generation error: ${error instanceof Error ? error.message : 'Unknown'}`);
  }

  return { created, errors };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // This endpoint can be called by:
  // 1. A cron job (internal)
  // 2. An admin user (with admin role check)
  
  // Check for admin authorization if called externally
  const authHeader = req.headers.get('authorization');
  const isInternalCall = req.headers.get('x-cron-secret') === Deno.env.get('CRON_SECRET');
  
  if (!isInternalCall) {
    // Validate session and check admin role
    try {
      const body = await req.json().catch(() => ({}));
      const sessionToken = body.session_token;
      
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate session
      const { data: session } = await supabase
        .from('sessions')
        .select('user_id, expires_at')
        .eq('token', sessionToken.trim())
        .maybeSingle();

      if (!session || new Date(session.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check admin role
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _role: 'admin',
        _user_id: session.user_id
      });

      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Admin access required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({ error: 'Authorization failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  try {
    console.log('Starting trending topics fetch...');
    
    const result = await generateTrendingPredictions(supabase);
    
    console.log(`Completed: created ${result.created} predictions, ${result.errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: result.created,
        errors: result.errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-trending-topics:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch trending topics' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
