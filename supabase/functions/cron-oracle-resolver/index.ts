// Cron-triggered oracle resolver - runs every 5 minutes
// This function is called by an external cron service (e.g., cron-job.org)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing env vars');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Cron: Triggering oracle-resolver...');
    
    // Call the main oracle-resolver function
    const response = await fetch(`${supabaseUrl}/functions/v1/oracle-resolver`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ cron: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Oracle resolver failed:', response.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Oracle resolver failed', 
        status: response.status 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    console.log('Cron: Oracle resolver completed:', result);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Oracle resolver triggered successfully',
      result 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Cron error:', errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
