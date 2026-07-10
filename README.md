# open-gateway

**A vending machine for data and AI tools** — open x402 pay-per-request gateway.

Instead of signing up for a dozen services, managing API keys, and juggling subscriptions — software just sends a fraction of a cent and gets back useful work.

| | |
|---|---|
| **Accounts** | None — a wallet that pays is identity |
| **API keys** | None — payment is authentication |
| **Subscriptions** | None — pay exactly what each call costs |

```bash
# Clone (same pattern as other open-gateway projects)
gh repo clone Solizardking/open-gateway
cd open-gateway

npm install
npm start
# → http://127.0.0.1:8402
```

Or with plain git:

```bash
git clone https://github.com/Solizardking/open-gateway.git
cd open-gateway && npm install && npm start
```

## Quick try

### Unpaid call → 402

```bash
curl -i "http://127.0.0.1:8402/api/crypto/price?ids=bitcoin"
# HTTP/1.1 402 Payment Required
# PAYMENT-REQUIRED: eyJ4NDAyVmVyc2lvbiI6Miw...
```

### Paid call → work

Attach a `PAYMENT-SIGNATURE` (or v1 `X-PAYMENT`) header with a base64 payment attested by a facilitator / on-chain exact scheme. Settlement receipt returns in `PAYMENT-RESPONSE`.

**Security:** Matching `scheme:exact` fields alone is **not** payment. Without `X402_FACILITATOR_URL` (or an injectable facilitator), production rejects the request. Offline `x402Test:true` payloads only work when `X402_ALLOW_TEST_PAYMENTS=1` (never in production).

```bash
# After signing a real USDC transfer via @x402/fetch (Base / Solana / MegaETH):
curl -s "http://127.0.0.1:8402/api/crypto/price?ids=bitcoin" \
  -H "PAYMENT-SIGNATURE: <base64-signed-payment>"
```

### Discovery

```bash
curl -s http://127.0.0.1:8402/health | jq .
curl -s http://127.0.0.1:8402/catalog | jq '.routeCount, .categories | keys'
curl -s http://127.0.0.1:8402/.well-known/x402 | jq .
```

## Networks

| Network | CAIP-2 | Token | Decimals |
|---------|--------|-------|----------|
| Base | `eip155:8453` | USDC | 6 |
| MegaETH | `eip155:4326` | USDm | 18 |
| Solana | `solana:5eykt4UsjR1L6CXFJSXTa6TA4bRbYRk7x7xZjYj` | USDC | 6 |

## Live paid routes (this build)

| Route | Price | Work |
|-------|-------|------|
| `GET /api/crypto/price` | $0.001 | CoinGecko (fallback shape if rate-limited) |
| `POST /api/llm/gpt-4o-mini` | $0.003 | OpenRouter when keyed, else paid completion fallback |
| `GET /api/web/scrape` | $0.005 | Fetch URL → markdown/text |

Remaining catalog routes (~82 total) are **payment-gated** and return `503 not_configured` after valid payment until their upstreams are wired.

## Client example (`@x402/fetch`)

```ts
import { wrapFetchWithPayment, x402Client } from "@x402/fetch";
import { registerExactEvmScheme } from "@x402/evm/exact/client";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY);
const client = new x402Client();
registerExactEvmScheme(client, { signer: account, networks: ["eip155:8453"] });
const paidFetch = wrapFetchWithPayment(fetch, client);

const res = await paidFetch("http://127.0.0.1:8402/api/crypto/price?ids=bitcoin");
console.log(await res.json());
```

## Tests

```bash
npm test
```

## Layout

```
src/
  app.js           # Express app factory
  server.js        # listen entry
  catalog.js       # priced routes
  networks.js      # Base / MegaETH / Solana + atomic amounts
  payment.js       # 402 requirements + verify interface
  middleware.js    # payment gate
  handlers/        # crypto, llm, web
```

## Env

See [`.env.example`](./.env.example). Server-side provider keys never leave the host; clients only pay.

## Reference clones

Optional local study material (not required to run):

```bash
gh repo clone sensiml/open-gateway vendor/sensiml-open-gateway
gh repo clone coinbase/x402 vendor/coinbase-x402
gh repo clone shinothelegend/null-402-gateway vendor/null-402-gateway
```

See [REFERENCES.md](./REFERENCES.md).

## License

MIT
