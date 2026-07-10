/**
 * x402 payment requirements + verification interface.
 *
 * Unpaid → 402 with PAYMENT-REQUIRED (body + base64 header).
 * Paid → verify payload against route requirements, then settle signal.
 *
 * Verifier is injectable for tests (remote facilitator/chain I/O only).
 * The gate itself always runs on the real path.
 */

import { createHash, randomUUID } from 'node:crypto';
import { listNetworkAccepts, networkByCaip, usdToAtomic, NETWORKS } from './networks.js';

export const X402_VERSION = 2;

/** Header names (v2 + v1 compatibility) */
export const HEADERS = {
  paymentRequired: 'PAYMENT-REQUIRED',
  paymentSignature: 'PAYMENT-SIGNATURE',
  paymentResponse: 'PAYMENT-RESPONSE',
  // v1 aliases clients still send
  xPayment: 'x-payment',
  xPaymentResponse: 'x-payment-response',
};

/**
 * Build machine-readable payment requirements for a priced resource.
 */
export function buildPaymentRequired({
  resource,
  priceUsd,
  description,
}) {
  const accepts = listNetworkAccepts(priceUsd, resource, description);
  return {
    x402Version: X402_VERSION,
    error: 'X-PAYMENT header is required',
    accepts,
    // Convenience fields for agents
    priceUsd,
    resource,
  };
}

export function encodePaymentRequiredHeader(requirements) {
  return Buffer.from(JSON.stringify(requirements), 'utf8').toString('base64');
}

/**
 * Extract payment payload from request headers.
 * Accepts PAYMENT-SIGNATURE (v2), X-PAYMENT (v1), and related aliases.
 */
export function extractPaymentPayload(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[String(k).toLowerCase()] = v;
  }

  const raw =
    lower['payment-signature'] ||
    lower['x-payment'] ||
    lower['x-payment-proof'] ||
    null;

  if (!raw || typeof raw !== 'string') {
    return { present: false, raw: null, decoded: null, error: null };
  }

  // Try base64 JSON, then plain JSON
  let decoded = null;
  let error = null;
  try {
    const text = looksLikeBase64(raw)
      ? Buffer.from(raw, 'base64').toString('utf8')
      : raw;
    decoded = JSON.parse(text);
  } catch (e) {
    // Some clients send opaque facilitator tokens as base64 blobs
    decoded = { opaque: raw };
    error = null;
  }

  return { present: true, raw, decoded, error };
}

function looksLikeBase64(s) {
  if (s.length < 8) return false;
  // Avoid treating plain JSON as base64
  if (s.trimStart().startsWith('{')) return false;
  return /^[A-Za-z0-9+/]+=*$/.test(s.replace(/\s/g, ''));
}

/**
 * Whether offline x402Test payloads are accepted.
 * Production must leave this unset/false — forged scheme:exact never auto-passes.
 */
export function testPaymentsAllowed() {
  const v = process.env.X402_ALLOW_TEST_PAYMENTS;
  if (v === undefined || v === null || v === '') return false;
  return v === '1' || v === 'true' || v === 'yes';
}

/**
 * Default verifier (no free pass):
 * 1) If x402Test:true AND X402_ALLOW_TEST_PAYMENTS — local exact field checks only
 * 2) Else if injectable facilitatorVerify — trust only that backend
 * 3) Else if FACILITATOR_URL — remote verify
 * 4) Else reject (scheme:exact alone never authenticates)
 *
 * @param {object} opts
 * @param {object|null} opts.payload - decoded payment payload
 * @param {object} opts.requirements - buildPaymentRequired result
 * @param {string} opts.raw - raw header value
 * @param {(args: any) => Promise<any>} [opts.facilitatorVerify] - injectable chain/facilitator I/O
 */
