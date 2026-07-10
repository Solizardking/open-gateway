/**
 * Gate + handler tests driving the SHIPPED payment path.
 * No re-implementation of the gate; uses createApp + real middleware.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.js';
import {
  buildPaymentRequired,
  encodePaymentPayload,
  makeValidTestPayment,
  usdToAtomic,
  verifyLocalExact,
  verifyPayment,
  extractPaymentPayload,
  testPaymentsAllowed,
} from '../src/payment.js';
import { listCatalog, CATALOG, getRoute } from '../src/catalog.js';
import { NETWORKS, listNetworkAccepts } from '../src/networks.js';

const BASE_CAIP = NETWORKS.base.id;
const MEGA_CAIP = NETWORKS.megaeth.id;
const SOL_CAIP = NETWORKS.solana.id;

function listen(app) {
  return new Promise((resolve) => {
    const server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        server,
        port,
        base: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((r, j) => server.close((e) => (e ? j(e) : r()))),
      });
    });
  });
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body, text, headers: res.headers };
}

describe('catalog + amount encoding', () => {
  it('lists routes across all six objective categories', () => {
    const cat = listCatalog();
    const cats = Object.keys(cat.categories).sort();
    for (const need of ['llm', 'compute', 'crypto', 'web', 'travel', 'storage']) {
      assert.ok(cats.includes(need), `missing category ${need}`);
      assert.ok(cat.categories[need].length > 0);
    }
    assert.ok(cat.routeCount >= 50);
  });

  it('spot-checks objective path/price pairs', () => {
    const pairs = [
      ['/api/crypto/price', 0.001],
      ['/api/llm/gpt-4o-mini', 0.003],
      ['/api/web/scrape', 0.005],
      ['/api/llm/claude-opus', 0.09],
      ['/api/ipfs/pin', 0.01],
    ];
    for (const [path, price] of pairs) {
      const r = getRoute(path);
      assert.ok(r, `route ${path}`);
      assert.equal(r.priceUsd, price);
    }
  });

  it('encodes USDC 6 and USDm 18 amounts', () => {
    assert.equal(usdToAtomic(0.001, 6), '1000');
    assert.equal(usdToAtomic(0.015, 6), '15000');
    assert.equal(usdToAtomic(0.001, 18), '1000000000000000');
    assert.equal(usdToAtomic(0.05, 6), '50000');
  });

  it('builds three-network accepts with CAIP-2 ids', () => {
    const accepts = listNetworkAccepts(0.001, 'http://x/api/crypto/price', 'price');
    assert.equal(accepts.length, 3);
    const nets = accepts.map((a) => a.network);
    assert.ok(nets.includes(BASE_CAIP));
    assert.ok(nets.includes(MEGA_CAIP));
    assert.ok(nets.includes(SOL_CAIP));
    const base = accepts.find((a) => a.network === BASE_CAIP);
    const mega = accepts.find((a) => a.network === MEGA_CAIP);
    assert.equal(base.maxAmountRequired, '1000');
    assert.equal(base.extra.decimals, 6);
    assert.equal(mega.maxAmountRequired, usdToAtomic(0.001, 18));
    assert.equal(mega.extra.decimals, 18);
  });
});

describe('payment helpers (shipped)', () => {
  it('extractPaymentPayload reads PAYMENT-SIGNATURE and X-PAYMENT', () => {
    const payload = { scheme: 'exact', network: BASE_CAIP, amount: '1000', x402Test: true, signature: 's' };
    const b64 = encodePaymentPayload(payload);
    const a = extractPaymentPayload({ 'payment-signature': b64 });
    assert.equal(a.present, true);
    assert.equal(a.decoded.amount, '1000');
    const b = extractPaymentPayload({ 'x-payment': b64 });
    assert.equal(b.present, true);
    const c = extractPaymentPayload({});
    assert.equal(c.present, false);
  });

  it('verifyLocalExact rejects underpay and accepts exact', () => {
    const reqs = buildPaymentRequired({
      resource: 'http://x/api/crypto/price',
      priceUsd: 0.001,
      description: 'price',
    });
    const good = makeValidTestPayment(reqs);
    const ok = verifyLocalExact(good, reqs);
    assert.equal(ok.valid, true);

    const under = makeValidTestPayment(reqs, { underpay: true });
    const bad = verifyLocalExact(under, reqs);
    assert.equal(bad.valid, false);
    assert.match(bad.reason, /underpaid/);

    const inv = makeValidTestPayment(reqs, { invalid: true });
    const invR = verifyLocalExact(inv, reqs);
    assert.equal(invR.valid, false);
  });

  it('verifyPayment rejects scheme:exact with fake signature when no facilitator', async () => {
    const prevTest = process.env.X402_ALLOW_TEST_PAYMENTS;
    const prevFac = process.env.X402_FACILITATOR_URL;
    delete process.env.X402_ALLOW_TEST_PAYMENTS;
    delete process.env.X402_FACILITATOR_URL;
    delete process.env.CDP_FACILITATOR_URL;

    const reqs = buildPaymentRequired({
      resource: 'http://x/api/crypto/price',
      priceUsd: 0.001,
      description: 'price',
    });
    const accept = reqs.accepts[0];
    // Forged production-looking payload — amount/network match, no x402Test
    const forged = {
      scheme: 'exact',
      network: accept.network,
      amount: accept.maxAmountRequired,
      payTo: accept.payTo,
      asset: accept.asset,
      signature: 'forged_sig_not_on_chain',
      payer: '0xattacker',
    };
    const result = await verifyPayment({
      payload: forged,
      requirements: reqs,
      raw: encodePaymentPayload(forged),
    });
    assert.equal(result.valid, false);
    assert.match(result.reason, /unverified_payment_no_facilitator|facilitator/);

    // x402Test without env gate also rejected
    const testPay = makeValidTestPayment(reqs);
    const blocked = await verifyPayment({
      payload: testPay,
      requirements: reqs,
      raw: encodePaymentPayload(testPay),
    });
    assert.equal(blocked.valid, false);
    assert.equal(blocked.reason, 'test_payments_disabled');
    assert.equal(testPaymentsAllowed(), false);

    if (prevTest !== undefined) process.env.X402_ALLOW_TEST_PAYMENTS = prevTest;
    if (prevFac !== undefined) process.env.X402_FACILITATOR_URL = prevFac;
  });
});

describe('shipped gate: unpaid → 402, invalid reject, valid → 200', () => {
  /** @type {{ server: any, base: string, close: Function }} */
  let ctx;

  before(async () => {
    // Force fallbacks so tests don't depend on external APIs
    process.env.X402_FORCE_LLM_FALLBACK = '1';
    // Env-gated test double for chain/facilitator I/O (never on in production)
    process.env.X402_ALLOW_TEST_PAYMENTS = '1';
    delete process.env.X402_FACILITATOR_URL;
    delete process.env.CDP_FACILITATOR_URL;
    const app = createApp({ publicUrl: 'http://127.0.0.1' });
    ctx = await listen(app);
  });

  after(async () => {
    await ctx.close();
    delete process.env.X402_ALLOW_TEST_PAYMENTS;
  });

  it('(a) unpaid crypto price → 402 with three network accepts', async () => {
    const { res, body, headers } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`
    );
    assert.equal(res.status, 402);
    assert.ok(headers.get('payment-required') || headers.get('PAYMENT-REQUIRED'));
    assert.equal(body.x402Version, 2);
    assert.ok(Array.isArray(body.accepts));
    assert.equal(body.accepts.length, 3);
    const nets = body.accepts.map((a) => a.network);
    assert.ok(nets.includes(BASE_CAIP));
    assert.ok(nets.includes(MEGA_CAIP));
    assert.ok(nets.includes(SOL_CAIP));
    assert.equal(body.priceUsd, 0.001);
    for (const a of body.accepts) {
      assert.ok(a.payTo);
      assert.ok(a.asset);
      assert.ok(a.maxAmountRequired);
      assert.equal(a.scheme, 'exact');
    }
    // No API key / session requirements in body
    assert.equal(body.apiKey, undefined);
    assert.equal(body.requiresAuth, undefined);
  });

  it('(b) invalid payment → no successful paid body / no work result', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    const payment = makeValidTestPayment(unpaid.body, { invalid: true });
    const { res, body } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: {
          'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
        },
      }
    );
    assert.equal(res.status, 402);
    assert.equal(body.error, 'payment_rejected');
    // Must not look like a successful price payload
    assert.equal(body.bitcoin, undefined);
    assert.ok(!body._meta?.paid);
  });

  it('(b2) underpaid → rejected without domain payload', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    const payment = makeValidTestPayment(unpaid.body, { underpay: true });
    const { res, body } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: { 'X-PAYMENT': encodePaymentPayload(payment) },
      }
    );
    assert.equal(res.status, 402);
    assert.match(String(body.reason), /underpaid/);
    assert.equal(body.bitcoin, undefined);
  });

  it('(c) valid payment → 200 + price usd + PAYMENT-RESPONSE', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    const payment = makeValidTestPayment(unpaid.body, { network: BASE_CAIP });
    const { res, body, headers } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: {
          'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
        },
      }
    );
    assert.equal(res.status, 200);
    assert.ok(headers.get('payment-response') || headers.get('PAYMENT-RESPONSE'));
    assert.ok(body.bitcoin);
    assert.equal(typeof body.bitcoin.usd, 'number');
    assert.ok(body.bitcoin.usd > 0);
    assert.equal(body._meta.paid, true);
  });

  it('valid payment on LLM route → 200 with completion text', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/llm/gpt-4o-mini`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'hello gateway' }),
    });
    assert.equal(unpaid.res.status, 402);
    assert.equal(unpaid.body.priceUsd, 0.003);

    const payment = makeValidTestPayment(unpaid.body);
    const { res, body, headers } = await jsonFetch(
      `${ctx.base}/api/llm/gpt-4o-mini`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
        },
        body: JSON.stringify({ prompt: 'hello gateway' }),
      }
    );
    assert.equal(res.status, 200);
    assert.ok(headers.get('payment-response'));
    const content = body.choices?.[0]?.message?.content;
    assert.equal(typeof content, 'string');
    assert.ok(content.length > 0);
    assert.equal(body._meta.paid, true);
  });

  it('valid payment on web scrape → 200 with markdown/text', async () => {
    const unpaid = await jsonFetch(
      `${ctx.base}/api/web/scrape?url=${encodeURIComponent('https://example.com')}`
    );
    assert.equal(unpaid.res.status, 402);
    assert.equal(unpaid.body.priceUsd, 0.005);

    const payment = makeValidTestPayment(unpaid.body, { network: SOL_CAIP });
    const { res, body, headers } = await jsonFetch(
      `${ctx.base}/api/web/scrape?url=${encodeURIComponent('https://example.com')}`,
      {
        headers: { 'PAYMENT-SIGNATURE': encodePaymentPayload(payment) },
      }
    );
    assert.equal(res.status, 200);
    assert.ok(headers.get('payment-response'));
    assert.equal(typeof body.markdown, 'string');
    assert.ok(body.markdown.length > 0 || body.text.length > 0);
    assert.equal(body._meta.paid, true);
  });

  it('health and catalog require no payment', async () => {
    const h = await jsonFetch(`${ctx.base}/health`);
    assert.equal(h.res.status, 200);
    assert.equal(h.body.auth, 'payment-only');

    const c = await jsonFetch(`${ctx.base}/catalog`);
    assert.equal(c.res.status, 200);
    assert.ok(c.body.routeCount >= CATALOG.length);
    assert.ok(c.body.categories.crypto);
    assert.ok(c.body.categories.llm);
  });

  it('forged scheme:exact without x402Test must NOT return 200 domain payload', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    assert.equal(unpaid.res.status, 402);
    const accept = unpaid.body.accepts[0];
    const forged = {
      scheme: 'exact',
      network: accept.network,
      amount: accept.maxAmountRequired,
      payTo: accept.payTo,
      asset: accept.asset,
      signature: 'forged_not_verified_by_chain',
      payer: '0xforged',
      // deliberately NO x402Test
    };
    const { res, body } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: {
          'PAYMENT-SIGNATURE': encodePaymentPayload(forged),
        },
      }
    );
    assert.notEqual(res.status, 200);
    assert.equal(res.status, 402);
    assert.equal(body.error, 'payment_rejected');
    assert.equal(body.bitcoin, undefined);
    assert.ok(!body._meta?.paid);
  });
});

