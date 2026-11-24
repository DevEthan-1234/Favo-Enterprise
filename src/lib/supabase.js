import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const ADMIN_USERNAME = 'favoenterprise';
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'favoenterprise@favoenterprise.app';

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT-REF'));

export const supabase = supabaseConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'favo-admin-auth' } })
  : null;

/** Turns a Postgres/PostgREST error into a message a shop owner or customer can act on. */
export function friendlyError(error) {
  if (!error) return null;
  if (error.code === '23505') return 'That already exists.';
  if (error.code === '23503') return 'That item is still in use and cannot be removed.';
  if (error.code === '42501' || /not authorized|permission denied|row-level security/i.test(error.message)) {
    return 'You are not allowed to do that. Please log in again.';
  }
  if (/Failed to fetch|NetworkError|network/i.test(error.message)) return 'Network problem. Check your connection and try again.';
  return error.message || 'Something went wrong. Please try again.';
}
