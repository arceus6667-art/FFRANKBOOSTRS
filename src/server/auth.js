import { createClient } from '@supabase/supabase-js';

export class AccessError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Per-request bearer-token client for the versioned API and future Android app.
// Browser SSR cookie handling will be wired separately when Next.js is added.
export function createRequestClient(authorization, env = process.env) {
  const url = new URL(env.SUPABASE_URL);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Supabase URL must be an HTTPS origin or local development origin');
  }
  if (!env.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
    throw new Error('A Supabase publishable key is required');
  }
  if (typeof authorization !== 'string' || !/^Bearer [A-Za-z0-9._~-]+$/.test(authorization) || authorization.length > 8192) {
    throw new AccessError(401, 'Sign in to continue');
  }
  return createClient(url.origin, env.SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireVerifiedUser(client, accessToken) {
  // getUser contacts Auth; getSession/user_metadata is not an authority.
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data?.user || data.user.is_anonymous) throw new AccessError(401, 'Sign in to continue');
  if (!data.user.email_confirmed_at) throw new AccessError(403, 'Verify your email to continue');
  return { id: data.user.id };
}

export async function requireAdmin(client, accessToken) {
  const user = await requireVerifiedUser(client, accessToken);
  // Read current database state so role revocations take effect without JWT refresh.
  const { data, error } = await client.from('role_assignments').select('role').eq('player_id', user.id).maybeSingle();
  if (error) throw new AccessError(503, 'Unable to verify access');
  if (data?.role !== 'admin') throw new AccessError(403, 'Administrator access required');
  return user;
}
