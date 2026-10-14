// Story structure + Arabic copy for each beat. Copy depends on the analysed idea (product, occasion,
// stated offer/features, address); wording variants are picked with a seeded RNG so "regenerate" gives
// genuinely different text. Gendered verbs use {مؤنث|مذكر}.
import { PRODUCTS, OCCASIONS } from './analyze.mjs';

export const ROLE_LABELS = { hook: 'الافتتاح', emotion: 'اللحظة', reveal: 'كشف المنتج', feature: 'ميزة', steps: 'الخطوات', services: 'الخدمات', occasion: 'المناسبات', about: 'من نحن', offer: 'العرض', cta: 'الدعوة للإجراء' };

export function rngFrom(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (n) => Math.floor(f() * n);
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.shuffle = (arr) => { const a2 = [...arr]; for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return f;
}
export const hashStr = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

export const gender = (s, addr) => s.replace(/\{([^}|]+)\|([^}]+)\}/g, (_, f, m) => (addr === 'm' ? m : f));
export const plain = (s) => String(s || '').replace(/\*/g, '');
export const keywordOf = (s) => (String(s || '').match(/\*([^*]+)\*/) || [])[1] || null;

const AR_NUM = { 2: 'يومين', 3: 'ثلاثة', 4: 'أربعة', 5: 'خمسة', 7: 'سبعة', 10: 'عشرة' };
const UNIT = { يوم: 'يوم', ايام: 'أيام', اسبوع: 'أسبوع', ساعه: 'ساعة' };

