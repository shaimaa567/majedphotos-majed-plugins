// Ms. Memories brand kit + starter templates.
// Templates return plain project.json specs for the existing engine (no separate format).

export const BRAND = {
  id: 'ms-memories',
  nameLatin: 'Ms. Memories',
  nameAr: 'مس ذكريات',
  tagline: 'كتب ذكريات · طباعة صور · دعوات مناسبات · دعوات إلكترونية',
  themes: {
    milk: { label: 'أبيض حليبي', bg: '#FBF4EC', ink: '#3A0A14', accent: '#C8102E', accent2: '#F6CFD2', muted: '#8A5A60' },
    wine: { label: 'أحمر عميق', bg: '#4A0B16', ink: '#FBF4EC', accent: '#FF5A70', accent2: '#7A1426', muted: '#E5B9BD' },
  },
  fonts: { display: 'Noto Kufi Arabic', body: 'Tajawal', script: 'Aref Ruqaa', serif: 'El Messiri' },
  satin: { dark: '#6E0A18', base: '#C8102E', light: '#F2475F' },
};

export const KINDS = {
  reel: { label: 'Reel', desc: 'ريل عمودي 9:16 سريع الإيقاع', ready: true },
  product: { label: 'إعلان منتج', desc: 'إعلان 9:16 لمنتج أو خدمة', ready: true },
  intro: { label: 'فيديو تعريفي', desc: 'تعريف بالبراند وخدماته', ready: true },
  post: { label: 'منشور', desc: 'تصميم ثابت (المرحلة 4)', ready: false },
  design: { label: 'تصميم تسويقي', desc: 'تصميم ثابت (المرحلة 4)', ready: false },
};

const T = (text, y, o = {}) => ({ type: 'text', text, x: 90, y, w: 900, size: 92, align: 'center', stagger: 0.14, ...o });
const SUB = (text, y, o = {}) => ({ type: 'text', text, font: 'body', weight: 500, x: 110, y, w: 860, size: 52, align: 'center', color: 'muted', reveal: 'block', in: 'rise', ...o });
const BADGE = (name, x, y, o = {}) => ({ type: 'icon', name, size: 140, x, y, badge: true, in: 'draw', dur: 0.9, ...o });

function reel() {
  return [
    { id: 's1', title: 'الافتتاح', duration: 4.2, layers: [
      { type: 'art', style: 'lattice', seed: 11 },
      { type: 'rays', cx: 540, cy: 150, count: 16, color: 'accent', opacity: 0.3, speed: 3, at: 0, dur: 1.2 },
      { type: 'sparkles', seed: 5, count: 13, region: { x: 70, y: 250, w: 940, h: 1150 }, at: 0.9 },
      { type: 'polaroid', x: 210, y: 300, w: 660, rot: -5, caption: 'ذكرى لا تُنسى', at: 0.3 },
      { type: 'ribbon', shape: 'sweep', y: 1560, width: 60, at: 1.2, dur: 1.1 },
      T('لحظاتك الحلوة *تستحق* أن تُحفظ', 1130, { size: 84, at: 1.3 }),
    ] },
    { id: 's2', title: 'كتاب الذكريات', duration: 4.0, transitionIn: { type: 'wipe', dur: 0.55 }, layers: [
      { type: 'art', style: 'frames', seed: 4 },
      BADGE('book-open', 470, 420, { at: 0.3 }),
      T('حوّلي ذكرياتك إلى *كتاب* مطبوع', 740, { size: 96, at: 0.8 }),
      SUB('بغلاف أنيق وصفحات تدوم', 1210, { at: 2.0 }),
      { type: 'ribbon', shape: 'wave', y: 1540, width: 54, at: 1.4, dur: 1.0 },
    ] },
    { id: 's3', title: 'طباعة الصور', duration: 3.8, transitionIn: { type: 'bars', dur: 0.7 }, layers: [
      { type: 'art', style: 'rings', seed: 8 },
      { type: 'sparkles', seed: 21, count: 10, region: { x: 80, y: 260, w: 920, h: 1000 }, at: 0.6, colors: ['accent', 'accent2'] },
      BADGE('printer', 470, 420, { at: 0.3 }),
      T('طباعة صور بجودة *عالية*', 740, { size: 96, at: 0.8 }),
      SUB('ألوان نابضة تبقى كما التقطتِها', 1160, { at: 2.0 }),
    ] },
    { id: 's4', title: 'الدعوة للطلب', duration: 4.4, transitionIn: { type: 'slide', dur: 0.6 }, layers: [
      { type: 'fill', gradient: 'linear-gradient(165deg,#C8102E 0%,#8E0B20 100%)' },
      { type: 'rays', cx: 540, cy: 620, count: 20, color: '#FFFFFF', opacity: 0.28, speed: -4, at: 0 },
      { type: 'sparkles', seed: 33, count: 16, region: { x: 60, y: 240, w: 960, h: 1200 }, at: 0.5, colors: ['#FFFFFF', '#FBF4EC', '#F6CFD2'] },
      { type: 'bow', x: 405, y: 330, size: 280, color: '#FBF4EC', dark: '#E8CFC4', light: '#FFFFFF', at: 0.3 },
      T('Ms. Memories', 820, { size: 104, color: '#FBF4EC', font: 'display', at: 1.0 }),
      T('اطلبي كتاب ذكرياتك الآن', 1010, { size: 66, color: '#FBF4EC', weight: 500, font: 'body', at: 1.6, keyColor: '#FFFFFF', keyShadow: false }),
      SUB('رابط الطلب في البايو', 1150, { at: 2.4, color: '#F6CFD2' }),
    ] },
  ];
}

