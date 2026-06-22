/**
 * Hertz Labs — validate-promo (retired)
 *
 * Custom HLP codes and RevenueCat promotional grants are disabled.
 * Rewards use App Store Offer Codes / Google Play promo codes via claim-promo-reward.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RETIRED_MESSAGE =
  'Custom promo codes are no longer supported. Earn rewards in Promos — each reward gives an App Store or Google Play offer code to redeem under Promos → Redeem.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {headers: CORS});
  }

  if (req.method !== 'POST') {
    return json({valid: false, error: 'Method not allowed.'}, 405);
  }

  let body: {code?: string};
  try {
    body = await req.json();
  } catch {
    return json({valid: false, error: 'Invalid JSON body.'}, 400);
  }

  const normalized = (body.code ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (normalized.startsWith('HLP')) {
    return json({valid: false, error: RETIRED_MESSAGE}, 410);
  }

  return json({valid: false, error: RETIRED_MESSAGE}, 410);
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {...CORS, 'Content-Type': 'application/json'},
  });
}
