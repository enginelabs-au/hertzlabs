/**
 * Hertz Labs — check-app-version edge function
 *
 * GET /functions/v1/check-app-version?platform=ios|android&versionCode=N
 *
 * Force-update is evaluated per client:
 * - `latest_version_code` is the current store build (set via npm run sync:app-version).
 * - While `force_update` is true, clients below latest see a blocking update screen.
 * - Clients on latest_version_code or above never see the block (no global server clear).
 */

import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }

  if (req.method !== 'GET') {
    return json({error: 'Method not allowed.'}, 405);
  }

  const url = new URL(req.url);
  const platform = (url.searchParams.get('platform') ?? '').toLowerCase();
  const versionCode = Number.parseInt(url.searchParams.get('versionCode') ?? '', 10);

  if (platform !== 'ios' && platform !== 'android') {
    return json({error: 'Invalid platform.'}, 400);
  }

  if (!Number.isFinite(versionCode) || versionCode < 1) {
    return json({error: 'Invalid versionCode.'}, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const {data: policy, error} = await sb
    .from('app_update_policy')
    .select('min_version_code, latest_version_code, force_update')
    .eq('platform', platform)
    .maybeSingle();

  if (error != null) {
    console.error('[check-app-version] policy read failed:', error.message);
    return json({updateRequired: false, forceUpdate: false});
  }

  const latestVersionCode = policy?.latest_version_code ?? policy?.min_version_code ?? 1;
  const minVersionCode = Math.max(policy?.min_version_code ?? 1, latestVersionCode);
  const forceFlag = policy?.force_update === true;
  const updateRequired = versionCode < latestVersionCode;
  const onLatestBuild = versionCode >= latestVersionCode;

  return json({
    updateRequired,
    forceUpdate: updateRequired && forceFlag,
    latestVersionCode,
    minVersionCode,
    clientVersionCode: versionCode,
    onLatestBuild,
  });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
