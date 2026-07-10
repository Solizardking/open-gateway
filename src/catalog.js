/**
 * Priced route catalog — the vending machine menu.
 * Paths and USD prices from the open-gateway objective.
 */

/** @typedef {{ path: string, method: string, priceUsd: number, category: string, description: string, live?: boolean }} CatalogRoute */

/** @type {CatalogRoute[]} */
export const CATALOG = [
  // ── Crypto & Blockchain ──────────────────────────────────────────
  { path: '/api/crypto/price', method: 'GET', priceUsd: 0.001, category: 'crypto', description: 'Real-time prices via CoinGecko', live: true },
  { path: '/api/crypto/markets', method: 'GET', priceUsd: 0.002, category: 'crypto', description: 'Rankings, volume, market cap' },
  { path: '/api/crypto/history', method: 'GET', priceUsd: 0.003, category: 'crypto', description: 'Price history, OHLC, charts' },
  { path: '/api/crypto/trending', method: 'GET', priceUsd: 0.001, category: 'crypto', description: 'Currently trending coins' },
  { path: '/api/crypto/search', method: 'GET', priceUsd: 0.001, category: 'crypto', description: 'Search by name or symbol' },
  { path: '/api/wallet/balances', method: 'POST', priceUsd: 0.005, category: 'crypto', description: 'Multichain balances' },
  { path: '/api/wallet/transactions', method: 'POST', priceUsd: 0.005, category: 'crypto', description: 'Transaction history with labels' },
  { path: '/api/wallet/pnl', method: 'POST', priceUsd: 0.01, category: 'crypto', description: 'Wallet PnL summary' },
  { path: '/api/token/prices', method: 'POST', priceUsd: 0.005, category: 'crypto', description: 'DEX-derived OHLC' },
  { path: '/api/token/metadata', method: 'GET', priceUsd: 0.002, category: 'crypto', description: 'Name, symbol, decimals, chain' },
  { path: '/api/ens/resolve', method: 'GET', priceUsd: 0.001, category: 'crypto', description: 'ENS name → Ethereum address' },
  { path: '/api/ens/reverse', method: 'GET', priceUsd: 0.001, category: 'crypto', description: 'Address → ENS name' },
  { path: '/api/tx/simulate', method: 'POST', priceUsd: 0.01, category: 'crypto', description: 'Simulate EVM txs' },

  // ── LLM & AI ─────────────────────────────────────────────────────
  { path: '/api/llm/gpt-5.4', method: 'POST', priceUsd: 0.10, category: 'llm', description: 'Unified flagship, 1M ctx' },
  { path: '/api/llm/gpt-5.4-pro', method: 'POST', priceUsd: 0.30, category: 'llm', description: 'Max reasoning tier' },
  { path: '/api/llm/gpt-5.3-codex', method: 'POST', priceUsd: 0.08, category: 'llm', description: 'SOTA agentic coding' },
  { path: '/api/llm/gpt-5.2-pro', method: 'POST', priceUsd: 0.25, category: 'llm', description: 'Premium reasoning' },
  { path: '/api/llm/gpt-5.2', method: 'POST', priceUsd: 0.08, category: 'llm', description: 'Previous flagship' },
  { path: '/api/llm/gpt-5.2-codex', method: 'POST', priceUsd: 0.06, category: 'llm', description: 'Code reasoning' },
  { path: '/api/llm/gpt-5.1', method: 'POST', priceUsd: 0.035, category: 'llm', description: 'Efficient flagship' },
  { path: '/api/llm/gpt-4o', method: 'POST', priceUsd: 0.04, category: 'llm', description: 'Flagship multimodal' },
  { path: '/api/llm/gpt-4o-mini', method: 'POST', priceUsd: 0.003, category: 'llm', description: 'Fast & affordable', live: true },
  { path: '/api/llm/o1', method: 'POST', priceUsd: 0.03, category: 'llm', description: 'Reasoning model' },
  { path: '/api/llm/o4-mini', method: 'POST', priceUsd: 0.03, category: 'llm', description: 'Latest small reasoning' },
  { path: '/api/llm/gpt-5-nano', method: 'POST', priceUsd: 0.002, category: 'llm', description: 'Ultra-cheap GPT-5' },
  { path: '/api/llm/claude-opus-4.8', method: 'POST', priceUsd: 0.09, category: 'llm', description: 'Latest premium Opus' },
  { path: '/api/llm/claude-opus', method: 'POST', priceUsd: 0.09, category: 'llm', description: 'Most powerful' },
  { path: '/api/llm/claude-sonnet-4.6', method: 'POST', priceUsd: 0.06, category: 'llm', description: 'Latest balanced' },
  { path: '/api/llm/claude-sonnet', method: 'POST', priceUsd: 0.06, category: 'llm', description: 'Balanced & versatile' },
  { path: '/api/llm/claude-opus-4.5', method: 'POST', priceUsd: 0.09, category: 'llm', description: 'Previous-gen Opus' },
  { path: '/api/llm/claude-haiku', method: 'POST', priceUsd: 0.02, category: 'llm', description: 'Fast & affordable' },
  { path: '/api/llm/gemini-3.1-pro', method: 'POST', priceUsd: 0.05, category: 'llm', description: 'Latest Google flagship' },
  { path: '/api/llm/gemini-3.1-flash-lite', method: 'POST', priceUsd: 0.003, category: 'llm', description: 'Fastest & cheapest' },
  { path: '/api/llm/gemini-3-pro', method: 'POST', priceUsd: 0.045, category: 'llm', description: 'Pro reasoning route' },
  { path: '/api/llm/gemini-3-flash', method: 'POST', priceUsd: 0.012, category: 'llm', description: 'Fast next-gen' },
  { path: '/api/llm/gemini-pro', method: 'POST', priceUsd: 0.035, category: 'llm', description: 'Strong reasoning' },
  { path: '/api/llm/gemini-flash', method: 'POST', priceUsd: 0.009, category: 'llm', description: 'Speed + quality' },
  { path: '/api/llm/deepseek-v4-pro', method: 'POST', priceUsd: 0.006, category: 'llm', description: 'V4 reasoning, stronger' },
  { path: '/api/llm/deepseek-v4-flash', method: 'POST', priceUsd: 0.003, category: 'llm', description: 'Ultra-cheap V4' },
  { path: '/api/llm/deepseek-v3.2', method: 'POST', priceUsd: 0.005, category: 'llm', description: 'Latest open-source' },
  { path: '/api/llm/deepseek', method: 'POST', priceUsd: 0.005, category: 'llm', description: 'Open-source powerhouse' },
  { path: '/api/llm/deepseek-r1', method: 'POST', priceUsd: 0.01, category: 'llm', description: 'Chain-of-thought reasoning' },
  { path: '/api/llm/deepseek-v3.2-speciale', method: 'POST', priceUsd: 0.008, category: 'llm', description: 'Compatibility route' },
  { path: '/api/llm/llama', method: 'POST', priceUsd: 0.002, category: 'llm', description: 'Open-source, low cost' },
  { path: '/api/llm/llama-4-maverick', method: 'POST', priceUsd: 0.003, category: 'llm', description: '1M context, latest Meta' },
  { path: '/api/llm/grok', method: 'POST', priceUsd: 0.06, category: 'llm', description: 'xAI reasoning' },
  { path: '/api/llm/grok-code', method: 'POST', priceUsd: 0.04, category: 'llm', description: 'Build-focused' },
  { path: '/api/llm/qwen', method: 'POST', priceUsd: 0.004, category: 'llm', description: 'Multilingual & coding' },
  { path: '/api/llm/qwen-coder', method: 'POST', priceUsd: 0.004, category: 'llm', description: 'Code specialist' },
  { path: '/api/llm/qwen3.5', method: 'POST', priceUsd: 0.006, category: 'llm', description: '1M context, latest' },
  { path: '/api/llm/qwen3.7-max', method: 'POST', priceUsd: 0.015, category: 'llm', description: 'Flagship Qwen 3.7' },
  { path: '/api/llm/qwen3.7-plus', method: 'POST', priceUsd: 0.006, category: 'llm', description: 'Cost-effective 1M ctx' },
  { path: '/api/llm/mistral', method: 'POST', priceUsd: 0.006, category: 'llm', description: 'European flagship' },
  { path: '/api/llm/devstral', method: 'POST', priceUsd: 0.02, category: 'llm', description: 'Code-focused' },
  { path: '/api/llm/perplexity', method: 'POST', priceUsd: 0.06, category: 'llm', description: 'Search-augmented' },
  { path: '/api/llm/kimi', method: 'POST', priceUsd: 0.03, category: 'llm', description: 'Strong reasoning' },
  { path: '/api/llm/minimax', method: 'POST', priceUsd: 0.01, category: 'llm', description: 'Fast & affordable' },
  { path: '/api/llm/minimax-m2.7', method: 'POST', priceUsd: 0.01, category: 'llm', description: 'Latest, 204k context' },
  { path: '/api/llm/minimax-m3', method: 'POST', priceUsd: 0.01, category: 'llm', description: '1M context multimodal' },
  { path: '/api/llm/glm', method: 'POST', priceUsd: 0.03, category: 'llm', description: 'Zhipu multilingual' },
  { path: '/api/llm/glm-5.2', method: 'POST', priceUsd: 0.03, category: 'llm', description: '1M context reasoning' },
  { path: '/api/llm/seed', method: 'POST', priceUsd: 0.02, category: 'llm', description: 'ByteDance flagship' },
  { path: '/api/llm/command-a', method: 'POST', priceUsd: 0.04, category: 'llm', description: 'Cohere enterprise RAG' },
  { path: '/api/embeddings', method: 'POST', priceUsd: 0.001, category: 'llm', description: '1536-dim vectors for RAG' },

  // ── Compute ──────────────────────────────────────────────────────
  { path: '/api/image/fast', method: 'POST', priceUsd: 0.015, category: 'compute', description: 'FLUX Schnell — ~2s generation' },
  { path: '/api/image/quality', method: 'POST', priceUsd: 0.05, category: 'compute', description: 'FLUX.2 Pro — production quality' },
  { path: '/api/image/text', method: 'POST', priceUsd: 0.12, category: 'compute', description: 'Ideogram v3 — logos, signage' },
  { path: '/api/image/nano-banana', method: 'POST', priceUsd: 0.10, category: 'compute', description: "Google's fast image gen" },
  { path: '/api/image/face-swap', method: 'POST', priceUsd: 0.08, category: 'compute', description: 'Face swap generation' },
  { path: '/api/code/run', method: 'POST', priceUsd: 0.005, category: 'compute', description: 'Sandboxed Python, JS, Bash, R' },
  { path: '/api/transcribe', method: 'POST', priceUsd: 0.10, category: 'compute', description: 'Deepgram Nova-3 with diarization' },
  { path: '/api/tts/openai', method: 'POST', priceUsd: 0.01, category: 'compute', description: '6 voices, HD quality' },
  { path: '/api/tts/elevenlabs', method: 'POST', priceUsd: 0.02, category: 'compute', description: 'Ultra-realistic multilingual TTS' },
  { path: '/api/tts/lux', method: 'POST', priceUsd: 0.02, category: 'compute', description: 'Voice cloning TTS at 48kHz' },

  // ── Web ──────────────────────────────────────────────────────────
  { path: '/api/web/scrape', method: 'GET', priceUsd: 0.005, category: 'web', description: 'Clean markdown from any URL', live: true },
  { path: '/api/web/screenshot', method: 'GET', priceUsd: 0.01, category: 'web', description: 'Capture any URL as base64 image' },
  { path: '/api/search/web', method: 'POST', priceUsd: 0.01, category: 'web', description: 'Neural search with snippets' },
  { path: '/api/search/contents', method: 'POST', priceUsd: 0.005, category: 'web', description: 'Extract clean text from up to 10 URLs' },

  // ── Travel ───────────────────────────────────────────────────────
  { path: '/api/travel/flights', method: 'GET', priceUsd: 0.02, category: 'travel', description: 'Google Flights — prices, airlines' },
  { path: '/api/travel/hotels', method: 'GET', priceUsd: 0.02, category: 'travel', description: 'Google Hotels — ratings, amenities' },

  // ── Storage ──────────────────────────────────────────────────────
  { path: '/api/ipfs/pin', method: 'POST', priceUsd: 0.01, category: 'storage', description: 'Pin JSON, files, or URLs' },
  { path: '/api/ipfs/get', method: 'GET', priceUsd: 0.001, category: 'storage', description: 'Fetch files by CID' },
];

