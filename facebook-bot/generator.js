import axios from 'axios';
import { generateFromTemplate, shouldUseTemplateOnly } from './templates.js';

const DEFAULT_MODEL = 'claude-opus-4-6';

const EXAMPLE_POSTS = `Example 1 (style reference):
أنتِ تستاهلي أكتر من مجرد ديكور، أنتِ تستاهلي جمال يلمس قلبك! 💖
اختاري بوت الفايبر جلاس اللي يناسب ذوقك،
كل قطعة بتتعمل خصيصًا لك باللون والمقاس اللي تحبيه.
📲 تواصلي معنا عبر الواتساب 01226626676 وابدئي التغيير الآن!
#ديكور_ستات #لمسة_أنثوية #بوتات_فايبر_جلاس #جمال_المنزل #M&U_

Example 2 (style reference):
المصنع مباشرة إلى منزلك!
جودة بلا حدود مع بوتات الفايبر جلاس المصممة خصيصًا لك.
مقاسات وألوان متعددة تناسب كل الأذواق والمساحات.
📦 توصيل لحد باب البيت، مع فرصة لمراجعة الأوردر قبل استلامه.
🛒 للتفاصيل وطلب الأوردر: 01226626676
#من_المصنع_لبيتك #بوتات_مودرن #ديكور_مميز #جودة_مضمونة #توصيل_حتى_الباب

Example 3 (style reference):
🌿 عايز تغير شكل ركن الزرع عندك؟
ولا الصالون؟ ولا حتى مدخل البيت؟
يبقى M&U هو الحل 💯
اختار التصميم من الصور،
وإحنا هنفصّله ليك مخصوص بلونك ومقاسك!
📩 ابعتلنا دلوقتي على البيدج أو واتساب
📞 01226626676`;

function getBrandConfig() {
  return {
    name: process.env.BRAND_NAME || 'M&U',
    product: process.env.PRODUCT_NAME || 'fiberglass planters',
    whatsapp: process.env.WHATSAPP_NUMBER || '01226626676',
  };
}

function buildSystemPrompt() {
  const { name, product, whatsapp } = getBrandConfig();

  return `You are a Facebook marketing copywriter for "${name}" page.
Product: fiberglass planters (بوتات فايبر جلاس) — modern home decor, made to order (custom color and size).
WhatsApp orders: ${whatsapp}

Writing rules (OUTPUT must be in Egyptian Arabic dialect, NOT formal Arabic):
- Natural Egyptian colloquial (عامية مصرية)
- Short punchy lines, one idea per line, blank lines between sections
- Mix feminine (أنتِ / اختاري / تواصلي) and masculine (عايز / اختار / ابعتلنا) address
- 3–5 emojis per post
- Clear CTA with WhatsApp ${whatsapp} or message the page
- 4–5 Arabic hashtags at the end (decor, fiberglass pots, M&U, etc.)
- NO programming or tech content — only home decor and ${name} products
- Match the EXACT tone, rhythm, and structure of these examples:

${EXAMPLE_POSTS}`;
}

function buildUserPrompt(date, category, formatAnglePrompt) {
  const { name, whatsapp } = getBrandConfig();
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Cairo',
  });

  return `Publish date: ${dateStr}
Post type: ${category.promptTopic} — ${category.promptDesc}
Style angle: ${formatAnglePrompt}

Write a NEW Facebook post for ${name} (fiberglass planters) — not a copy of the examples, fresh topic.

Requirements:
- 80–150 words in Egyptian Arabic
- Start with an attention hook (question or emotional line)
- Mention: custom made-to-order, colors/sizes, or doorstep delivery (based on post type)
- End with CTA + WhatsApp ${whatsapp}
- 4–5 Arabic hashtags
- Short lines with emojis
- Return ONLY the post text in Egyptian Arabic, no explanation or markdown`;
}

function getApiKey() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment variables');
  }
  return apiKey;
}

function getEndpointBase() {
  return (process.env.ANTHROPIC_ENDPOINT || 'https://agentrouter.org/v1').replace(/\/$/, '');
}

function getModel() {
  return process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
}

function isAgentRouter(baseUrl) {
  return baseUrl.includes('agentrouter.org');
}

function getAgentRouterHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    'User-Agent': 'claude-cli/1.0.108 (external, cli)',
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'claude-code-20250219,output-128k-2025-02-19',
    'anthropic-dangerous-direct-browser-access': 'true',
    'x-app': 'cli',
    'x-stainless-lang': 'js',
    'x-stainless-package-version': '1.0.0',
    'x-stainless-os': process.platform === 'win32' ? 'Windows' : 'Linux',
    'x-stainless-arch': process.arch,
    'x-stainless-runtime': 'node',
    'x-stainless-runtime-version': process.version,
  };
}

function formatApiError(error) {
  const data = error.response?.data;
  if (data) {
    return JSON.stringify(data);
  }
  return error.message;
}

function unauthorizedHint(data) {
  const message = data?.error?.message || data?.message || '';
  if (
    /unauthorized/i.test(message) ||
    data?.type === 'unauthorized_client_error' ||
    data?.message === 'UNAUTHENTICATED'
  ) {
    return (
      ' AgentRouter rejected the API key. Generate a new key at https://agentrouter.org/console/token'
    );
  }
  if (data?.error?.code === 'content-blocked') {
    return ' AgentRouter content filter blocked the request.';
  }
  return '';
}

