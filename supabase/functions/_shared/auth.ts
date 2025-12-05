import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface SessionValidationResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

export async function validateSession(
  supabase: SupabaseClient,
  sessionToken: string | null | undefined
): Promise<SessionValidationResult> {
  if (!sessionToken || typeof sessionToken !== 'string') {
    return { valid: false, error: 'Session token is required' };
  }

  const trimmedToken = sessionToken.trim();
  if (trimmedToken.length !== 64) {
    return { valid: false, error: 'Invalid session token format' };
  }

  // Look up session and validate
  const { data: session, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', trimmedToken)
    .maybeSingle();

  if (error) {
    console.error('Session lookup error:', error);
    return { valid: false, error: 'Failed to validate session' };
  }

  if (!session) {
    return { valid: false, error: 'Invalid or expired session' };
  }

  // Check expiration
  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await supabase.from('sessions').delete().eq('token', trimmedToken);
    return { valid: false, error: 'Session expired' };
  }

  // Update last_used_at
  await supabase
    .from('sessions')
    .update({ last_used_at: new Date().toISOString() })
    .eq('token', trimmedToken);

  return { valid: true, userId: session.user_id };
}
