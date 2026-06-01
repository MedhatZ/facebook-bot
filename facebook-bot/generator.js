import axios from 'axios';

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
    product: process.env.PRODUCT_NAME || 'بوتات فايبر جلاس',
    whatsapp: process.env.WHATSAPP_NUMBER || '01226626676',
  };
}

function buildSystemPrompt() {
  const { name, product, whatsapp } = getBrandConfig();

  return `You are a Facebook marketing copywriter for "${name}" page.
Product: ${product} — modern home decor, made to order (custom color and size).
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

function buildUserPrompt(date, category, formatAngle) {
  const { name, product, whatsapp } = getBrandConfig();
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Africa/Cairo',
  });

  return `Publish date: ${dateStr}
Post type: ${category.name} — ${category.description}
Style angle: ${formatAngle}

Write a NEW Facebook post for ${name} (${product}) — not a copy of the examples, fresh topic.

Requirements:
- 80–150 words in Egyptian Arabic
- Start with an attention hook (question or emotional line)
- Mention: custom made-to-order, colors/sizes, or doorstep delivery (based on post type)
- End with CTA + WhatsApp ${whatsapp}
- 4–5 Arabic hashtags
- Short lines with emojis
- Return ONLY the post text in Egyptian Arabic, no explanation`;
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
    'x-stainless-os': process.platform === 'win32' ? 'Windows' : process.platform,
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
    errorIncludesUnauthorized(message) ||
    data?.type === 'unauthorized_client_error' ||
    data?.message === 'UNAUTHENTICATED'
  ) {
    return (
      ' AgentRouter rejected the API key. Generate a new key at https://agentrouter.org/console/token ' +
      'and ensure your account is active.'
    );
  }
  return '';
}

function errorIncludesUnauthorized(message) {
  return /unauthorized/i.test(message);
}

async function callViaChatCompletions(date, category, formatAngle) {
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
        { role: 'user', content: buildUserPrompt(date, category, formatAngle) },
      ],
    },
    {
      headers: getAgentRouterHeaders(apiKey),
      timeout: 60000,
    }
  );

  const postText = response.data?.choices?.[0]?.message?.content?.trim();
  if (!postText) {
    throw new Error('Chat completions API returned empty post text');
  }

  return postText;
}

async function callViaAnthropicMessages(date, category, formatAngle) {
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
          content: buildUserPrompt(date, category, formatAngle),
        },
      ],
    },
    {
      headers,
      timeout: 60000,
    }
  );

  const content = response.data?.content;
  if (!Array.isArray(content) || content.length === 0) {
    throw new Error('Anthropic messages API returned an empty or invalid response');
  }

  const textBlock = content.find((block) => block.type === 'text');
  const postText = (textBlock?.text || content[0]?.text || '').trim();

  if (!postText) {
    throw new Error('Anthropic messages API returned empty post text');
  }

  return postText;
}

async function callClaude(date, category, formatAngle) {
  const baseUrl = getEndpointBase();

  if (isAgentRouter(baseUrl)) {
    return callViaChatCompletions(date, category, formatAngle);
  }

  return callViaAnthropicMessages(date, category, formatAngle);
}

/**
 * Generate Facebook post content via Claude. Retries once on failure.
 */
export async function generatePost(date, category, formatAngle, log = console.log) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) {
        log(`[${timestamp()}] Retrying Claude generation (attempt ${attempt}/2)...`);
      }
      const post = await callClaude(date, category, formatAngle);
      log(`[${timestamp()}] Content generated successfully (${post.length} chars)`);
      return post;
    } catch (error) {
      lastError = error;
      const detail = formatApiError(error);
      const hint = unauthorizedHint(error.response?.data);
      log(`[${timestamp()}] Claude generation failed (attempt ${attempt}/2): ${detail}${hint}`);
    }
  }

  throw lastError;
}

function timestamp() {
  return new Date().toISOString();
}
