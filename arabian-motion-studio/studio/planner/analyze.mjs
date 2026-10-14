// Arabic idea analysis: what is being sold, for which occasion, what offer/features/tone were stated.
// Pure functions, no network. Matching runs on normalised text (no tashkeel, ة→ه, ى→ي, hamza forms merged).

export const norm = (s) => String(s || '')
  .replace(/[ً-ٰٟـ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .toLowerCase();

export const PRODUCTS = {
  memory_book: { re: /كتاب (ال)?(ذكري|ذكر)|كتب (ال)?ذكري|كتاب (ال)?(صور|مناسب|زفاف|تخرج|رحل)|كتاب ذكريات/, ar: 'كتاب ذكريات', icon: 'book-heart' },
  album: { re: /البوم|ألبوم|البومات/, ar: 'ألبوم صور', icon: 'images' },
  photo_print: { re: /طباع[ه]? (ال)?صور|صور (ال)?مطبوع|تحميض|اطبع|طباعه/, ar: 'طباعة الصور', icon: 'printer' },
  e_invite: { re: /دعو\S*(\s+\S+){0,2}\s+(ال)?كتروني|موقع (ال)?دعو|رابط (ال)?دعو|دعو\S*(\s+\S+){0,2}\s+رقمي/, ar: 'دعوة إلكترونية', icon: 'globe' },
  invitation: { re: /دعوه|دعوات|كرت دعو|بطاق[ه]? دعو|بطاقات/, ar: 'دعوات المناسبات', icon: 'mails' },
  gift: { re: /هدي[ه]|هدايا|اهداء/, ar: 'هدية', icon: 'gift' },
};

export const OCCASIONS = {
  wedding: { re: /زفاف|عرس|عروس|عريس|زواج|ملكه|خطوبه|فرح(?!ان)/, label: 'الزفاف', cap: 'ليلة العمر', moment: 'لقطة من ليلة الزفاف', momentEn: 'a candid moment from a wedding night', icon: 'gem' },
  graduation: { re: /تخرج|خريج|خريجه|تخرجي/, label: 'التخرج', cap: 'يوم التخرج', moment: 'لقطة من حفل التخرج', momentEn: 'a graduation day moment', icon: 'graduation-cap' },
  baby: { re: /مولود|طفل|اطفال|مواليد|حمل|بيبي|رضيع|اولادي|طفلي/, label: 'المولود', cap: 'أول أيامه', moment: 'لقطة لطفل صغير', momentEn: 'a tender moment with a baby', icon: 'baby' },
  birthday: { re: /عيد ميلاد|ميلاد|سنه حلوه|شمع/, label: 'عيد الميلاد', cap: 'عام جديد', moment: 'لقطة من عيد ميلاد', momentEn: 'a birthday celebration moment', icon: 'cake' },
  anniversary: { re: /ذكري سنويه|سنويه|سنوات (من )?(ال)?زواج|سنوات حب|ذكري زواج/, label: 'الذكرى السنوية', cap: 'سنوات من الحب', moment: 'لقطة لزوجين', momentEn: 'a warm moment between a couple', icon: 'heart-handshake' },
  mothers_day: { re: /عيد الام|يوم الام|للام|لامي|(^|\s)امي(\s|$)|ماما|والدتي|لوالدتي/, label: 'الأم', cap: 'إلى أمي', moment: 'لقطة مع الأم', momentEn: 'a warm moment with a mother', icon: 'flower' },
  fathers_day: { re: /عيد الاب|يوم الاب|للاب|لابي|بابا|والدي/, label: 'الأب', cap: 'إلى أبي', moment: 'لقطة مع الأب', momentEn: 'a warm moment with a father', icon: 'user-round' },
  travel: { re: /رحل[ه]|سفر|سياح|مسافر|مدينه|وجه[ه]/, label: 'الرحلة', cap: 'رحلتنا', moment: 'لقطة من رحلة', momentEn: 'a travel memory', icon: 'plane' },
  ramadan: { re: /رمضان|افطار|سحور/, label: 'رمضان', cap: 'ليالي رمضان', moment: 'لقطة من لمّة رمضان', momentEn: 'a family iftar gathering', icon: 'moon' },
  eid: { re: /عيد الفطر|عيد الاضحي|العيد|عيديه/, label: 'العيد', cap: 'لمّة العيد', moment: 'لقطة من لمّة العيد', momentEn: 'an Eid family gathering', icon: 'party-popper' },
  family: { re: /عائل[ه]|العائله|اسرت|اسره|اهل/, label: 'العائلة', cap: 'عائلتنا', moment: 'لقطة عائلية', momentEn: 'a family portrait moment', icon: 'users' },
  friends: { re: /صديقات|اصدقاء|صحب[ه]|شل[ه]|رفقه|بنات/, label: 'الأصدقاء', cap: 'صحبة حلوة', moment: 'لقطة مع الأصدقاء', momentEn: 'friends laughing together', icon: 'smile' },
  love: { re: /حبيب|زوجي|زوجتي|حبي|قصه حب/, label: 'الحب', cap: 'قصتنا', moment: 'لقطة رومانسية', momentEn: 'a romantic moment', icon: 'heart' },
};

export const FEATURES = {
  custom: { re: /تصميم خاص|مخصص|تفصيل|حسب الطلب|بتصميمك|خاص بك|تصميم يناسب/ },
  quality: { re: /جود[ه]|فاخر|راقي|ورق|طباعه عاليه|الوان نابض|دقه/ },
  delivery: { re: /توصيل|شحن|يوصل|نوصل/ },
  fast: { re: /سريع|خلال \d+|يومين|اسبوع|جاهز في/ },
  packaging: { re: /تغليف|علبه|هدي[ه] جاهز|شريط/ },
  cover: { re: /غلاف|جلد|قماش|ساتان|مخمل/ },
  qr: { re: /qr|كيو ?ار|باركود|كود|فيديو داخل|مقاطع فيديو/ },
  pages: { re: /صفحات|عدد الصفحات|٢٠ صفحه|\d+ صفح/ },
};

const TONES = {
  emotional: /ذكري|حنين|لحظ|قلب|دفء|دفئ|حب|اشتياق|يبقي|يخلد|تخلد|عمر|ايام|طفول|غال/,
  celebratory: /فرح|مبروك|احتفال|حفل|مناسب|زفاف|تخرج|عيد|بهج/,
  elegant: /فاخر|راقي|انيق|اناق|اخيل|فخم|ساتان|مخمل|لكجري/,
  urgent: /عرض|خصم|لفتر[ه] محدود|ينتهي|اخر موعد|الان|سارع|حتي|بس /,
};

const CTA = [
  ['link', /رابط|البايو|بايو|bio|الموقع|اطلب من الموقع/],
  ['whatsapp', /واتس|whatsapp|واتساب/],
  ['dm', /خاص|رسال[ه]|راسل|دايركت|dm/],
  ['book', /احجز|حجز|موعد/],
  ['order', /اطلب|اطلبي|اشتر|اشتري/],
];

const STOP = new Set('في من على الى الي عن مع او ثم قد لا ما هو هي هذا هذه ذلك تلك كل بين حتى حتي اذا لو ان انا انت نحن كان تكون يكون الذي التي لكن بعد قبل عند فقط جدا يا ال و ب ل ك'.split(' '));

function numbers(n) {
  const out = {};
  let m;
  if ((m = n.match(/خصم\s*(\d{1,3})\s*%?|(\d{1,3})\s*%\s*(خصم)?/))) out.discount = Number(m[1] || m[2]);
  if ((m = n.match(/(\d{1,5})\s*(ريال|ر\.?س|درهم|دينار|جنيه|دولار|sar|aed|kwd)/))) out.price = { value: Number(m[1]), currency: ({ 'ر.س': 'ريال', 'رس': 'ريال', sar: 'ريال', aed: 'درهم', kwd: 'دينار' })[m[2]] || m[2] };
  if ((m = n.match(/(?:خلال|في)\s*(\d{1,2})\s*(ايام|يوم|اسبوع|ساعه)/))) out.days = { value: Number(m[1]), unit: m[2] };
  if ((m = n.match(/(\d{1,3})\s*صفح/))) out.pages = Number(m[1]);
  return out;
}

export function analyzeIdea(ideaRaw, { kind = 'reel' } = {}) {
  const idea = String(ideaRaw || '').trim();
  const n = norm(idea);

  // product: strongest/first mention wins; invitation vs e_invite resolved by specificity order of PRODUCTS
  const prods = [];
  for (const [k, v] of Object.entries(PRODUCTS)) { const m = n.match(v.re); if (m) prods.push({ k, at: m.index }); }
  prods.sort((a, b) => a.at - b.at);
  let product = prods.find((p) => p.k === 'e_invite')?.k || prods[0]?.k || null;
  if (product === 'gift' && prods.length > 1) product = prods.find((p) => p.k !== 'gift').k; // "هدية" is a framing, not the product
  const giftFraming = prods.some((p) => p.k === 'gift');

  const occasions = [];
  for (const [k, v] of Object.entries(OCCASIONS)) { const m = n.match(v.re); if (m) occasions.push({ k, at: m.index }); }
  occasions.sort((a, b) => a.at - b.at);
  const occasion = occasions[0]?.k || null;

  const features = Object.entries(FEATURES).filter(([, v]) => v.re.test(n)).map(([k]) => k);
  const nums = numbers(n);
  if (nums.days && !features.includes('fast')) features.push('fast');
  if (nums.pages && !features.includes('pages')) features.push('pages');

  const score = Object.fromEntries(Object.entries(TONES).map(([k, re]) => [k, (n.match(new RegExp(re.source, 'g')) || []).length]));
  if (nums.discount || nums.price) score.urgent += 2;
  const tone = Object.entries(score).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(score).sort((a, b) => b[1] - a[1])[0][0] : 'emotional';

  // CTA: look at what follows an ordering/contact verb first ("اطلبي من واتساب"), ignoring quoted slogans
  const nq = n.replace(/[«"“][^»"”]*[»"”]/g, ' ');
  let ctaKind = 'generic';
  const direct = nq.match(/(?:اطلب\S*|احجز\S*|تواصل\S*|راسل\S*|كلم\S*)\s+(?:معنا\s+)?(?:من|عبر|علي|في|ب)?\s*(\S+)/);
  if (direct) {
    const w = direct[1];
    if (/واتس|whatsapp/.test(w)) ctaKind = 'whatsapp';
    else if (/رابط|بايو|bio|موقع|الموقع/.test(w)) ctaKind = 'link';
    else if (/الخاص|خاص|رساله|دايركت|dm/.test(w)) ctaKind = 'dm';
  }
  if (ctaKind === 'generic') for (const [k, re] of CTA) if (re.test(nq)) { ctaKind = k; break; }

  const quoted = [...idea.matchAll(/[«"“]([^»"”]{4,80})[»"”]/g)].map((m) => m[1].trim());
  const clauses = idea.split(/[\n.!؟?،,؛;]+/).map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2 && s.length <= 70);
  const keywords = [...new Set(n.split(/[^؀-ۿa-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)))].slice(0, 12);

  const female = /(اطلبي|احجزي|ابدئي|اجمعي|احفظي|صوري|تواصلي)\b/.test(n) ? true : /(اطلب|احجز|ابدا|اجمع|احفظ|تواصل)\b/.test(n) ? false : null;
  const deadline = /لفتر[ه] محدود|ينتهي|اخر موعد|حتي نهايه|حتي \d+/.test(n);

  return { idea, kind, product: product || 'memory_book', productDetected: !!product, giftFraming, occasion, occasions: occasions.map((o) => o.k), features, offer: { discount: nums.discount || null, price: nums.price || null, days: nums.days || null, deadline }, pages: nums.pages || null, tone, toneScores: score, ctaKind, quoted, clauses, keywords, femaleAddress: female };
}

export function summarizeAnalysis(a) {
  const P = PRODUCTS[a.product], O = a.occasion && OCCASIONS[a.occasion];
  const bits = [];
  bits.push({ k: 'المنتج', v: P.ar + (a.productDetected ? '' : ' (افتراضي)') });
  if (O) bits.push({ k: 'المناسبة', v: O.label });
  bits.push({ k: 'النبرة', v: { emotional: 'عاطفية', celebratory: 'احتفالية', elegant: 'أنيقة', urgent: 'عرض/استعجال' }[a.tone] });
  if (a.features.length) bits.push({ k: 'مزايا مذكورة', v: a.features.map((f) => ({ custom: 'تصميم خاص', quality: 'جودة', delivery: 'توصيل', fast: 'سرعة', packaging: 'تغليف', cover: 'غلاف', qr: 'كود', pages: 'صفحات' })[f]).join('، ') });
  if (a.offer.discount) bits.push({ k: 'خصم', v: a.offer.discount + '%' });
  if (a.offer.price) bits.push({ k: 'سعر', v: `${a.offer.price.value} ${a.offer.price.currency}` });
  if (a.quoted.length) bits.push({ k: 'عبارات من نصك', v: a.quoted.join(' | ') });
  return bits;
}
