/** Hosted Supabase edge functions base (same project as check-promo-rewards). */
export const SUPABASE_FUNCTIONS_BASE =
  'https://mvawkzhwgtlwxwkssvyg.supabase.co/functions/v1';

export function supabaseFunctionUrl(path: string): string {
  const slug = path.replace(/^\//, '');
  return `${SUPABASE_FUNCTIONS_BASE}/${slug}`;
}