// ---------- phrase banks ----------
const HOOK_BY_PRODUCT = {
  memory_book: ['ذكرياتك الحلوة… تستحق *كتابًا*', 'كل صورة تحكي قصة… {اجمعيها|اجمعها} في *كتاب*', 'لا {تتركي|تترك} صورك *تضيع*', 'هل {تعرفين|تعرف} أين صورك *الآن*؟', 'صورك مكانها بين *يديك*… لا في الجوال'],
  album: ['ألبوم يحفظ *لحظاتك*', 'أجمل اللحظات… في ألبوم *يُلمس*', 'ألبومك… *قصتك* بالصور'],
  photo_print: ['صورة على الشاشة… وصورة *تُعلَّق*', '{اطبعي|اطبع} ذكرياتك… و*علّقيها*', 'صورك تستحق *إطارًا*'],
  invitation: ['دعوتك… أول *انطباع* عن مناسبتك', '{ابدئي|ابدأ} فرحك بدعوة *تليق*', 'دعوة تُشبه *مناسبتك*'],
  e_invite: ['دعوتك… برابط *واحد*', 'دعوة إلكترونية… *تُدهش* ضيوفك', 'من رابط… إلى *حضور*'],
  gift: ['هدية لا *تُنسى*… ذكرياتهم في كتاب', 'أجمل هدية… *ذكرى* تُلمس'],
};
const HOOK_BY_OCC = {
  wedding: ['ليلة العمر… تبقى *بين يديك*', 'زفافك: ألف لحظة… وكتاب *واحد*', 'الليلة التي لا تتكرر… {احفظيها|احفظها}'],
  graduation: ['تعب السنين… *يستحق* أن يُحفظ', 'يوم التخرج… *ذكرى* بغلاف أنيق', 'حلمك تحقق… {خلّديه|خلّده} في *كتاب*'],
  baby: ['أول ضحكة… أول خطوة… *كلها* هنا', 'كبروا بسرعة… والذكرى *تبقى*', 'أيام الطفولة… لا *تعود*'],
  birthday: ['عام جديد… وذكرى *جديدة*', 'كل شمعة… قصة *تُحكى*'],
  anniversary: ['سنوات من الحب… في *صفحات*', 'قصتكما… تستحق *كتابًا*'],
  mothers_day: ['هديتها هذا العام: *ذكرياتها* معك', 'أغلى هدية لأمي… *صورها* بين يديها'],
  fathers_day: ['إلى أبي… كتابٌ من *ذكرياتنا*', 'سنوات *عمره*… في كتاب'],
  travel: ['رحلتك لا تنتهي عند *الوصول*', 'كل مدينة… *صفحة* جديدة'],
  ramadan: ['ليالي رمضان… بدفء *الذكرى*', 'لمّة الإفطار… *تبقى* في كتاب'],
  eid: ['لمّة العيد… *تبقى* في كتاب', 'فرحة العيد… تستحق *أن تُحفظ*'],
  family: ['العائلة… أجمل *الصور* وأغلاها', 'ضحكاتنا… تستحق *غلافًا*'],
  friends: ['الصحبة الحلوة… *تبقى* صورًا', 'أجمل أيامنا… في *كتاب*'],
  love: ['قصة حبكما… بصفحات *حقيقية*', 'الحب… *يُحفظ* هكذا'],
};
const EMOTION_GENERIC = [
  ['الصور في الجوال… *تضيع* بين آلاف الصور', 'ونادرًا ما نعود إليها'],
  ['اللحظة تمرّ… والصورة *تبقى*', 'إن حفظناها كما تستحق'],
  ['الذكرى الحلوة {تحتاجين|تحتاج} مكانًا *يليق*', 'أكثر من شاشة وذاكرة ممتلئة'],
  ['ما لا يُطبع… *يُنسى*', 'والصور المطبوعة تعيش بيننا'],
];
const EMOTION_BY_OCC = {
  wedding: [['ضحكات الليلة… وهمسات *الأحبة*', 'تستحق أن تُلمس لا أن تُمرَّر بالإصبع'], ['الفرحة تمرّ سريعًا… والصور *تبقى*', 'فلا تتركيها تتبدد بين الملفات']],
  graduation: [['سنوات من السهر والتعب', 'تُختصر في لحظة… *فخلّديها*'], ['خطوة واحدة على المسرح… *وحلم* العمر', 'اجعلها ذكرى تُحمل']],
  baby: [['كل يوم… ملامح *جديدة*', 'لا تدعي الأيام تمرّ دون أثر'], ['أول لمسة… أول ابتسامة', 'أيام لا تُعاد… لكنها *تُحفظ*']],
  birthday: [['شمعة تُطفأ… وذكرى *تُشعل*', 'كل عام له قصة تستحق صفحة']],
  anniversary: [['سنوات تجمعكما… *ولحظات* لا تُحصى', 'اجمعيها في مكان واحد']],
  mothers_day: [['من يحفظ لنا كل التفاصيل؟', '*أمي*… وهي تستحق أن نحفظ لها لحظاتها']],
  fathers_day: [['رجلٌ صنع لنا ذكرياتنا', 'فلنصنع له *كتابًا* منها']],
  travel: [['المدن تُنسى… والصور *تُعيدك* إليها', 'رحلتك تستحق أكثر من ألبوم هاتف']],
  family: [['اللمّة الحلوة… لا تتكرر كل يوم', 'لكنها *تبقى* إن حفظناها']],
};
const REVEAL = {
  memory_book: [['من صورك… إلى *كتاب* تلمسينه', 'كتاب ذكريات بغلاف أنيق وصفحات تحكي قصتك'], ['كتاب *ذكرياتك*… جاهز للإهداء', 'بتصميم خاص وطباعة تليق بالذكرى'], ['*ذكرياتك* بين دفّتين', 'صور وكلمات في كتاب مطبوع بعناية']],
  album: [['ألبومك… *بلمستك*', 'صور مرتبة بتصميم يشبهك'], ['من الشاشة… إلى *ألبوم*', 'صفحات تُقلَّب ولحظات تُلمس']],
  photo_print: [['صورك… *مطبوعة* كما تستحق', 'ألوان نابضة وورق يدوم'], ['اطبعي *لحظاتك*', 'بمقاسات تناسب جدارك وألبومك']],
  invitation: [['دعوة *تليق* بمناسبتك', 'تصميم خاص بتفاصيل حفلك'], ['*بطاقتك* الأولى للضيوف', 'أنيقة… وتُشبه فرحتك']],
  e_invite: [['دعوتك… *رابط* واحد', 'صفحة أنيقة تصل ضيوفك بنقرة'], ['موقع *دعوة* بتصميمك', 'بدلًا من رسالة عابرة']],
  gift: [['هدية بنكهة *الذكرى*', 'كتاب ذكريات مغلّف بشريط ساتان أحمر']],
};
const FEATURE = {
  custom: [['تصميم *خاص* بقصتك', 'كل صفحة بتفاصيلك وألوانك'], ['صفحات تُصمَّم *لأجلك*', 'لا قالب جاهز… بل قصتك {أنتِ|أنت}']],
  quality: [['طباعة *فاخرة* تدوم', 'ألوان نابضة تبقى كما {التقطتِها|التقطتَها}'], ['جودة *تُرى* وتُلمس', 'ورق وطباعة تليقان بذكرى غالية']],
  delivery: [['توصيل إلى *باب بيتك*', 'مغلّف بعناية ليصلك كما صُنع']],
  fast: [['جاهز خلال *{n}*', 'نسرّع دون أن نتهاون في الجودة'], ['تجهيز *سريع*', 'لتصلك ذكراك في وقتها']],
  packaging: [['تغليف *هدية* جاهز', 'شريط ساتان أحمر… ولمسة تليق بالإهداء'], ['علبة *أنيقة* للإهداء', 'نغلّفها كما تستحق الذكرى']],
  cover: [['غلاف *أنيق* بلمسة ساتان', 'تشعرين بالجمال قبل أن تفتحيه']],
  qr: [['{امسحي|امسح} *الكود*… وتحيا الذكرى', 'اربطي الصفحة بفيديو أو رسالة']],
  pages: [['صفحات بعدد *ذكرياتك*', '{n} صفحة لقصتك']],
};
const FEATURE_DEFAULT = ['custom', 'quality', 'packaging', 'cover'];
const FEATURE_ICON = { custom: 'wand-sparkles', quality: 'sparkles', delivery: 'truck', fast: 'timer', packaging: 'package-open', cover: 'book-heart', qr: 'qr-code', pages: 'file-text' };

