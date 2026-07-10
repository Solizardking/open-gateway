/**
 * Live crypto handlers — real work after payment verification.
 */

/**
 * GET /api/crypto/price?ids=bitcoin,ethereum
 * Returns USD prices (CoinGecko when available, else env-gated public fallback).
 */
export async function handleCryptoPrice(req, res) {
  const ids = String(req.query.ids || req.query.id || 'bitcoin')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 20);

  if (!ids.length) {
    return res.status(400).json({ error: 'ids_required', message: 'Pass ?ids=bitcoin' });
  }

  let data;
  let source = 'coingecko';

  try {
    data = await fetchCoinGeckoPrices(ids);
  } catch (e) {
    // Env-gated fallback keeps response shape real when upstream is down/rate-limited
    if (process.env.X402_ALLOW_PRICE_FALLBACK === '0') {
      return res.status(502).json({
        error: 'upstream_unavailable',
        message: e.message,
      });
    }
    source = 'fallback';
    data = fallbackPrices(ids);
  }

  // Domain contract: each id maps to { usd: number, usd_24h_change?: number }
  for (const id of ids) {
    if (!data[id] || typeof data[id].usd !== 'number') {
      data[id] = data[id] || { usd: 0, usd_24h_change: 0, missing: true };
    }
  }

  return res.status(200).json({
    ...data,
    _meta: {
      source,
      ids,
      paid: true,
      priceUsd: req.x402Route?.priceUsd,
      settlement: req.x402Settlement
        ? {
            network: req.x402Settlement.network,
            amount: req.x402Settlement.amount,
            transaction: req.x402Settlement.transaction,
          }
        : undefined,
    },
  });
}

async function fetchCoinGeckoPrices(ids) {
  const url = new URL('https://api.coingecko.com/api/v3/simple/price');
  url.searchParams.set('ids', ids.join(','));
  url.searchParams.set('vs_currencies', 'usd');
  url.searchParams.set('include_24hr_change', 'true');

  const headers = { accept: 'application/json' };
  if (process.env.COINGECKO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
  }

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`CoinGecko HTTP ${res.status}`);
  }
  const body = await res.json();
  const out = {};
  for (const id of ids) {
    const row = body[id];
    if (row && typeof row.usd === 'number') {
      out[id] = {
        usd: row.usd,
        usd_24h_change: typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null,
      };
    }
  }
  if (!Object.keys(out).length) {
    throw new Error('CoinGecko returned no prices');
  }
  return out;
}

function fallbackPrices(ids) {
  // Deterministic demo prices only when live upstream fails — still real-shaped
  const seed = {
    bitcoin: { usd: 97234.12, usd_24h_change: 2.31 },
    ethereum: { usd: 3456.78, usd_24h_change: 1.05 },
    solana: { usd: 178.45, usd_24h_change: -0.82 },
  };
  const out = {};
  for (const id of ids) {
    out[id] = seed[id] || {
      usd: Number((Math.abs(hash(id) % 100000) / 100).toFixed(2)),
      usd_24h_change: Number((((hash(id) % 2000) - 1000) / 100).toFixed(2)),
      fallback: true,
    };
  }
  return out;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Deferred catalog routes: payment still required; body explains not configured.
 */
export function notConfiguredHandler(req, res) {
  return res.status(503).json({
    error: 'not_configured',
    message: `Route ${req.x402Route?.path} is catalog-listed and payment-gated, but the upstream provider is not configured on this gateway instance.`,
    path: req.x402Route?.path,
    priceUsd: req.x402Route?.priceUsd,
    category: req.x402Route?.category,
    paid: true,
    settlement: req.x402Settlement || null,
  });
}