describe('production gate: test payments disabled', () => {
  /** @type {{ server: any, base: string, close: Function }} */
  let ctx;

  before(async () => {
    delete process.env.X402_ALLOW_TEST_PAYMENTS;
    delete process.env.X402_FACILITATOR_URL;
    delete process.env.CDP_FACILITATOR_URL;
    process.env.X402_FORCE_LLM_FALLBACK = '1';
    const app = createApp({ publicUrl: 'http://127.0.0.1' });
    ctx = await listen(app);
  });

  after(async () => {
    await ctx.close();
  });

  it('x402Test payload is rejected without X402_ALLOW_TEST_PAYMENTS', async () => {
    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    const payment = makeValidTestPayment(unpaid.body);
    const { res, body } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: {
          'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
        },
      }
    );
    assert.equal(res.status, 402);
    assert.equal(body.bitcoin, undefined);
    assert.match(String(body.reason), /test_payments_disabled/);
  });

  it('valid payment via injectable facilitator still yields 200 + domain payload', async () => {
    await ctx.close();
    const app = createApp({
      publicUrl: 'http://127.0.0.1',
      facilitatorVerify: async ({ payload, requirements }) => {
        // Minimal facilitator double: check amount/network only after "chain" role
        const local = verifyLocalExact(
          { ...payload, x402Test: true, signature: payload.signature || 'fac' },
          requirements
        );
        return local.valid
          ? { valid: true, network: payload.network, amount: payload.amount, payer: payload.payer }
          : { valid: false, reason: local.reason };
      },
    });
    ctx = await listen(app);

    const unpaid = await jsonFetch(`${ctx.base}/api/crypto/price?ids=bitcoin`);
    const accept = unpaid.body.accepts[0];
    // Real-shaped payload (no x402Test) — only facilitator can accept
    const payment = {
      scheme: 'exact',
      network: accept.network,
      amount: accept.maxAmountRequired,
      payTo: accept.payTo,
      asset: accept.asset,
      signature: 'facilitator_attested_sig',
      payer: '0xrealpayer',
    };
    const { res, body, headers } = await jsonFetch(
      `${ctx.base}/api/crypto/price?ids=bitcoin`,
      {
        headers: {
          'PAYMENT-SIGNATURE': encodePaymentPayload(payment),
        },
      }
    );
    assert.equal(res.status, 200);
    assert.ok(headers.get('payment-response'));
    assert.equal(typeof body.bitcoin.usd, 'number');
    assert.equal(body._meta.paid, true);
  });
});