const STEPS = {
  memory_book: ['{اختاري|اختر} صورك', 'نصمّم صفحاتك', 'تصلك مطبوعة'],
  album: ['{اختاري|اختر} صورك', 'نرتّبها لك', 'تصلك في ألبوم'],
  photo_print: ['{اختاري|اختر} صورك', '{حدّدي|حدّد} المقاس', 'نطبعها لك'],
  invitation: ['{اختاري|اختر} التصميم', '{أرسلي|أرسل} التفاصيل', 'نجهّز دعوتك'],
  e_invite: ['{اختاري|اختر} القالب', '{أضيفي|أضف} التفاصيل', '{شاركي|شارك} الرابط'],
  gift: ['{اختاري|اختر} الصور', 'نصمّم الكتاب', 'يصل مغلّفًا'],
};
const STEP_ICONS = ['images', 'wand-sparkles', 'package-open'];
const STEP_HEAD = ['ثلاث خطوات *بسيطة*', 'من الفكرة إلى *يدك*', 'كيف *نبدأ*؟'];
const SERVICES = [['memory_book', 'كتب الذكريات والألبومات', 'book-heart'], ['photo_print', 'طباعة الصور', 'printer'], ['invitation', 'دعوات المناسبات', 'mails'], ['e_invite', 'دعوات إلكترونية', 'globe']];
const CTA_HEAD = { memory_book: ['{ابدئي|ابدأ} كتاب *ذكرياتك* اليوم', '{اطلبي|اطلب} كتاب *ذكرياتك* الآن'], album: ['{ابدئي|ابدأ} *ألبومك* اليوم', '{اطلبي|اطلب} *ألبومك* الآن'], photo_print: ['{اطبعي|اطبع} *صورك* الآن', '{ابدئي|ابدأ} بطباعة *ذكرياتك*'], invitation: ['{صمّمي|صمّم} *دعوتك* معنا', '{اطلبي|اطلب} *دعوتك* الآن'], e_invite: ['{أنشئي|أنشئ} *دعوتك* الإلكترونية', '{ابدئي|ابدأ} *دعوتك* اليوم'], gift: ['{اهدي|اهدِ} *ذكرى* لا تُنسى', '{اطلبي|اطلب} *هديتك* الآن'] };
const CTA_SUB = { link: 'رابط الطلب في البايو', whatsapp: '{تواصلي|تواصل} معنا عبر واتساب', dm: '{راسلينا|راسلنا} على الخاص', book: '{احجزي|احجز} موعدك الآن', order: 'الطلب متاح الآن', generic: '{تواصلي|تواصل} معنا الآن' };

