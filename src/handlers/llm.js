/**
 * Live LLM handlers — OpenRouter when keyed, deterministic completion fallback.
 */

const MODEL_MAP = {
  'gpt-4o-mini': 'openai/gpt-4o-mini',
  'gpt-4o': 'openai/gpt-4o',
  'gpt-5.4': 'openai/gpt-5.4',
  'gpt-5.4-pro': 'openai/gpt-5.4-pro',
  'claude-sonnet': 'anthropic/claude-sonnet-4',
  'claude-haiku': 'anthropic/claude-haiku-4.5',
  'claude-opus': 'anthropic/claude-opus-4',
  deepseek: 'deepseek/deepseek-chat',
  llama: 'meta-llama/llama-3.3-70b-instruct',
  grok: 'x-ai/grok-3',
};

/**
 * POST /api/llm/:model
 * Body: { messages: [{role, content}], ... } or { prompt: string }
 */
export async function handleLlm(req, res) {
  const slug = req.params.model || 'gpt-4o-mini';
  const openRouterModel = MODEL_MAP[slug] || `openai/${slug}`;

  const messages = normalizeMessages(req.body);
  if (!messages.length) {
    return res.status(400).json({
      error: 'messages_required',
      message: 'Provide { messages: [{ role, content }] } or { prompt: "..." }',
    });
  }

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  let completion;
  let source = 'openrouter';

  if (apiKey && process.env.X402_FORCE_LLM_FALLBACK !== '1') {
    try {
      completion = await callOpenRouter({
        apiKey,
        model: openRouterModel,
        messages,
        baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      });
    } catch (e) {
      if (process.env.X402_ALLOW_LLM_FALLBACK === '0') {
        return res.status(502).json({ error: 'upstream_unavailable', message: e.message });
      }
      source = 'fallback';
      completion = fallbackCompletion(messages, slug);
    }
  } else {
    source = 'fallback';
    completion = fallbackCompletion(messages, slug);
  }

  // Domain contract: OpenAI-compatible chat completion shape with text content
  return res.status(200).json({
    id: completion.id,
    object: 'chat.completion',
    created: completion.created,
    model: openRouterModel,
    choices: completion.choices,
    usage: completion.usage,
    _meta: {
      source,
      slug,
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

function normalizeMessages(body = {}) {
  if (Array.isArray(body.messages) && body.messages.length) {
    return body.messages.map((m) => ({
      role: m.role || 'user',
      content: String(m.content ?? ''),
    }));
  }
  if (body.prompt) {
    return [{ role: 'user', content: String(body.prompt) }];
  }
  if (typeof body === 'string') {
    return [{ role: 'user', content: body }];
  }
  return [];
}

async function callOpenRouter({ apiKey, model, messages, baseUrl }) {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.PUBLIC_URL || 'https://clawd-gateway.local',
      'x-title': 'clawd-gateway',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 512,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const body = await res.json();
  if (!body.choices?.[0]?.message?.content && !body.choices?.[0]?.text) {
    throw new Error('OpenRouter returned empty completion');
  }
  return body;
}

function fallbackCompletion(messages, slug) {
  const last = messages[messages.length - 1]?.content || '';
  const text =
    `[clawd-gateway/${slug}] Paid completion (fallback mode). ` +
    `You said: "${String(last).slice(0, 280)}". ` +
    `Set OPENROUTER_API_KEY for live model inference.`;

  return {
    id: `chatcmpl_fallback_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: text },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: Math.ceil(JSON.stringify(messages).length / 4),
      completion_tokens: Math.ceil(text.length / 4),
      total_tokens: Math.ceil((JSON.stringify(messages).length + text.length) / 4),
    },
  };
}