function extractPostText(data) {
  if (!data) return null;

  if (Array.isArray(data.content)) {
    const text = data.content
      .filter((block) => block.type === 'text' && block.text)
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (text) return text;
  }

  const choice = data.choices?.[0];
  const message = choice?.message;

  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message?.content)) {
    const text = message.content
      .filter((part) => part?.text)
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
    if (text) return text;
  }

  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text.trim();
  }

  return null;
}

function isWafBlocked(data) {
  if (typeof data !== 'string') return false;
  const lower = data.toLowerCase();
  return lower.includes('<!doctype') || lower.includes('aliyun_waf');
}

function assertValidApiResponse(data) {
  if (isWafBlocked(data)) {
    throw new Error('WAF_BLOCKED: API gateway blocked this server IP (use template fallback)');
  }
  if (typeof data === 'string') {
    throw new Error(`API returned non-JSON response: ${data.slice(0, 120)}`);
  }
}

function buildEmptyResponseError(data) {
  if (isWafBlocked(data)) {
    return new Error('WAF_BLOCKED: API gateway blocked this server IP (use template fallback)');
  }
  const finishReason = data?.choices?.[0]?.finish_reason;
  const stopReason = data?.stop_reason;
  const hint = finishReason || stopReason || 'unknown';
  return new Error(
    `API returned empty post text (finish: ${hint}). Response: ${JSON.stringify(data).slice(0, 300)}`
  );
}

async function callViaAnthropicMessages(date, category, formatAnglePrompt) {
  const apiKey = getApiKey();
  const baseUrl = getEndpointBase();
  const model = getModel();
  const url = `${baseUrl}/messages`;
  const headers = isAgentRouter(baseUrl)
    ? getAgentRouterHeaders(apiKey)
    : {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01',
      };

  const response = await axios.post(
    url,
    {
      model,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      messages: [
        {
          role: 'user',
          content: buildUserPrompt(date, category, formatAnglePrompt),
        },
      ],
    },
    {
      headers,
      timeout: 90000,
      transformResponse: [(body) => body],
      responseType: 'text',
    }
  );

  let data;
  try {
    data = JSON.parse(response.data);
  } catch {
    assertValidApiResponse(response.data);
    throw new Error('Invalid JSON from messages API');
  }

  assertValidApiResponse(data);

  const postText = extractPostText(data);
  if (!postText) {
    throw buildEmptyResponseError(data);
  }

  return postText;
}

async function callViaChatCompletions(date, category, formatAnglePrompt) {
  const apiKey = getApiKey();
  const baseUrl = getEndpointBase();
  const model = getModel();
  const url = `${baseUrl}/chat/completions`;

  const response = await axios.post(
    url,
    {
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(date, category, formatAnglePrompt) },
      ],
    },
    {
      headers: getAgentRouterHeaders(apiKey),
      timeout: 90000,
      transformResponse: [(body) => body],
      responseType: 'text',
    }
  );

  let data;
  try {
    data = JSON.parse(response.data);
  } catch {
    assertValidApiResponse(response.data);
    throw new Error('Invalid JSON from chat completions API');
  }

  assertValidApiResponse(data);

  const postText = extractPostText(data);
  if (!postText) {
    throw buildEmptyResponseError(data);
  }

  return postText;
}

async function callClaude(date, category, formatAnglePrompt) {
  const baseUrl = getEndpointBase();

  if (isAgentRouter(baseUrl)) {
    try {
      return await callViaAnthropicMessages(date, category, formatAnglePrompt);
    } catch (messagesError) {
      try {
        return await callViaChatCompletions(date, category, formatAnglePrompt);
      } catch (chatError) {
        messagesError.suppressedError = chatError.message;
        throw messagesError;
      }
    }
  }

  return callViaAnthropicMessages(date, category, formatAnglePrompt);
}

function shouldFallbackToTemplate(error) {
  const msg = error?.message || '';
  return (
    msg.includes('WAF_BLOCKED') ||
    msg.includes('content-blocked') ||
    msg.includes('empty post text') ||
    msg.includes('non-JSON') ||
    msg.includes('unauthorized client')
  );
}

/**
 * Generate Facebook post content via Claude. Retries once on failure.
 * On GitHub Actions (or API block), uses built-in Arabic templates.
 */
export async function generatePost(date, category, formatAnglePrompt, log = console.log) {
  if (shouldUseTemplateOnly()) {
    const post = generateFromTemplate(category, date);
    log(`[${timestamp()}] Using template post (GitHub Actions — API blocked from cloud servers)`);
    log(`[${timestamp()}] Content generated successfully (${post.length} chars)`);
    return post;
  }

  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) {
        log(`[${timestamp()}] Retrying Claude generation (attempt ${attempt}/2)...`);
      }
      const post = await callClaude(date, category, formatAnglePrompt);
      log(`[${timestamp()}] Content generated successfully (${post.length} chars)`);
      return post;
    } catch (error) {
      lastError = error;
      const detail = formatApiError(error);
      const hint = unauthorizedHint(error.response?.data);
      log(`[${timestamp()}] Claude generation failed (attempt ${attempt}/2): ${error.message}${detail !== error.message ? ` | ${detail}` : ''}${hint}`);

      if (shouldFallbackToTemplate(error)) {
        const post = generateFromTemplate(category, date);
        log(`[${timestamp()}] Falling back to template post (${post.length} chars)`);
        return post;
      }
    }
  }

  const post = generateFromTemplate(category, date);
  log(`[${timestamp()}] Falling back to template post after API failure (${post.length} chars)`);
  return post;
}

function timestamp() {
  return new Date().toISOString();
}