export async function verifyPayment({
  payload,
  requirements,
  raw,
  facilitatorVerify,
}) {
  if (!payload) {
    return { valid: false, reason: 'missing_payment', status: 402 };
  }

  // ── Explicit test double (env-gated only) ────────────────────────
  // Never accept scheme:exact with a fake signature in production.
  if (payload.x402Test === true) {
    if (!testPaymentsAllowed()) {
      return {
        valid: false,
        reason: 'test_payments_disabled',
        status: 402,
      };
    }
    return verifyLocalExact(payload, requirements);
  }

  // Real payments: require facilitator or injectable verifier — never local-only.
  if (facilitatorVerify) {
    try {
      const result = await facilitatorVerify({ payload, requirements, raw });
      if (result?.valid) {
        return {
          valid: true,
          network: result.network || payload.network,
          amount: result.amount || payload.amount || payload.maxAmountRequired,
          payer: result.payer || payload.payer || payload.from,
          settlement: result.settlement || makeSettlement(payload, requirements, 'facilitator'),
          mode: 'facilitator',
        };
      }
      return {
        valid: false,
        reason: result?.reason || 'facilitator_rejected',
        status: 402,
      };
    } catch (e) {
      return { valid: false, reason: `facilitator_error: ${e.message}`, status: 502 };
    }
  }

  const facUrl =
    process.env.X402_FACILITATOR_URL ||
    process.env.CDP_FACILITATOR_URL ||
    null;

  if (facUrl) {
    try {
      const res = await fetch(`${facUrl.replace(/\/$/, '')}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          x402Version: X402_VERSION,
          paymentPayload: payload,
          paymentRequirements: requirements.accepts,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && (body.valid === true || body.isValid === true)) {
        return {
          valid: true,
          network: body.network || payload.network,
          amount: body.amount,
          payer: body.payer,
          settlement: makeSettlement(payload, requirements, 'facilitator'),
          mode: 'facilitator',
        };
      }
      return {
        valid: false,
        reason: body.reason || body.error || 'facilitator_rejected',
        status: 402,
      };
    } catch (e) {
      return { valid: false, reason: `facilitator_unreachable: ${e.message}`, status: 502 };
    }
  }

  // scheme:exact + matching amount with no facilitator is NOT payment
  return {
    valid: false,
    reason: 'unverified_payment_no_facilitator',
    status: 402,
  };
}

/**
 * Local exact-scheme check used by tests and offline verification.
 * Requires: network in accepts, amount >= maxAmountRequired, payTo match when present.
 */
export function verifyLocalExact(payload, requirements) {
  const accepts = requirements?.accepts || [];
  if (!accepts.length) {
    return { valid: false, reason: 'no_accepts', status: 500 };
  }

  const network = payload.network || payload.chain || payload.networkId;
  const amount = String(
    payload.amount ?? payload.maxAmountRequired ?? payload.value ?? ''
  );
  const payTo = payload.payTo || payload.to || payload.recipient;

  if (!network) {
    return { valid: false, reason: 'missing_network', status: 402 };
  }
  if (!amount || amount === '0') {
    return { valid: false, reason: 'missing_or_zero_amount', status: 402 };
  }

  const match = accepts.find((a) => a.network === network);
  if (!match) {
    return {
      valid: false,
      reason: `network_not_accepted: ${network}`,
      status: 402,
    };
  }

  try {
    const paid = BigInt(amount);
    const required = BigInt(match.maxAmountRequired);
    if (paid < required) {
      return {
        valid: false,
        reason: `underpaid: got ${amount} need ${match.maxAmountRequired}`,
        status: 402,
      };
    }
  } catch {
    return { valid: false, reason: 'invalid_amount', status: 402 };
  }

  if (payTo && match.payTo && normalizeAddr(payTo) !== normalizeAddr(match.payTo)) {
    return { valid: false, reason: 'payTo_mismatch', status: 402 };
  }

  // Optional asset check
  if (payload.asset && match.asset && normalizeAddr(payload.asset) !== normalizeAddr(match.asset)) {
    return { valid: false, reason: 'asset_mismatch', status: 402 };
  }

  // Test payloads must declare x402Test or a non-empty signature/tx
  const hasProof =
    payload.x402Test === true ||
    payload.signature ||
    payload.txHash ||
    payload.transaction ||
    payload.authorization ||
    payload.payload;

  if (!hasProof) {
    return { valid: false, reason: 'missing_payment_proof', status: 402 };
  }

  // Reject intentionally invalid markers
  if (payload.invalid === true || payload.signature === 'invalid') {
    return { valid: false, reason: 'invalid_signature', status: 402 };
  }

  return {
    valid: true,
    network,
    amount,
    payer: payload.payer || payload.from || 'unknown',
    settlement: makeSettlement(payload, requirements, payload.x402Test ? 'test' : 'local-exact'),
    mode: payload.x402Test ? 'test' : 'local-exact',
  };
}

function normalizeAddr(a) {
  return String(a).trim().toLowerCase();
}

export function makeSettlement(payload, requirements, mode) {
  const network = payload?.network || requirements?.accepts?.[0]?.network;
  const amount =
    payload?.amount ||
    payload?.maxAmountRequired ||
    requirements?.accepts?.[0]?.maxAmountRequired;
  const id = randomUUID();
  const receiptHash = createHash('sha256')
    .update(`${id}:${network}:${amount}:${mode}`)
    .digest('hex');

  return {
    success: true,
    transaction: payload?.txHash || payload?.transaction || `settle_${receiptHash.slice(0, 16)}`,
    network,
    amount: String(amount),
    payer: payload?.payer || payload?.from || null,
    mode,
    timestamp: new Date().toISOString(),
    receiptHash,
  };
}

export function encodePaymentResponse(settlement) {
  return Buffer.from(JSON.stringify(settlement), 'utf8').toString('base64');
}

/**
 * Encode a client payment payload for tests / examples.
 */
export function encodePaymentPayload(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');
}

/**
 * Build a valid test payment for a given requirements object (first accept or chosen network).
 */
export function makeValidTestPayment(requirements, { network, underpay = false, invalid = false } = {}) {
  const accepts = requirements.accepts || [];
  const accept =
    (network && accepts.find((a) => a.network === network)) || accepts[0];
  if (!accept) throw new Error('no accepts in requirements');

  let amount = accept.maxAmountRequired;
  if (underpay) {
    const n = BigInt(amount);
    amount = String(n > 0n ? n - 1n : 0n);
  }

  return {
    x402Test: true,
    scheme: 'exact',
    network: accept.network,
    amount,
    payTo: accept.payTo,
    asset: accept.asset,
    signature: invalid ? 'invalid' : `test_sig_${amount}`,
    payer: '0xtestpayer000000000000000000000000000001',
    invalid: invalid || undefined,
  };
}

// re-export helpers useful for tests
export { usdToAtomic, NETWORKS, networkByCaip, listNetworkAccepts };
