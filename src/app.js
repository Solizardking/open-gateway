/**
 * Express app factory — used by server and tests.
 * No client accounts, sessions, or API-key auth on paid routes.
 */

import express from 'express';
import { CATALOG, listCatalog, getRoute } from './catalog.js';
import { createPaymentGate, withSettlement } from './middleware.js';
import { handleCryptoPrice, notConfiguredHandler } from './handlers/crypto.js';
import { handleLlm } from './handlers/llm.js';
import { handleWebScrape } from './handlers/web.js';
import { NETWORKS, DEFAULT_NETWORK_ORDER } from './networks.js';

/**
 * @param {object} [options]
 * @param {(args: any) => Promise<any>} [options.facilitatorVerify]
 * @param {string} [options.publicUrl]
 */
export function createApp(options = {}) {
  const app = express();
  const publicUrl = (options.publicUrl || process.env.PUBLIC_URL || '').replace(/\/+$/, '');

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Free discovery surfaces (no payment) ─────────────────────────
  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'clawd-gateway',
      protocol: 'x402',
      x402Version: 2,
      auth: 'payment-only',
      networks: DEFAULT_NETWORK_ORDER.map((k) => ({
        key: k,
        id: NETWORKS[k].id,
        token: NETWORKS[k].token,
        decimals: NETWORKS[k].decimals,
      })),
      routes: CATALOG.length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/', (_req, res) => {
    res.json({
      name: 'clawd-gateway',
      tagline: 'A vending machine for data and AI tools',
      model: {
        accounts: false,
        apiKeys: false,
        subscriptions: false,
        auth: 'x402 stablecoin payment',
      },
      docs: {
        catalog: '/catalog',
        health: '/health',
        wellKnown: '/.well-known/x402',
      },
      quickstart: {
        unpaid: 'curl -i http://localhost:$PORT/api/crypto/price?ids=bitcoin',
        paid:
          'Retry with PAYMENT-SIGNATURE (or X-PAYMENT) base64 JSON matching accepts[] amount/network',
      },
    });
  });

  app.get('/catalog', (req, res) => {
    const base =
      publicUrl ||
      `${req.protocol}://${req.get('host') || 'localhost'}`;
    res.json(listCatalog({ publicUrl: base }));
  });

  app.get('/.well-known/x402', (req, res) => {
    const base =
      publicUrl ||
      `${req.protocol}://${req.get('host') || 'localhost'}`;
    res.json({
      version: 2,
      name: 'clawd-gateway',
      catalog: `${base}/catalog`,
      networks: DEFAULT_NETWORK_ORDER.map((k) => NETWORKS[k].id),
      paymentHeaders: {
        request: ['PAYMENT-SIGNATURE', 'X-PAYMENT'],
        responseRequired: ['PAYMENT-REQUIRED'],
        responseSettlement: ['PAYMENT-RESPONSE'],
      },
    });
  });

  // ── Payment gate for all /api/* catalog routes ───────────────────
  const gate = createPaymentGate({
    facilitatorVerify: options.facilitatorVerify,
    publicUrl: publicUrl || undefined,
  });

  // Live handlers
  app.get(
    '/api/crypto/price',
    gate,
    withSettlement(handleCryptoPrice)
  );

  app.get(
    '/api/web/scrape',
    gate,
    withSettlement(handleWebScrape)
  );

  app.post(
    '/api/llm/:model',
    (req, res, next) => {
      // Resolve catalog route for /api/llm/<slug>
      const path = `/api/llm/${req.params.model}`;
      const route = getRoute(path);
      if (!route) {
        return res.status(404).json({
          error: 'unknown_model',
          message: `No catalog entry for ${path}`,
          hint: 'GET /catalog',
        });
      }
      req.x402Route = route;
      return next();
    },
    gate,
    withSettlement(handleLlm)
  );

  // Register remaining catalog routes as payment-gated not-configured
  // (except live ones already wired)
  const livePaths = new Set([
    '/api/crypto/price',
    '/api/web/scrape',
  ]);

  for (const route of CATALOG) {
    if (livePaths.has(route.path)) continue;
    if (route.path.startsWith('/api/llm/')) continue; // covered by param route

    const method = (route.method || 'GET').toLowerCase();
    const verb = app[method] ? method : 'all';
    app[verb](
      route.path,
      (req, _res, next) => {
        req.x402Route = route;
        next();
      },
      gate,
      withSettlement(notConfiguredHandler)
    );
  }

  // Catch-all for unknown /api
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: 'not_found',
      message: 'Unknown API path. See GET /catalog for priced routes.',
    });
  });

  app.use((err, _req, res, _next) => {
    console.error('[clawd-gateway]', err);
    res.status(500).json({
      error: 'internal_error',
      message: err.message || 'Internal error',
    });
  });

  return app;
}

export default createApp;
