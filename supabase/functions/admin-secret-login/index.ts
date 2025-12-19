import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { password, user_id } = await req.json();

    const providedPassword = typeof password === 'string' ? password.trim() : '';
    const adminPassword = (Deno.env.get('ADMIN_SECRET_PASSWORD') ?? '').trim();

    if (!adminPassword) {
      console.error('ADMIN_SECRET_PASSWORD not configured');
      return new Response(
        JSON.stringify({ error: 'Admin access not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!providedPassword || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Password and user_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if password matches
    if (providedPassword !== adminPassword) {
      console.log('Invalid admin password attempt');
      return new Response(
        JSON.stringify({ error: 'Invalid password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Grant admin role to the user
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', user_id)
      .eq('role', 'admin')
      .maybeSingle();

    if (existingRole) {
      return new Response(
        JSON.stringify({ success: true, message: 'Already admin' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert admin role
    const { error: insertError } = await supabase
      .from('user_roles')
      .insert({ user_id, role: 'admin' });

    if (insertError) {
      console.error('Error granting admin role:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to grant admin access' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin access granted to user: ${user_id}`);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Admin access granted' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin secret login error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
