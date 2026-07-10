/**
 * Supported settlement networks for the open x402 gateway.
 * CAIP-2 network ids, stablecoin assets, and pay-to addresses.
 */

/** @typedef {{ id: string, family: 'evm'|'svm', name: string, token: string, decimals: number, asset: string, confirmationHint: string, facilitator?: string }} NetworkDef */

/** @type {Record<string, NetworkDef>} */
export const NETWORKS = {
  base: {
    id: 'eip155:8453',
    family: 'evm',
    name: 'Base',
    token: 'USDC',
    decimals: 6,
    // Circle USDC on Base mainnet
    asset: process.env.X402_BASE_USDC || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    confirmationHint: '~2s',
    facilitator: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  },
  megaeth: {
    id: 'eip155:4326',
    family: 'evm',
    name: 'MegaETH',
    token: 'USDm',
    decimals: 18,
    // Set X402_MEGAETH_USDM to the real USDm contract when MegaETH settles live
    asset: process.env.X402_MEGAETH_USDM || '0x0000000000000000000000000000000000000a01',
    confirmationHint: '~10ms',
  },
  solana: {
    // Solana mainnet genesis hash (CAIP-2)
    id: 'solana:5eykt4UsjR1L6CXFJSXTa6TA4bRbYRk7x7xZjYj',
    family: 'svm',
    name: 'Solana',
    token: 'USDC',
    decimals: 6,
    asset: process.env.X402_SOLANA_USDC || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    confirmationHint: '~400ms',
    facilitator: process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator',
  },
};

/** Ordered list used in 402 accepts[] */
export const DEFAULT_NETWORK_ORDER = ['base', 'megaeth', 'solana'];

export function getPayTo(networkKey) {
  const net = NETWORKS[networkKey];
  if (!net) return null;
  if (net.family === 'svm') {
    // Valid-length placeholder; set X402_PAY_TO_SOLANA in production
    return (
      process.env.X402_PAY_TO_SOLANA ||
      process.env.X402_PAY_TO ||
      '11111111111111111111111111111111'
    );
  }
  // Valid 20-byte hex placeholder; set X402_PAY_TO_EVM in production
  return (
    process.env.X402_PAY_TO_EVM ||
    process.env.X402_PAY_TO ||
    '0x0000000000000000000000000000000000000402'
  );
}

/**
 * Convert USD price to atomic token amount string for a network.
 * USDC (6 decimals): $0.001 → "1000"
 * USDm (18 decimals): $0.001 → "1000000000000000"
 */
export function usdToAtomic(usdPrice, decimals) {
  const price = Number(usdPrice);
  if (!Number.isFinite(price) || price < 0) {
    throw new Error(`Invalid USD price: ${usdPrice}`);
  }
  // Use integer math via string to avoid float issues on high decimals
  const [whole, frac = ''] = String(price).split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const raw = `${whole.replace(/^0+/, '') || '0'}${fracPadded}`.replace(/^0+/, '') || '0';
  // For prices smaller than 1 with leading zeros in frac already handled
  const digits = whole === '0' || whole === ''
    ? fracPadded.replace(/^0+/, '') || '0'
    : `${whole}${fracPadded}`.replace(/^0+/, '') || '0';
  // Prefer BigInt-safe path
  try {
    const scale = 10n ** BigInt(decimals);
    // price as rational: parse with up to decimals precision
    const asMicro = Number((price * Number(scale)).toFixed(0));
    if (Number.isSafeInteger(asMicro) && decimals <= 6) {
      return String(asMicro);
    }
    // High-precision path for 18-decimal tokens
    const fixed = price.toFixed(Math.min(decimals, 18));
    const [w, f = ''] = fixed.split('.');
    const combined = `${w}${f.padEnd(decimals, '0').slice(0, decimals)}`;
    return combined.replace(/^0+(?=\d)/, '') || '0';
  } catch {
    return String(Math.round(price * 10 ** decimals));
  }
}

export function listNetworkAccepts(usdPrice, resource, description) {
  return DEFAULT_NETWORK_ORDER.map((key) => {
    const net = NETWORKS[key];
    return {
      scheme: 'exact',
      network: net.id,
      maxAmountRequired: usdToAtomic(usdPrice, net.decimals),
      resource,
      description: description || `Payment for ${resource}`,
      mimeType: 'application/json',
      payTo: getPayTo(key),
      maxTimeoutSeconds: 60,
      asset: net.asset,
      extra: {
        name: net.token,
        decimals: net.decimals,
        family: net.family,
        networkName: net.name,
        confirmationHint: net.confirmationHint,
        facilitator: net.facilitator || null,
        priceUsd: usdPrice,
      },
    };
  });
}

export function networkByCaip(caipId) {
  return Object.values(NETWORKS).find((n) => n.id === caipId) || null;
}