// ---------- story ----------
export function buildStory(a, { kind = 'reel', seconds = 25 } = {}) {
  let n = Math.max(5, Math.min(8, Math.round(seconds / 3.8)));
  const hasOffer = !!(a.offer.discount || a.offer.price);
  const feats = featureKeys(a);
  let roles;
  if (kind === 'intro') {
    roles = ['hook', 'about', 'services', 'feature'];
    if (n >= 6) roles.push('feature');
    if (n >= 7) roles.push('steps');
    roles.push('cta');
  } else if (kind === 'product') {
    n = Math.max(5, n - 1);
    roles = ['hook', 'reveal'];
    const mid = n - 3 - (hasOffer ? 1 : 0);
    for (let i = 0; i < Math.max(1, mid - (n >= 7 ? 1 : 0)); i++) roles.push('feature');
    if (n >= 7) roles.push('steps');
    if (hasOffer) roles.push('offer');
    roles.push('cta');
  } else {
    roles = ['hook', 'emotion', 'reveal'];
    const mid = n - 4 - (hasOffer ? 1 : 0);
    const nf = Math.max(1, Math.min(mid, 3));
    for (let i = 0; i < nf; i++) roles.push('feature');
    let extra = mid - nf;
    if (extra > 0) { roles.push('steps'); extra--; }
    if (extra > 0 && !hasOffer) { roles.push('occasion'); extra--; }
    if (hasOffer) roles.push('offer');
    roles.push('cta');
  }
  return { roles, featureKeys: feats };
}
export function featureKeys(a) {
  const f = a.features.filter((k) => FEATURE[k]);
  return [...new Set([...f, ...FEATURE_DEFAULT])];
}

// ---------- beat writer ----------
const starIfMissing = (text) => {
  if (text.includes('*')) return text;
  const words = text.split(/\s+/); let best = 2, bi = -1;
  words.forEach((w, i) => { const c = w.replace(/[^\u0600-\u06FF]/g, ''); if (c.length > best) { best = c.length; bi = i; } });
  if (bi < 0) return text;
  const m = words[bi].match(/^(.*?)([.,،؟?!…]*)$/);
  words[bi] = `*${m[1]}*${m[2]}`;
  return words.join(' ');
};

function chooseFresh(options, used, rng) {
  const fresh = options.filter((o) => !used.has(plain(Array.isArray(o) ? o[0] : o)));
  return rng.pick(fresh.length ? fresh : options);
}

