import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  typeof url === 'string' && url.length > 0 && typeof anonKey === 'string' && anonKey.length > 0
    ? createClient(url, anonKey)
    : null;

export const pseudoEmail = (username: string): string =>
  `${username.toLowerCase()}@users.feeding.local`;

export const isCloudConfigured = (): boolean => supabase !== null;