function product() {
  return [
    { id: 's1', title: 'الجذب', duration: 4.0, layers: [
      { type: 'art', style: 'frames', seed: 14 },
      { type: 'rays', cx: 540, cy: 1000, count: 18, color: 'accent', opacity: 0.22, speed: 2.5, at: 0 },
      { type: 'polaroid', x: 190, y: 300, w: 700, rot: 4, caption: 'اسم المنتج', at: 0.3 },
      { type: 'sparkles', seed: 9, count: 12, at: 1.0 },
      T('هدية تبقى *للأبد*', 1190, { size: 100, at: 1.2 }),
      SUB('كتاب ذكريات بتصميم خاص', 1380, { at: 2.0 }),
    ] },
    { id: 's2', title: 'المزايا', duration: 5.0, transitionIn: { type: 'wipe', dur: 0.55 }, layers: [
      { type: 'art', style: 'lattice', seed: 3 },
      T('لماذا *نحن*؟', 300, { size: 100, at: 0.2 }),
      BADGE('images', 820, 520, { size: 110, at: 0.8 }),
      T('صورك الحقيقية بجودة عالية', 520, { w: 640, x: 90, size: 60, at: 1.0, align: 'right', weight: 700 }),
      BADGE('book-heart', 820, 800, { size: 110, at: 1.6 }),
      T('تصميم يحكي قصتك', 800, { w: 640, x: 90, size: 60, at: 1.8, align: 'right', weight: 700 }),
      BADGE('truck', 820, 1080, { size: 110, at: 2.4 }),
      T('توصيل آمن لباب بيتك', 1080, { w: 640, x: 90, size: 60, at: 2.6, align: 'right', weight: 700 }),
    ] },
    { id: 's3', title: 'الطلب', duration: 4.0, transitionIn: { type: 'slide', dur: 0.6 }, layers: [
      { type: 'fill', gradient: 'linear-gradient(165deg,#C8102E 0%,#8E0B20 100%)' },
      { type: 'rays', cx: 540, cy: 700, count: 20, color: '#FFFFFF', opacity: 0.26, speed: 4 },
      { type: 'bow', x: 405, y: 360, size: 270, color: '#FBF4EC', dark: '#E8CFC4', light: '#FFFFFF', at: 0.3 },
      T('اطلبي الآن', 820, { size: 108, color: '#FBF4EC', at: 1.0 }),
      T('Ms. Memories', 1010, { size: 70, color: '#F6CFD2', font: 'body', weight: 800, at: 1.6 }),
    ] },
  ];
}

function intro() {
  return [
    { id: 's1', title: 'الشعار', duration: 4.0, layers: [
      { type: 'art', style: 'rings', seed: 17 },
      { type: 'rays', cx: 540, cy: 760, count: 22, color: 'accent', opacity: 0.2, speed: 2 },
      { type: 'sparkles', seed: 2, count: 14, at: 1.0 },
      { type: 'bow', x: 405, y: 360, size: 270, at: 0.2 },
      T('Ms. Memories', 800, { size: 110, font: 'display', at: 0.9, stagger: 0.25 }),
      SUB('مس ذكريات — نحفظ لحظاتك', 1000, { at: 1.9 }),
    ] },
    { id: 's2', title: 'الخدمات', duration: 5.2, transitionIn: { type: 'wipe', dur: 0.55 }, layers: [
      { type: 'art', style: 'lattice', seed: 7 },
      T('ماذا *نصنع*؟', 300, { size: 100, at: 0.2 }),
      BADGE('book-open', 820, 500, { size: 110, at: 0.7 }),
      T('كتب ذكريات وألبومات مطبوعة', 500, { w: 640, size: 58, align: 'right', weight: 700, at: 0.9 }),
      BADGE('printer', 820, 760, { size: 110, at: 1.4 }),
      T('طباعة الصور', 760, { w: 640, size: 58, align: 'right', weight: 700, at: 1.6 }),
      BADGE('mails', 820, 1020, { size: 110, at: 2.1 }),
      T('دعوات المناسبات', 1020, { w: 640, size: 58, align: 'right', weight: 700, at: 2.3 }),
      BADGE('globe', 820, 1280, { size: 110, at: 2.8 }),
      T('مواقع دعوات إلكترونية', 1280, { w: 640, size: 58, align: 'right', weight: 700, at: 3.0 }),
    ] },
    { id: 's3', title: 'الختام', duration: 3.8, transitionIn: { type: 'bars', dur: 0.7 }, layers: [
      { type: 'fill', gradient: 'linear-gradient(165deg,#C8102E 0%,#8E0B20 100%)' },
      { type: 'rays', cx: 540, cy: 760, count: 20, color: '#FFFFFF', opacity: 0.26, speed: -3 },
      { type: 'polaroid', x: 250, y: 330, w: 580, rot: -4, caption: 'ذكرياتك عندنا', at: 0.3 },
      T('تواصلي معنا', 1130, { size: 84, color: '#FBF4EC', at: 1.3 }),
    ] },
  ];
}

const MAKERS = { reel, product, intro };

export function buildProject({ name, title, kind = 'reel', theme = 'milk', idea = '' }) {
  const mk = MAKERS[kind];
  if (!mk) throw new Error('نوع غير مدعوم بعد: ' + kind);
  const palette = { ...BRAND.themes[theme] || BRAND.themes.milk };
  delete palette.label;
  const scenes = mk();
  return {
    name, fps: 30,
    meta: { title: title || name, kind, brand: BRAND.id, theme, idea, createdAt: new Date().toISOString() },
    palette,
    audio: { vo: null, music: null, sfx: [] },
    scenes,
  };
}
