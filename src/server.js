/**
 * clawd-gateway — open x402 vending machine entry point.
 *
 *   npm start
 *   PORT=8402 node src/server.js
 */

import { createApp } from './app.js';

const PORT = Number(process.env.PORT || 8402);
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp({
  publicUrl: process.env.PUBLIC_URL,
});

const server = app.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_URL || `http://127.0.0.1:${PORT}`;
  console.log(`clawd-gateway listening on ${HOST}:${PORT}`);
  console.log(`  health  ${base}/health`);
  console.log(`  catalog ${base}/catalog`);
  console.log(`  try     curl -i "${base}/api/crypto/price?ids=bitcoin"`);
  console.log(`  auth    payment only (no accounts, no API keys)`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, server };
