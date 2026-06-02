// One-shot internal refund trigger. Calls send-refund with service-role auth.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/functions/v1/send-refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'apikey': key,
    },
    body: JSON.stringify({
      address: 'ecash:qqqdv3r5lkh3xg8u3prrm935la7w2m6m7gq96asq43',
      amount_xec: 500,
      reason: 'Sentiment vote refund - topic expired in DB; vote reversed per user request',
    }),
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
