# Reference repositories

Local clones used while building this open gateway live under `vendor/`
(gitignored). Bootstrap the same way with `gh`:

```bash
# Packaging / open-gateway app layout (sensor domain — structure only)
gh repo clone sensiml/open-gateway vendor/sensiml-open-gateway

# x402 protocol + SDKs (Coinbase)
gh repo clone coinbase/x402 vendor/coinbase-x402

# Reference paid edge gateway (402 → verify → real upstream work)
gh repo clone shinothelegend/null-402-gateway vendor/null-402-gateway
```

## What we took from each

| Repo | Useful for |
|------|------------|
| `sensiml/open-gateway` | Cloneable open-gateway packaging, README install flow, single entrypoint |
| `coinbase/x402` | Protocol specs, schemes, facilitator verify/settle shape |
| `null-402-gateway` | Gate discipline: unpaid → 402, paid → real work (no fake free pass) |

This project (`open-gateway` / clawd-gateway) implements **HTTP 402 / x402**
micropayments for data & AI tools — not SensiML sensor streaming.