export function writeBeat(role, a, { rng, addr = 'f', used = new Set(), featureKey = null, stepIndex = 0 } = {}) {
  const P = PRODUCTS[a.product], O = a.occasion ? OCCASIONS[a.occasion] : null;
  const g = (s) => gender(s, addr);
  const out = { role, copy: {}, iconHint: null, slotKind: null, tone: a.tone };
  const finish = (headline, sub, extra = {}) => { out.copy = { headline: g(headline), sub: sub ? g(sub) : null, keyword: keywordOf(g(headline)), ...extra }; return out; };

  if (role === 'hook') {
    let opts;
    if (a.quoted.length) opts = [starIfMissing(a.quoted[0])];
    else if (O && HOOK_BY_OCC[a.occasion]) opts = rng() < 0.75 ? HOOK_BY_OCC[a.occasion] : [...HOOK_BY_OCC[a.occasion], ...(HOOK_BY_PRODUCT[a.product] || [])];
    else opts = HOOK_BY_PRODUCT[a.product] || HOOK_BY_PRODUCT.memory_book;
    const h = chooseFresh(opts, used, rng);
    out.iconHint = O ? O.icon : P.icon; out.slotKind = O ? 'moment' : 'cover';
    return finish(h, null, { caption: O ? O.cap : 'ذكرى لا تُنسى', question: /[؟?]\s*$/.test(plain(h)) });
  }
  if (role === 'emotion') {
    const pool = (O && EMOTION_BY_OCC[a.occasion]) ? [...EMOTION_BY_OCC[a.occasion], ...EMOTION_GENERIC.slice(0, 2)] : EMOTION_GENERIC;
    const [h, s] = chooseFresh(pool, used, rng);
    out.iconHint = 'heart'; out.slotKind = 'moment';
    return finish(h, s, { caption: O ? O.cap : 'لحظة' });
  }
  if (role === 'reveal') {
    const [h, s] = chooseFresh(REVEAL[a.product] || REVEAL.memory_book, used, rng);
    out.iconHint = P.icon; out.slotKind = a.product === 'invitation' || a.product === 'e_invite' ? 'invite' : a.product === 'photo_print' ? 'prints' : 'book';
    return finish(h, s);
  }
  if (role === 'feature') {
    const key = featureKey || 'custom';
    const [h0, s0] = chooseFresh(FEATURE[key], used, rng);
    const dn = a.offer.days ? `${a.offer.days.value} ${UNIT[a.offer.days.unit] || a.offer.days.unit}`.replace(/^1 /, '') : '';
    const sub = (s) => s.replace('{n}', a.pages || '');
    const h = h0.replace('{n}', dn || 'أيام قليلة');
    out.iconHint = FEATURE_ICON[key]; out.slotKind = key === 'cover' || key === 'packaging' ? 'gift' : key === 'quality' ? 'closeup' : 'moment'; out.featureKey = key;
    return finish(h, sub(s0));
  }
  if (role === 'steps') {
    const items = (STEPS[a.product] || STEPS.memory_book).map(g);
    const [h] = [chooseFresh(STEP_HEAD, used, rng)];
    out.iconHint = 'list-checks';
    return finish(h, null, { items, itemIcons: STEP_ICONS });
  }
  if (role === 'services') {
    const first = SERVICES.filter((s) => s[0] === a.product), rest = SERVICES.filter((s) => s[0] !== a.product);
    const list = [...first, ...rest];
    return finish(rng() < 0.5 ? 'ماذا *نصنع*؟' : 'كل ما {تحتاجينه|تحتاجه} لـ*ذكرياتك*', null, { items: list.map((s) => s[1]), itemIcons: list.map((s) => s[2]) });
  }
  if (role === 'occasion') {
    const base = ['الزفاف', 'التخرج', 'المولود', 'الذكرى السنوية'];
    return finish(chooseFresh([['لكل *مناسبة*… ذكرى'], ['في كل *مناسبة*… كتاب']], used, rng)[0], null, { items: base, itemIcons: ['gem', 'graduation-cap', 'baby', 'heart-handshake'] });
  }
  if (role === 'about') {
    return finish('نحفظ *لحظاتك*', 'نحوّل صورك وذكرياتك إلى كتب وألبومات ودعوات تُلمس');
  }
  if (role === 'offer') {
    const { discount, price, deadline } = a.offer;
    out.iconHint = 'badge-percent';
    if (discount) return finish(`خصم *${discount}%*`, deadline ? 'لفترة محدودة فقط' : `على ${P.ar}`, { number: `${discount}%`, pre: 'خصم', post: null });
    return finish(`ابتداءً من *${price.value} ${price.currency}*`, deadline ? 'لفترة محدودة فقط' : `${P.ar} بتصميم خاص`, { number: String(price.value), pre: 'ابتداءً من', post: price.currency });
  }
  if (role === 'cta') {
    const [h] = [chooseFresh((CTA_HEAD[a.product] || CTA_HEAD.memory_book).map((x) => [x]), used, rng)[0]];
    return finish(h, CTA_SUB[a.ctaKind] || CTA_SUB.generic, { brand: 'Ms. Memories' });
  }
  throw new Error('unknown role ' + role);
}

export function narrationOf(b) {
  const c = b.copy;
  const body = c.items ? c.items.join('، ') : c.sub;
  return [plain(c.headline), body].filter(Boolean).join('. ').replace(/\.\s*\./g, '.');
}