const byPath = new Map(CATALOG.map((r) => [r.path, r]));

export function getRoute(path) {
  // Exact match first
  if (byPath.has(path)) return byPath.get(path);
  // Strip query if present
  const bare = path.split('?')[0];
  return byPath.get(bare) || null;
}

export function listCatalog({ publicUrl = '' } = {}) {
  const categories = {};
  for (const route of CATALOG) {
    if (!categories[route.category]) categories[route.category] = [];
    categories[route.category].push({
      path: route.path,
      method: route.method,
      priceUsd: route.priceUsd,
      description: route.description,
      live: !!route.live,
      url: publicUrl ? `${publicUrl}${route.path}` : route.path,
    });
  }
  return {
    name: 'clawd-gateway',
    description: 'Open x402 vending machine for data and AI tools — payment is authentication',
    protocol: 'x402',
    x402Version: 2,
    networks: [
      { id: 'eip155:8453', token: 'USDC', decimals: 6, name: 'Base' },
      { id: 'eip155:4326', token: 'USDm', decimals: 18, name: 'MegaETH' },
      { id: 'solana:5eykt4UsjR1L6CXFJSXTa6TA4bRbYRk7x7xZjYj', token: 'USDC', decimals: 6, name: 'Solana' },
    ],
    routeCount: CATALOG.length,
    categories,
    routes: CATALOG.map((r) => ({
      path: r.path,
      method: r.method,
      priceUsd: r.priceUsd,
      category: r.category,
      description: r.description,
      live: !!r.live,
    })),
  };
}

export function categoriesPresent() {
  return [...new Set(CATALOG.map((r) => r.category))];
}
