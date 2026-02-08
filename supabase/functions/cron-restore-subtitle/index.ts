import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function restores "decentralized" in place of "first" in the subtitle text.
// It's designed to be called once by a cron job ~1 month after the change (around March 8, 2026).
// After successful execution, the cron job should be manually removed.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('cron-restore-subtitle: Checking if restoration is needed...');
    
    // Target date: March 8, 2026 (1 month after Feb 8 change)
    const targetDate = new Date('2026-03-08T00:00:00Z');
    const now = new Date();
    
    if (now < targetDate) {
      console.log(`Not yet time to restore. Target: ${targetDate.toISOString()}, Now: ${now.toISOString()}`);
      return new Response(
        JSON.stringify({ message: 'Not yet time to restore', target: targetDate.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Time to restore "decentralized" subtitle!');
    
    // Note: The actual text change needs to happen in the frontend code (LanguageContext.tsx).
    // This function logs a reminder. The developer must update the code manually or via a deployment.
    // We log this prominently so it shows up in edge function logs.
    
    console.log('=== ACTION REQUIRED ===');
    console.log('Restore "The decentralized prediction market" in LanguageContext.tsx');
    console.log('Replace "first" with "decentralized" in all language heroSubtitle and footerDesc');
    console.log('=== END ACTION ===');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'REMINDER: Restore "decentralized" in LanguageContext.tsx subtitle text. Replace "first" with "decentralized" in all languages.',
        action_date: now.toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('cron-restore-subtitle error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
