/**
 * Express middleware: x402 payment gate for catalog routes.
 * No sessions, no API keys — payment is authentication.
 */

import {
  buildPaymentRequired,
  encodePaymentRequiredHeader,
  extractPaymentPayload,
  verifyPayment,
  encodePaymentResponse,
} from './payment.js';
import { getRoute } from './catalog.js';

/**
 * @param {object} [options]
 * @param {(args: any) => Promise<any>} [options.facilitatorVerify] - injectable verifier backend
 * @param {string} [options.publicUrl]
 */
export function createPaymentGate(options = {}) {
  const { facilitatorVerify, publicUrl } = options;

  return async function paymentGate(req, res, next) {
    const route = req.x402Route || getRoute(req.path);
    if (!route) {
      return res.status(404).json({
        error: 'not_found',
        message: `No priced route for ${req.path}. See GET /catalog`,
      });
    }

    // Attach route meta for handlers
    req.x402Route = route;

    const resourceBase = publicUrl || `${req.protocol}://${req.get('host') || 'localhost'}`;
    const resource = `${resourceBase}${route.path}`;

    const requirements = buildPaymentRequired({
      resource,
      priceUsd: route.priceUsd,
      description: route.description,
    });

    const extracted = extractPaymentPayload(req.headers);

    if (!extracted.present) {
      const header = encodePaymentRequiredHeader(requirements);
      res.setHeader('PAYMENT-REQUIRED', header);
      // v1 compat
      res.setHeader('X-PAYMENT-REQUIRED', header);
      return res.status(402).json(requirements);
    }

    const result = await verifyPayment({
      payload: extracted.decoded,
      requirements,
      raw: extracted.raw,
      facilitatorVerify,
    });

    if (!result.valid) {
      // Invalid / underpaid — do NOT execute billed work
      const status = result.status === 502 ? 502 : 402;
      const header = encodePaymentRequiredHeader(requirements);
      res.setHeader('PAYMENT-REQUIRED', header);
      return res.status(status).json({
        error: 'payment_rejected',
        reason: result.reason,
        message: 'Invalid or insufficient payment; work was not executed',
        accepts: requirements.accepts,
        priceUsd: route.priceUsd,
      });
    }

    // Payment verified — attach settlement and continue to handler
    req.x402Payment = result;
    req.x402Settlement = result.settlement;

    // Helper for handlers to attach payment response headers
    res.setPaymentResponse = (settlement = result.settlement) => {
      const encoded = encodePaymentResponse(settlement);
      res.setHeader('PAYMENT-RESPONSE', encoded);
      res.setHeader('X-PAYMENT-RESPONSE', encoded);
    };

    return next();
  };
}

/**
 * Wrap a handler so settlement headers are always set on success.
 */
export function withSettlement(handler) {
  return async function settledHandler(req, res, next) {
    try {
      // Ensure payment response is present for successful paid responses
      if (typeof res.setPaymentResponse === 'function') {
        res.setPaymentResponse(req.x402Settlement);
      }
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
