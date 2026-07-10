/**
 * Live web handlers — scrape URL to clean text/markdown after payment.
 */

/**
 * GET /api/web/scrape?url=https://example.com
 */
export async function handleWebScrape(req, res) {
  const target = req.query.url || req.query.u;
  if (!target) {
    return res.status(400).json({
      error: 'url_required',
      message: 'Pass ?url=https://example.com',
    });
  }

  let parsed;
  try {
    parsed = new URL(String(target));
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http/https URLs are allowed');
    }
  } catch (e) {
    return res.status(400).json({ error: 'invalid_url', message: e.message });
  }

  // Block obvious SSRF targets
  if (isPrivateHost(parsed.hostname)) {
    return res.status(400).json({
      error: 'blocked_host',
      message: 'Private/local hosts are not allowed',
    });
  }

  let html;
  let source = 'fetch';
  try {
    const upstream = await fetch(parsed.toString(), {
      headers: {
        'user-agent': 'clawd-gateway-scraper/1.0 (+x402)',
        accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      throw new Error(`Upstream HTTP ${upstream.status}`);
    }
    const ct = upstream.headers.get('content-type') || '';
    html = await upstream.text();
    if (!html) throw new Error('Empty body');
    // Cap size
    if (html.length > 1_500_000) html = html.slice(0, 1_500_000);
    void ct;
  } catch (e) {
    if (process.env.X402_ALLOW_SCRAPE_FALLBACK === '0') {
      return res.status(502).json({ error: 'upstream_unavailable', message: e.message });
    }
    source = 'fallback';
    html = `<html><head><title>Unavailable</title></head><body><h1>${parsed.hostname}</h1><p>Could not fetch: ${e.message}</p></body></html>`;
  }

  const markdown = htmlToMarkdown(html, parsed.toString());

  return res.status(200).json({
    url: parsed.toString(),
    title: extractTitle(html),
    markdown,
    text: stripToText(markdown),
    length: markdown.length,
    _meta: {
      source,
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

function isPrivateHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (h === 'metadata.google.internal') return true;
  return false;
}

function extractTitle(html) {
  const m = String(html).match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? decodeEntities(m[1].trim()) : null;
}

function htmlToMarkdown(html, baseUrl) {
  let s = String(html);
  // Remove scripts/styles
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, t) => `\n# ${innerText(t)}\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `\n## ${innerText(t)}\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, t) => `\n### ${innerText(t)}\n`);
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `\n- ${innerText(t)}`);
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p>/gi, '\n\n');
  s = s.replace(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => {
    const text = innerText(t) || href;
    try {
      const abs = new URL(href, baseUrl).toString();
      return `[${text}](${abs})`;
    } catch {
      return text;
    }
  });
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s.slice(0, 100_000);
}

function innerText(chunk) {
  return decodeEntities(String(chunk).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function stripToText(md) {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50_000);
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
