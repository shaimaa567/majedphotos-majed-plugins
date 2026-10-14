// Optional wording planner powered by Claude (official SDK, structured output).
// It ONLY rewrites copy/narration; layout, timing, uniqueness and validation stay local & deterministic.
// Status: written against the SDK reference but NOT exercised against the live API in development
// (no key available) — only the request-building and response-validation paths are unit-tested with a stub client.
import { z } from 'zod';
import { plain } from './copy.mjs';

export const MODEL = () => process.env.MM_PLANNER_MODEL || 'claude-opus-5-5';
export const llmStatus = () => ({ configured: !!process.env.ANTHROPIC_API_KEY, model: MODEL(), tested: false });

export const BriefSchema = z.object({
  beats: z.array(z.object({
    role: z.string(),
    headline: z.string(),
    sub: z.string().nullable(),
    items: z.array(z.string()).nullable(),
    narration: z.string(),
  })),
});

const SYSTEM = `أنت كاتب إعلانات عربي لعلامة Ms. Memories (كتب ذكريات مطبوعة، ألبومات، طباعة صور، دعوات مناسبات، دعوات إلكترونية). الهوية: أحمر عميق وأبيض حليبي، شريط ساتان، إطارات Polaroid، أسلوب عاطفي وأنيق.
اكتب نصوص مشاهد فيديو قصير عمودي بالعربية الفصحى المبسّطة المحببة للجمهور الخليجي.
القواعد:
- لكل مشهد دور (role) محدد ويجب أن تعيد المشاهد بنفس الترتيب والأدوار.
- العنوان (headline) قصير: حتى 8 كلمات. ضع الكلمة المفتاحية بين نجمتين مثل *ذكرياتك*، كلمة أو كلمتان فقط.
- sub سطر داعم قصير (أو null). items مطلوبة لأدوار steps وservices وoccasion (3 إلى 4 عناصر قصيرة) وإلا null.
- narration جملة أو جملتان للتعليق الصوتي بنفس معنى المشهد.
- خاطب المستخدم بصيغة {ADDRESS}.
- لا تخترع أسعارًا أو خصومات أو مزايا لم تُذكر في الفكرة.
- لا تستخدم الإيموجي ولا الهاشتاقات.`;

export function buildPrompt({ idea, analysis, roles, address }) {
  return {
    system: SYSTEM.replace('{ADDRESS}', address === 'm' ? 'المذكر' : 'المؤنث'),
    user: `فكرة الإعلان:\n${idea}\n\nتحليل أولي: المنتج=${analysis.product}، المناسبة=${analysis.occasion || 'غير محددة'}، النبرة=${analysis.tone}${analysis.offer?.discount ? `، خصم ${analysis.offer.discount}%` : ''}${analysis.offer?.price ? `، سعر ${analysis.offer.price.value} ${analysis.offer.price.currency}` : ''}.\n\nالمشاهد المطلوبة بالترتيب (role): ${roles.join('، ')}\nأعد ${roles.length} مشهدًا بالضبط.`,
  };
}

export function validateBrief(brief, roles) {
  const errs = [];
  if (!brief || !Array.isArray(brief.beats)) return ['لا توجد مشاهد'];
  if (brief.beats.length !== roles.length) errs.push(`عدد المشاهد ${brief.beats.length} بدل ${roles.length}`);
  brief.beats.forEach((b, i) => {
    if (b.role !== roles[i]) errs.push(`المشهد ${i + 1}: الدور ${b.role} بدل ${roles[i]}`);
    if (!/[؀-ۿ]/.test(b.headline || '') && !/[A-Za-z]/.test(b.headline || '')) errs.push(`المشهد ${i + 1}: عنوان بلا نص`);
    if (plain(b.headline).split(/\s+/).length > 12) errs.push(`المشهد ${i + 1}: عنوان طويل`);
    if (['steps', 'services', 'occasion'].includes(roles[i]) && !(b.items && b.items.length >= 2)) errs.push(`المشهد ${i + 1}: عناصر ناقصة`);
  });
  const seen = new Set();
  brief.beats.forEach((b, i) => {
    for (const t of [b.headline, b.sub].filter(Boolean)) { const k = plain(t).trim(); if (seen.has(k)) errs.push(`المشهد ${i + 1}: نص مكرر «${k}»`); seen.add(k); }
  });
  return errs;
}

// client is injectable for tests; production uses the official SDK client (credentials from the environment).
export async function llmBrief({ idea, analysis, roles, address = 'f', client = null }) {
  if (!client) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic();
  }
  const { zodOutputFormat } = await import('@anthropic-ai/sdk/helpers/zod');
  const { system, user } = buildPrompt({ idea, analysis, roles, address });
  const res = await client.messages.parse({
    model: MODEL(), max_tokens: 8000, system,
    output_config: { effort: 'low', format: zodOutputFormat(BriefSchema) },
    messages: [{ role: 'user', content: user }],
  });
  if (res.stop_reason === 'refusal') throw new Error('رفض النموذج الطلب (refusal)');
  if (!res.parsed_output) throw new Error('تعذّر تحليل رد النموذج');
  const errs = validateBrief(res.parsed_output, roles);
  if (errs.length) throw new Error('رد غير صالح: ' + errs.join('؛ '));
  return res.parsed_output;
}
