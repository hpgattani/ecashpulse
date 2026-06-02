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

/**
 * Returns true when the incoming request is invoked internally with the
 * service-role key in its Authorization header. Use this to gate edge
 * functions that should only be called by other edge functions / cron.
 */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!serviceKey) return false;
  return auth === `Bearer ${serviceKey}`;
}

/**
 * Verify the provided session_token belongs to a user with the 'admin' role.
 */
export async function verifyAdminSession(
  supabase: SupabaseClient,
  sessionToken: string | null | undefined
): Promise<boolean> {
  const result = await validateSession(supabase, sessionToken);
  if (!result.valid || !result.userId) return false;

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', result.userId)
    .eq('role', 'admin')
    .maybeSingle();

  return !!role;
}
