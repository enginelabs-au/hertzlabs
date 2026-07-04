/** Supabase publishable key for edge-function calls from the app (public). Synced from .env via sync-native-secrets.js */
export const SUPABASE_ANON_KEY =
  'sb_publishable_TevJqC2VQ9v9cPMKAvl75w_Ck0Jv31_';

export const SUPABASE_FUNCTION_HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
} as const;
