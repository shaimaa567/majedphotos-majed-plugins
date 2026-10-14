// Ms. Memories Studio — UI. Talks to studio/server.mjs; previews with the SAME engine used for export.
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v; else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, ''); else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
async function api(path, opt = {}) {
  const r = await fetch(path, { method: opt.method || 'GET', headers: opt.headers || (opt.body ? { 'content-type': 'application/json' } : {}),
    body: opt.raw ? opt.raw : opt.body ? JSON.stringify(opt.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'خطأ ' + r.status);
  return j;
}
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), ms); }
function modal(content) { const m = $('#modal'); m.innerHTML = ''; const box = el('div', { class: 'box' }, content); m.append(box); m.hidden = false; m.onclick = (e) => { if (e.target === m) closeModal(); }; }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
const fmt = (s) => { s = Math.max(0, s); return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };

const ANIM_LABELS = { fade: 'ظهور تدريجي', rise: 'صعود', drop: 'نزول', slideR: 'انزلاق من اليمين', slideL: 'انزلاق من اليسار', scale: 'تكبير', pop: 'نبضة', wipe: 'مسح من اليمين', wipeUp: 'مسح من الأسفل', blur: 'ضبابي', draw: 'رسم الخط', settle: 'هبوط مائل', flip: 'دوران', none: 'بدون' };
const TRANS_LABELS = { none: 'بدون', wipe: 'قطع قطري', bars: 'قضبان', slide: 'انزلاق', fade: 'تلاشٍ' };
const TYPE_LABELS = { text: 'نص', icon: 'أيقونة', polaroid: 'Polaroid', image: 'صورة', video: 'فيديو', art: 'خلفية فنية', fill: 'لون', rays: 'أشعة', sparkles: 'لمسات سحرية', ribbon: 'شريط ساتان', bow: 'فيونكة', bgtext: 'نص خلفي', shape: 'شكل' };
const ART_LABELS = { lattice: 'معيّنات', frames: 'إطارات', rings: 'حلقات', shards: 'شظايا', lines: 'خطوط', bands: 'أشرطة', grid: 'شبكة' };
const FONT_LABELS = { display: 'كوفي (عناوين)', body: 'تجوال (نص)', script: 'رقعة (خط يدوي)', serif: 'المسيري (أنيق)' };
const TOKENS = [['ink', 'النص'], ['bg', 'الخلفية'], ['accent', 'الأحمر'], ['accent2', 'الوردي'], ['muted', 'الرمادي']];

// ============ state ============
let S = null; // editor state
const state = { brand: null };

// ============ routing ============
window.addEventListener('hashchange', route);
async function route() {
  stopPlay(); S = null;
  $('#topctl').innerHTML = '';
  const m = location.hash.match(/^#\/p\/([\w-]+)/);
  try { if (!state.brand) state.brand = await api('/api/brand'); } catch (e) { toast(e.message); }
  if (m) await openEditor(m[1]); else await renderHome();
}
route();

// ============ home ============
async function renderHome() {
  const app = $('#app'); app.innerHTML = '';
  const form = { title: '', idea: '', kind: 'reel', theme: 'milk' };
  const kinds = state.brand.kinds, themes = state.brand.brand.themes;
  const kindChips = el('div', { class: 'chips' });
  const themeChips = el('div', { class: 'chips' });
  const paint = () => {
    kindChips.innerHTML = ''; themeChips.innerHTML = '';
    for (const [k, v] of Object.entries(kinds)) kindChips.append(el('button', { class: 'chip' + (form.kind === k ? ' on' : ''), disabled: !v.ready, title: v.desc, onclick: () => { form.kind = k; paint(); } }, v.label, !v.ready ? el('small', {}, ' · قريبًا') : null));
    for (const [k, v] of Object.entries(themes)) themeChips.append(el('button', { class: 'chip' + (form.theme === k ? ' on' : ''), onclick: () => { form.theme = k; paint(); } }, v.label));
  };
  paint();
  const create = el('button', { class: 'btn red', onclick: async (e) => {
    e.target.disabled = true;
    try { const r = await api('/api/projects', { method: 'POST', body: form }); location.hash = '#/p/' + r.id; } catch (err) { toast(err.message); e.target.disabled = false; }
  } }, 'ابدأ المشروع');
  const left = el('div', { class: 'card' },
    el('h1', { html: 'ماذا نصنع اليوم؟' }),
    el('p', {}, 'اكتبي فكرة الفيديو واختاري النوع، وسنبدأ بقالب بهوية Ms. Memories تعدّلينه بصريًا.'),
    el('label', {}, 'فكرة الفيديو'), el('textarea', { placeholder: 'مثال: ريل عن كتاب ذكريات هدية لأم العروس…', oninput: (e) => { form.idea = e.target.value; } }),
    el('label', {}, 'اسم المشروع'), el('input', { type: 'text', placeholder: 'اسم يساعدك على إيجاده لاحقًا', oninput: (e) => { form.title = e.target.value; } }),
    el('label', {}, 'نوع العمل'), kindChips,
    el('label', {}, 'الألوان'), themeChips,
    el('div', { style: 'margin-top:18px' }, create));
  const list = el('div', { class: 'projects' });
  const right = el('div', {}, el('h2', { class: 'section-title' }, 'مشاريعي'), list);
  app.append(el('div', { class: 'home' }, el('div', { class: 'hero' }, left, right)));
  const projects = await api('/api/projects');
  if (!projects.length) list.append(el('div', { class: 'empty' }, 'لا مشاريع بعد. ابدئي أول مشروع من اليمين.'));
  for (const p of projects) {
    const card = el('div', { class: 'proj', role: 'button', tabindex: 0, onclick: () => { location.hash = '#/p/' + p.id; } },
      el('h3', {}, p.title), el('div', { class: 'meta' }, `${state.brand.kinds[p.kind]?.label || p.kind} · ${p.scenes} مشاهد${p.duration ? ' · ' + p.duration.toFixed(1) + 'ث' : ''}`),
      el('div', { class: 'meta' }, new Date(p.updated).toLocaleString('ar')),
      p.palette ? el('div', { class: 'sw' }, ['bg', 'accent', 'accent2', 'ink'].map((k) => el('i', { style: `background:${p.palette[k]}` }))) : null,
      p.id.startsWith('mm-') ? el('button', { class: 'ghost del', title: 'نقل إلى المهملات', onclick: async (e) => {
        e.stopPropagation();
        if (!confirm(`نقل «${p.title}» إلى المهملات؟`)) return;
        await api('/api/projects/' + p.id, { method: 'DELETE' }); renderHome();
      } }, '🗑') : null);
    list.append(card);
  }
}

// ============ editor ============
async function openEditor(id) {
  const data = await api('/api/projects/' + id).catch((e) => { toast(e.message); location.hash = '#/'; return null; });
  if (!data) return;
  S = { id, spec: data.spec, assets: data.assets, selScene: data.spec.scenes[0].id, selLayer: null, tab: 'scene', t: 0, total: 0, res: null,
    playing: false, hist: [], redo: [], lastKey: '', lastKeyT: 0, dirty: false, saving: false, seq: 0, issues: { errors: [], warns: [] }, scale: 0.3, job: null, previewErr: null };
  buildEditorDOM();
  renderAll();
  window.__S = S; // for tests/debug
  await S.loaded;
  await refreshPreview();
  seekPoster(S.selScene);
}

function buildEditorDOM() {
  const app = $('#app'); app.innerHTML = '';
  const top = $('#topctl');
  S.ui = {};
  S.ui.title = el('input', { type: 'text', value: S.spec.meta?.title || S.id, style: 'width:220px', oninput: (e) => { edit('title', () => { (S.spec.meta ||= {}).title = e.target.value; }); } });
  S.ui.save = el('small', { style: 'color:var(--muted);font-weight:700' }, 'محفوظ ✓');
  top.append(S.ui.title, S.ui.save,
    el('button', { class: 'ghost', title: 'تراجع (Ctrl+Z)', onclick: undo }, '↶'), el('button', { class: 'ghost', title: 'إعادة (Ctrl+Shift+Z)', onclick: redo }, '↷'),
    el('a', { class: 'btn sm', href: '#/' }, 'كل المشاريع'));
  S.ui.scenes = el('div', { class: 'scroll' });
  const scenesCol = el('div', { class: 'col' }, el('h4', {}, 'المشاهد', el('span', { class: 'sp' }), el('button', { class: 'btn sm', onclick: addScene }, '+ مشهد')), S.ui.scenes);

  S.ui.vp = el('div', { class: 'vp' });
  S.ui.frame = el('iframe', { src: '/engine/index.html', title: 'preview' });
  S.ui.sel = el('div', { id: 'selbox' });
  S.ui.ovl = el('div', { id: 'ovl' });
  S.ui.vp.append(S.ui.frame, S.ui.sel, S.ui.ovl);
  S.ui.phone = el('div', { class: 'phone' }, S.ui.vp);
  S.ui.wrap = el('div', { class: 'stagewrap' }, S.ui.phone);
  S.ui.tl = el('div', { class: 'tl' });
  S.ui.range = el('input', { type: 'range', min: 0, max: 1, step: 0.01, value: 0, oninput: (e) => { stopPlay(); seek(Number(e.target.value)); } });
  S.ui.tl.append(S.ui.range);
  S.ui.playBtn = el('button', { class: 'btn sm', onclick: togglePlay }, '▶ تشغيل');
  S.ui.time = el('span', { class: 'time' }, '0:00.0 / 0:00.0');
  S.ui.issues = el('div', { class: 'issues', hidden: true, onclick: () => S.ui.issues.classList.toggle('open') });
  S.ui.progress = el('i'); S.ui.jobtxt = el('small', {});
  S.ui.expbar = el('div', { class: 'exp' },
    el('button', { class: 'btn sm', onclick: () => startExport('preview') }, 'معاينة سريعة MP4'),
    el('button', { class: 'btn red sm', onclick: () => startExport('final') }, 'تصدير MP4 نهائي'),
    el('button', { class: 'btn sm', onclick: () => startExport('still') }, 'حفظ إطار PNG'),
    el('div', { class: 'bar', hidden: true }, S.ui.progress), S.ui.jobtxt);
  const transport = el('div', { class: 'transport' }, el('div', { class: 'tc' }, S.ui.playBtn, S.ui.time), S.ui.tl, S.ui.issues, S.ui.expbar);
  const stageCol = el('div', { class: 'col stage-col' }, S.ui.wrap, transport);

  S.ui.insp = el('div', { class: 'scroll' });
  S.ui.tabs = el('div', { class: 'tabs' },
    el('button', { class: 'tab', 'data-t': 'scene', onclick: () => { S.tab = 'scene'; renderInspector(); markTabs(); } }, 'المشهد والعناصر'),
    el('button', { class: 'tab', 'data-t': 'project', onclick: () => { S.tab = 'project'; renderInspector(); markTabs(); } }, 'المشروع والوسائط'));
  const inspCol = el('div', { class: 'col' }, S.ui.tabs, S.ui.insp);
  app.append(el('div', { class: 'editor' }, scenesCol, stageCol, inspCol));

  S.loaded = new Promise((res) => S.ui.frame.addEventListener('load', () => { S.frameReady = true; res(); }, { once: true }));
  new ResizeObserver(fitPhone).observe(S.ui.wrap);
  S.ui.ovl.addEventListener('pointerdown', onStagePointerDown);
  markTabs();
}
const markTabs = () => S.ui.tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === S.tab));

function fitPhone() {
  const r = S.ui.wrap.getBoundingClientRect();
  const availH = r.height - 44, availW = r.width - 44;
  const sc = Math.max(0.1, Math.min(availH / 1920, availW / 1080));
  S.scale = sc;
  S.ui.vp.style.width = 1080 * sc + 'px'; S.ui.vp.style.height = 1920 * sc + 'px';
  S.ui.frame.style.width = '1080px'; S.ui.frame.style.height = '1920px'; S.ui.frame.style.transform = `scale(${sc})`;
  updateSelBox();
}

// ---------- editing core ----------
const scene = (id = S.selScene) => S.spec.scenes.find((s) => s.id === id);
const layer = () => (S.selLayer != null ? scene()?.layers[S.selLayer] : null);

function snapshotIfNeeded(key) {
  const now = Date.now();
  if (key !== S.lastKey || now - S.lastKeyT > 900) { S.hist.push(JSON.stringify(S.spec)); if (S.hist.length > 120) S.hist.shift(); S.redo = []; }
  S.lastKey = key; S.lastKeyT = now;
}
function edit(key, mutate, { structural = false } = {}) {
  snapshotIfNeeded(key);
  mutate();
  changed();
  if (structural) renderAll(); else { renderScenes(); }
}
function changed() {
  S.dirty = true; S.ui.save.textContent = 'غير محفوظ…';
  clearTimeout(S.saveT); S.saveT = setTimeout(save, 700);
  clearTimeout(S.prevT); S.prevT = setTimeout(refreshPreview, 140);
}
async function save() {
  if (!S || S.saving) { if (S) { clearTimeout(S.saveT); S.saveT = setTimeout(save, 400); } return; }
  S.saving = true; S.ui.save.textContent = 'جارٍ الحفظ…';
  try { await api(`/api/projects/${S.id}/save`, { method: 'PUT', body: S.spec }); S.dirty = false; S.ui.save.textContent = 'محفوظ ✓'; }
  catch (e) { S.ui.save.textContent = 'تعذّر الحفظ'; toast(e.message); }
  S.saving = false;
  if (S.dirty) { clearTimeout(S.saveT); S.saveT = setTimeout(save, 300); }
}
async function flushSave() { clearTimeout(S.saveT); while (S.saving) await new Promise((r) => setTimeout(r, 50)); if (S.dirty) await save(); }
function undo() { if (!S?.hist.length) return; S.redo.push(JSON.stringify(S.spec)); S.spec = JSON.parse(S.hist.pop()); S.lastKey = ''; afterHistory(); }
function redo() { if (!S?.redo.length) return; S.hist.push(JSON.stringify(S.spec)); S.spec = JSON.parse(S.redo.pop()); S.lastKey = ''; afterHistory(); }
function afterHistory() {
  if (!scene()) S.selScene = S.spec.scenes[0].id;
  if (S.selLayer != null && !layer()) S.selLayer = null;
  S.ui.title.value = S.spec.meta?.title || S.id; changed(); renderAll();
}
document.addEventListener('keydown', (e) => {
  if (!S || e.target.matches('input,textarea,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  if (e.key === 'Delete' && S.selLayer != null) delLayer(S.selLayer);
});

// ---------- scenes ----------
function renderAll() { renderScenes(); renderInspector(); markTabs(); }
function renderScenes() {
  const box = S.ui.scenes; box.innerHTML = '';
  S.spec.scenes.forEach((sc, i) => {
    const rs = S.res?.scenes?.find((x) => x.id === sc.id);
    box.append(el('div', { class: 'scene-item' + (sc.id === S.selScene ? ' sel' : ''), 'data-id': sc.id, onclick: () => selectScene(sc.id) },
      el('span', { class: 'n' }, i + 1),
      el('div', { class: 't' }, el('b', {}, sc.title || 'مشهد ' + (i + 1)), el('small', {}, `${(rs?.duration ?? sc.duration ?? 0).toFixed(1)}ث · ${sc.layers.length} عناصر`))));
  });
  box.append(el('div', { class: 'row-actions' },
    el('button', { class: 'btn sm', onclick: dupScene }, 'نسخ'),
    el('button', { class: 'btn sm', onclick: () => moveScene(-1) }, '↑'), el('button', { class: 'btn sm', onclick: () => moveScene(1) }, '↓'),
    el('button', { class: 'btn sm', onclick: delScene }, 'حذف')));
  renderTimeline();
}
function selectScene(id) { stopPlay(); S.selScene = id; S.selLayer = null; renderAll(); seekPoster(id); }
function nextSceneId() { let n = 1; const ids = new Set(S.spec.scenes.map((s) => s.id)); while (ids.has('s' + n)) n++; return 's' + n; }
const rnd = () => Math.floor(Math.random() * 9000) + 1;
function usedSeeds(style) { const u = new Set(); S.spec.scenes.forEach((s) => s.layers.forEach((l) => { if (l.type === 'art' && l.style === style) u.add(l.seed); })); return u; }
function freshSeed(style) { const u = usedSeeds(style); let s = rnd(); while (u.has(s)) s = rnd(); return s; }
function addScene() {
  const id = nextSceneId();
  edit('addscene', () => {
    const styles = Object.keys(ART_LABELS).filter((x) => ['lattice', 'frames', 'rings'].includes(x));
    const style = styles[S.spec.scenes.length % styles.length];
    S.spec.scenes.push({ id, title: 'مشهد جديد', duration: 4, transitionIn: { type: 'wipe', dur: 0.55 }, layers: [
      { type: 'art', style, seed: freshSeed(style) },
      { type: 'text', text: uniqueText('عنوان *المشهد*'), x: 90, y: 760, w: 900, size: 96, align: 'center', stagger: 0.14, at: 0.5 }] });
    S.selScene = id; S.selLayer = null;
  }, { structural: true });
  seekPoster(id);
}
function dupScene() {
  const src = scene(); const id = nextSceneId();
  edit('dupscene', () => {
    const c = JSON.parse(JSON.stringify(src)); c.id = id; c.title = (src.title || '') + ' (نسخة)';
    c.layers.forEach((l) => { if (l.type === 'art') l.seed = freshSeed(l.style); if (l.type === 'text') l.text = uniqueText(l.text); if (l.type === 'sparkles') l.seed = rnd(); if (l.type === 'icon') l.name = freshIcon(l.name); });
    S.spec.scenes.splice(S.spec.scenes.indexOf(src) + 1, 0, c); S.selScene = id; S.selLayer = null;
  }, { structural: true });
  toast('نُسخ المشهد، وغُيّرت الخلفية والنصوص والأيقونة تلقائيًا كي لا تتكرر');
}
function delScene() {
  if (S.spec.scenes.length < 2) return toast('لا يمكن حذف المشهد الوحيد');
  if (!confirm('حذف هذا المشهد؟ (يمكن التراجع بـ Ctrl+Z)')) return;
  edit('delscene', () => { const i = S.spec.scenes.findIndex((s) => s.id === S.selScene); S.spec.scenes.splice(i, 1); S.selScene = S.spec.scenes[Math.max(0, i - 1)].id; S.selLayer = null; }, { structural: true });
}
function moveScene(d) {
  const a = S.spec.scenes, i = a.findIndex((s) => s.id === S.selScene), j = i + d;
  if (j < 0 || j >= a.length) return;
  edit('movescene', () => { [a[i], a[j]] = [a[j], a[i]]; }, { structural: true });
}
function uniqueText(t) {
  const all = new Set(); S.spec.scenes.forEach((s) => s.layers.forEach((l) => l.type === 'text' && all.add(l.text.replace(/\*/g, '').trim())));
  let out = t, n = 2; while (all.has(out.replace(/\*/g, '').trim())) out = `${t} ${n++}`; return out;
}
const ICON_POOL = ['star', 'heart', 'gift', 'camera', 'sparkles', 'party-popper', 'calendar-heart', 'hand-heart', 'frame', 'scissors', 'palette', 'package-open', 'box', 'link', 'wand-sparkles', 'images', 'book-heart', 'cake', 'flower', 'crown', 'gem', 'smile'];
function freshIcon(cur) {
  const used = new Set(); S.spec.scenes.forEach((s) => s.layers.forEach((l) => l.type === 'icon' && used.add(l.name)));
  return ICON_POOL.find((n) => !used.has(n)) || cur;
}

// ---------- layers ----------
const LAYER_DEFAULTS = {
  text: () => ({ type: 'text', text: uniqueText('نص جديد'), x: 90, y: 700, w: 900, size: 84, align: 'center', stagger: 0.14, at: 0.4 }),
  icon: () => ({ type: 'icon', name: freshIcon('star'), size: 140, x: 470, y: 440, badge: true, in: 'draw', dur: 0.9, at: 0.3 }),
  polaroid: () => ({ type: 'polaroid', x: 210, y: 380, w: 660, rot: -4, caption: '', at: 0.3 }),
  ribbon: () => ({ type: 'ribbon', shape: 'sweep', y: 1500, width: 60, at: 0.8, dur: 1.1 }),
  bow: () => ({ type: 'bow', x: 405, y: 330, size: 280, at: 0.3 }),
  rays: () => ({ type: 'rays', cx: 540, cy: 600, count: 16, color: 'accent', opacity: 0.25, speed: 3 }),
  sparkles: () => ({ type: 'sparkles', seed: rnd(), count: 12, at: 0.5 }),
  art: () => { const style = 'lattice'; return { type: 'art', style, seed: freshSeed(style) }; },
  bgtext: () => ({ type: 'bgtext', text: 'ذكريات', rows: 3, size: 420, y: 300, opacity: 0.12, speed: 60 }),
};
function addLayer(type) {
  edit('addlayer', () => { const sc = scene(); sc.layers.push(LAYER_DEFAULTS[type]()); S.selLayer = sc.layers.length - 1; }, { structural: true });
}
function delLayer(i) { edit('dellayer', () => { scene().layers.splice(i, 1); S.selLayer = null; }, { structural: true }); }
function moveLayer(i, d) { const a = scene().layers, j = i + d; if (j < 0 || j >= a.length) return; edit('movelayer', () => { [a[i], a[j]] = [a[j], a[i]]; S.selLayer = j; }, { structural: true }); }
function dupLayer(i) {
  edit('duplayer', () => {
    const c = JSON.parse(JSON.stringify(scene().layers[i]));
    if (c.type === 'text') c.text = uniqueText(c.text); if (c.type === 'icon') c.name = freshIcon(c.name); if (c.type === 'art') c.seed = freshSeed(c.style);
    if (c.x != null) c.x += 30; if (c.y != null) c.y += 30; scene().layers.splice(i + 1, 0, c); S.selLayer = i + 1;
  }, { structural: true });
}
function layerLabel(l) {
  if (l.type === 'text') return l.text.replace(/\*/g, '').slice(0, 22);
  if (l.type === 'icon') return l.name; if (l.type === 'polaroid') return l.caption || l.asset || 'بلا صورة'; if (l.type === 'art') return `${ART_LABELS[l.style] || l.style} #${l.seed}`;
  if (l.type === 'image' || l.type === 'video') return l.asset; if (l.type === 'ribbon') return l.shape || 'sweep'; return '';
}

// ---------- inspector ----------
function renderInspector() {
  const box = S.ui.insp; const keep = box.scrollTop; box.innerHTML = '';
  if (S.tab === 'project') renderProjectTab(box); else renderSceneTab(box);
  box.scrollTop = keep;
}
const F = (label, ...ctl) => el('div', { class: 'f' }, el('label', {}, label), el('div', { class: 'inl' }, ...ctl));
function num(obj, key, { min, max, step = 1, def = 0, key2 } = {}) {
  const i = el('input', { type: 'number', step, ...(min != null ? { min } : {}), ...(max != null ? { max } : {}), value: obj[key] ?? def,
    oninput: (e) => { const v = e.target.value === '' ? def : Number(e.target.value); edit((key2 || key) + obj.type, () => { obj[key] = v; }); } });
  return i;
}
function sel(obj, key, opts, def) {
  const s = el('select', { onchange: (e) => edit(key + 'sel', () => { obj[key] = e.target.value; }, { structural: true }) },
    Object.entries(opts).map(([v, t]) => el('option', { value: v, ...((obj[key] ?? def) === v ? { selected: true } : {}) }, t)));
  return s;
}
function txt(obj, key, { area = false, placeholder = '' } = {}) {
  const attrs = { value: obj[key] ?? '', placeholder, dir: 'auto', oninput: (e) => edit(key + 'txt', () => { obj[key] = e.target.value; }) };
  if (area) { const a = el('textarea', { placeholder, dir: 'auto', oninput: attrs.oninput }); a.value = obj[key] ?? ''; return a; }
  return el('input', { type: 'text', ...attrs });
}
function chk(obj, key, def = false) { return el('input', { type: 'checkbox', ...((obj[key] ?? def) ? { checked: true } : {}), onchange: (e) => edit(key + 'chk', () => { obj[key] = e.target.checked; }) }); }
function colorCtl(obj, key, def) {
  const cur = obj[key] ?? def; const wrap = el('div', { class: 'swatches' });
  for (const [tok, label] of TOKENS) wrap.append(el('button', { title: label, class: cur === tok ? 'on' : '', style: `background:${S.spec.palette[tok]}`, onclick: () => { edit(key + 'col', () => { obj[key] = tok; }, { structural: true }); } }));
  const hex = /^#[0-9a-f]{6}$/i.test(cur) ? cur : (S.spec.palette[cur] || '#000000');
  wrap.append(el('input', { type: 'color', value: hex, title: 'لون مخصص', oninput: (e) => edit(key + 'col', () => { obj[key] = e.target.value; }) }));
  return wrap;
}
function animFields(l, defIn) {
  return el('div', { class: 'grp' }, el('h5', {}, 'التوقيت والحركة'),
    F('الدخول', sel(l, 'in', ANIM_LABELS, defIn)), F('يبدأ عند (ث)', num(l, 'at', { step: 0.1, min: 0 })), F('مدة الحركة', num(l, 'dur', { step: 0.1, min: 0, def: 0.6 })),
    F('الخروج', sel(l, 'out', { '': '— بدون —', ...ANIM_LABELS }, '')), l.out ? F('يخرج عند (ث)', num(l, 'outAt', { step: 0.1, min: 0 })) : null);
}

function renderSceneTab(box) {
  const sc = scene(); const idx = S.spec.scenes.indexOf(sc);
  box.append(el('div', { class: 'grp' }, el('h5', {}, `المشهد ${idx + 1}`),
    F('الاسم', txt(sc, 'title')), F('المدة (ث)', num(sc, 'duration', { step: 0.1, min: 0.5 })),
    idx > 0 ? F('الانتقال', sel(sc.transitionIn ||= { type: 'wipe', dur: 0.55 }, 'type', TRANS_LABELS, 'wipe'), num(sc.transitionIn, 'dur', { step: 0.05, min: 0.2, def: 0.55, key2: 'tdur' })) : null));

  const list = el('div', { class: 'grp' }, el('h5', {}, 'عناصر المشهد (الأعلى = الأمام)'));
  [...sc.layers.keys()].reverse().forEach((i) => {
    const l = sc.layers[i];
    list.append(el('div', { class: 'layer-item' + (S.selLayer === i ? ' sel' : ''), onclick: () => { S.selLayer = i; renderInspector(); updateSelBox(); } },
      el('span', { class: 'ty' }, TYPE_LABELS[l.type] || l.type), el('span', { class: 'lb' }, layerLabel(l)),
      el('button', { title: 'للأمام', onclick: (e) => { e.stopPropagation(); moveLayer(i, 1); } }, '▲'), el('button', { title: 'للخلف', onclick: (e) => { e.stopPropagation(); moveLayer(i, -1); } }, '▼'),
      el('button', { title: 'نسخ', onclick: (e) => { e.stopPropagation(); dupLayer(i); } }, '⧉'), el('button', { title: 'حذف', onclick: (e) => { e.stopPropagation(); delLayer(i); } }, '✕')));
  });
  const add = el('select', { onchange: (e) => { if (e.target.value) { addLayer(e.target.value); } e.target.value = ''; } },
    el('option', { value: '' }, '+ إضافة عنصر…'), ...Object.keys(LAYER_DEFAULTS).map((k) => el('option', { value: k }, TYPE_LABELS[k])));
  list.append(el('div', { style: 'margin-top:8px' }, add));
  box.append(list);

  const l = layer();
  if (l) box.append(layerEditor(l)); else box.append(el('div', { class: 'empty' }, 'اختاري عنصرًا من القائمة أو اضغطي عليه في المعاينة لتعديله. اسحبيه في المعاينة لتحريكه.'));
}

function layerEditor(l) {
  const g = el('div', { class: 'grp' }, el('h5', {}, 'تعديل: ' + (TYPE_LABELS[l.type] || l.type)));
  const pos = () => [F('X', num(l, 'x')), F('Y', num(l, 'y'))];
  if (l.type === 'text') {
    g.append(F('النص', txt(l, 'text', { area: true })), el('div', { class: 'f' }, el('span'), el('small', { style: 'color:var(--muted)' }, 'ضعي *نجمتين* حول الكلمة لتبرز بالأحمر')),
      F('الخط', sel(l, 'font', FONT_LABELS, 'display')), F('الحجم', num(l, 'size', { min: 20, max: 260, def: 90 })), F('السماكة', sel(l, 'weight', { 400: 'عادي', 500: 'متوسط', 700: 'عريض', 800: 'ثقيل', 900: 'أثقل' }, '800')),
      F('اللون', colorCtl(l, 'color', 'ink')), F('لون الإبراز', colorCtl(l, 'keyColor', 'accent')), F('المحاذاة', sel(l, 'align', { right: 'يمين', center: 'وسط', left: 'يسار' }, 'right')),
      ...pos(), F('العرض', num(l, 'w', { min: 100, max: 1000, def: 900 })), F('تتابع الكلمات', num(l, 'stagger', { step: 0.02, min: 0, def: 0.12 })));
    return wrapAnim(g, l, 'blur', true);
  }
  if (l.type === 'icon') {
    g.append(F('الأيقونة', el('button', { class: 'btn sm', onclick: () => iconPicker(l) }, l.name)), F('الحجم', num(l, 'size', { min: 40, max: 600, def: 160 })), F('اللون', colorCtl(l, 'color', 'ink')), F('إطار مشطوف', chk(l, 'badge')), F('سماكة الخط', num(l, 'stroke', { step: 0.25, min: 0.5, max: 4, def: 1.75 })), ...pos());
    return wrapAnim(g, l, 'draw');
  }
  if (l.type === 'polaroid') {
    g.append(F('الصورة', assetPicker(l)), F('التعليق', txt(l, 'caption')), ...pos(), F('العرض', num(l, 'w', { min: 200, max: 1000, def: 640 })), F('الميلان', num(l, 'rot', { step: 0.5, min: -30, max: 30, def: -4 })), F('شريط لاصق', chk(l, 'tape', true)), F('لون الشريط', colorCtl(l, 'tapeColor', 'accent')));
    return wrapAnim(g, l, 'settle');
  }
  if (l.type === 'image') {
    g.append(F('الصورة', assetPicker(l)), ...pos(), F('العرض', num(l, 'w', { def: 1080 })), F('الارتفاع', num(l, 'h', { def: 1920 })), F('حركة كاميرا', el('input', { type: 'checkbox', ...(l.kenburns ? { checked: true } : {}), onchange: (e) => edit('kb', () => { l.kenburns = e.target.checked ? { from: 1, to: 1.12, dx: -30 } : undefined; }) })));
    return wrapAnim(g, l, 'fade');
  }
  if (l.type === 'art') {
    g.append(F('النمط', sel(l, 'style', ART_LABELS, 'shards')), F('البذرة', num(l, 'seed', { min: 1 }), el('button', { class: 'btn sm', title: 'تكوين جديد', onclick: () => edit('seed', () => { l.seed = freshSeed(l.style); }, { structural: true }) }, '🎲')));
    return g;
  }
  if (l.type === 'fill') { g.append(F('اللون', colorCtl(l, 'color', 'bg'))); return g; }
  if (l.type === 'rays') {
    g.append(F('اللون', colorCtl(l, 'color', '#FFFFFF')), F('العدد', num(l, 'count', { min: 4, max: 40, step: 2, def: 14 })), F('الشفافية', num(l, 'opacity', { step: 0.05, min: 0.05, max: 1, def: 0.5 })), F('السرعة', num(l, 'speed', { step: 0.5, def: 4 })), F('مركز X', num(l, 'cx')), F('مركز Y', num(l, 'cy')));
    return wrapAnim(g, l, 'fade');
  }
  if (l.type === 'sparkles') {
    g.append(F('العدد', num(l, 'count', { min: 3, max: 40, def: 14 })), F('الحجم', num(l, 'size', { min: 20, max: 120, def: 46 })), F('البذرة', num(l, 'seed', { min: 1 }), el('button', { class: 'btn sm', onclick: () => edit('seed', () => { l.seed = rnd(); }, { structural: true }) }, '🎲')));
    return wrapAnim(g, l, 'fade');
  }
  if (l.type === 'ribbon') {
    g.append(F('الشكل', sel(l, 'shape', { sweep: 'انسيابي', wave: 'موجة', diagonal: 'قُطري', loop: 'التفاف' }, 'sweep')), F('الارتفاع Y', num(l, 'y', { def: 1480 })), F('العرض', num(l, 'width', { min: 20, max: 200, def: 70 })), F('اللون', colorCtl(l, 'color', '#C8102E')));
    return wrapAnim(g, l, 'draw');
  }
  if (l.type === 'bow') {
    g.append(...pos(), F('الحجم', num(l, 'size', { min: 100, max: 700, def: 360 })), F('اللون', colorCtl(l, 'color', '#C8102E')));
    return wrapAnim(g, l, 'pop');
  }
  if (l.type === 'bgtext') {
    g.append(F('النص', txt(l, 'text')), F('الحجم', num(l, 'size', { min: 100, max: 800, def: 420 })), F('الصفوف', num(l, 'rows', { min: 1, max: 6, def: 3 })), F('الشفافية', num(l, 'opacity', { step: 0.02, min: 0.02, max: 0.6, def: 0.13 })), F('السرعة', num(l, 'speed', { def: 70 })), F('Y', num(l, 'y', { def: 120 })));
    return g;
  }
  g.append(el('div', { class: 'empty' }, 'هذا النوع يُعدَّل من الملف project.json حاليًا'));
  return g;
}
function wrapAnim(g, l, defIn) { const w = el('div', {}, g, animFields(l, defIn)); return w; }

function assetPicker(l) {
  const wrap = el('div', { style: 'width:100%' });
  const sel = el('select', { onchange: (e) => edit('asset', () => { l.asset = e.target.value || undefined; }, { structural: true }) },
    el('option', { value: '' }, '— بلا صورة (مكان فارغ) —'), ...Object.entries(S.assets).filter(([, a]) => a.type === 'image').map(([id]) => el('option', { value: id, ...(l.asset === id ? { selected: true } : {}) }, id)));
  const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true, onchange: async (e) => { const id = await uploadFile(e.target.files[0]); if (id) edit('asset', () => { l.asset = id; }, { structural: true }); } });
  wrap.append(sel, el('div', { style: 'margin-top:6px' }, el('button', { class: 'btn sm', onclick: () => file.click() }, '⬆ رفع صورة من جهازي'), file));
  return wrap;
}
async function uploadFile(f) {
  if (!f) return null;
  try {
    const r = await api(`/api/projects/${S.id}/media`, { method: 'POST', raw: f, headers: { 'x-filename': encodeURIComponent(f.name), 'content-type': 'application/octet-stream' } });
    S.assets[r.assetId] = r.asset; toast(r.duplicate ? 'الصورة موجودة مسبقًا — استُخدمت نفسها' : 'تم رفع الصورة'); return r.assetId;
  } catch (e) { toast(e.message); return null; }
}

async function iconPicker(l) {
  const grid = el('div', { class: 'icons' });
  const load = async (q) => {
    const names = await api('/api/icons?q=' + encodeURIComponent(q || ''));
    grid.innerHTML = '';
    names.forEach((n) => grid.append(el('button', { title: n, onclick: () => { edit('icon', () => { l.name = n; }, { structural: true }); closeModal(); } }, el('img', { src: `/icon/${n}`, alt: n }))));
    if (!names.length) grid.append(el('div', { class: 'empty' }, 'لا نتائج'));
  };
  modal([el('h3', { style: 'margin-top:0' }, 'اختيار أيقونة (Lucide)'), el('input', { type: 'text', dir: 'ltr', placeholder: 'ابحثي بالإنجليزية: heart, camera, gift, book…', oninput: (e) => load(e.target.value) }), grid]);
  load('');
}

function renderProjectTab(box) {
  const sp = S.spec;
  const g1 = el('div', { class: 'grp' }, el('h5', {}, 'المشروع'), F('الاسم', txt(sp.meta ||= {}, 'title')), F('النوع', el('span', {}, state.brand.kinds[sp.meta.kind]?.label || '')),
    F('الفكرة', txt(sp.meta, 'idea', { area: true })));
  const themes = el('div', { class: 'chips' }, Object.entries(state.brand.brand.themes).map(([k, v]) => el('button', { class: 'chip' + (sp.meta.theme === k ? ' on' : ''), onclick: () => edit('theme', () => { sp.meta.theme = k; const { label, ...p } = v; Object.assign(sp.palette, p); }, { structural: true }) }, v.label)));
  const pal = el('div', { class: 'grp' }, el('h5', {}, 'ألوان العلامة'), themes, el('div', { style: 'height:8px' }),
    ...TOKENS.map(([k, label]) => F(label, el('input', { type: 'color', value: sp.palette[k], oninput: (e) => edit('pal' + k, () => { sp.palette[k] = e.target.value; sp.meta.theme = 'custom'; }) }))),
    el('small', { style: 'color:var(--muted)' }, 'العناصر التي لونها «من الباليت» تتبع هذه الألوان تلقائيًا.'));
  const thumbs = el('div', { class: 'thumbs' }, Object.entries(S.assets).map(([id, a]) => el('div', { class: 'thumb' }, el('img', { src: `/files/${S.id}/${a.file}?v=${a.addedAt || ''}`, alt: id }), el('span', {}, id))));
  const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onchange: async (e) => { for (const f of e.target.files) await uploadFile(f); renderInspector(); } });
  const drop = el('div', { class: 'drop', onclick: () => file.click() }, 'اسحبي صور منتجات Ms. Memories هنا أو اضغطي للاختيار');
  ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => { for (const f of e.dataTransfer.files) await uploadFile(f); renderInspector(); });
  const media = el('div', { class: 'grp' }, el('h5', {}, 'صور هذا المشروع'), Object.keys(S.assets).length ? thumbs : el('div', { class: 'empty' }, 'لا صور بعد. الصور تُضاف إلى إطارات Polaroid من تبويب «المشهد».'), drop, file,
    el('small', { style: 'color:var(--muted)' }, 'تُحفظ الصور في مجلد المشروع على جهازك فقط.'));
  box.append(g1, pal, media);
}

// ---------- preview ----------
async function refreshPreview() {
  if (!S) return;
  const my = ++S.seq;
  if (!S.frameReady) return;
  let r;
  try { r = await api(`/api/projects/${S.id}/resolve`, { method: 'POST', body: S.spec }); } catch (e) { r = { error: e.message }; }
  if (!S || my !== S.seq) return;
  if (r.error) { S.previewErr = r.error; showIssues({ errors: [r.error], warns: [] }); return; }
  S.previewErr = null; S.res = r.resolved; S.total = r.total; S.issues = r;
  try { await S.ui.frame.contentWindow.initProject(r.resolved); } catch (e) { showIssues({ errors: ['تعذّر تحميل المعاينة: ' + e.message], warns: [] }); return; }
  S.ui.range.max = r.total; S.ui.range.step = 0.01;
  renderTimeline(); renderScenes(); showIssues(r);
  await seek(Math.min(S.t, r.total));
}
function showIssues({ errors, warns }) {
  const b = S.ui.issues; b.innerHTML = '';
  const n = errors.length + warns.length; b.hidden = n === 0; b.classList.toggle('err', errors.length > 0);
  if (!n) return;
  b.append(el('b', {}, errors.length ? `✖ ${errors.length} أخطاء` : `⚠ ${warns.length} تنبيهات`), errors.length && warns.length ? ` و${warns.length} تنبيهات` : '', ' (اضغطي للتفاصيل)');
  b.append(el('ul', { style: b.classList.contains('open') ? '' : 'display:none' }, [...errors.map((e) => el('li', { class: 'errline' }, e)), ...warns.map((w) => el('li', {}, w))]));
  b.querySelector('ul').style.display = b.classList.contains('open') ? 'block' : 'none';
}
function renderTimeline() {
  const tl = S.ui.tl; [...tl.querySelectorAll('.seg')].forEach((n) => n.remove());
  if (!S.res || !S.total) return;
  S.res.scenes.forEach((sc, i) => {
    // RTL: timeline runs left→right like a video player (direction kept LTR on purpose)
    const seg = el('div', { class: 'seg' + (sc.id === S.selScene ? ' sel' : ''), style: `left:${(sc.start / S.total) * 100}%;width:${((sc.end - sc.start) / S.total) * 100}%`, onclick: () => selectScene(sc.id) }, String(i + 1));
    tl.prepend(seg);
  });
}
let frameBusy = false, frameNext = null;
async function seek(t) {
  S.t = t; S.ui.range.value = t; S.ui.time.textContent = `${fmt(t)} / ${fmt(S.total)}`;
  const live = S.res?.scenes?.filter((s) => t >= s.start && t <= s.end).pop();
  S.ui.scenes.querySelectorAll('.scene-item').forEach((n) => n.classList.toggle('live', live && n.dataset.id === live.id));
  if (!S.res) return;
  if (frameBusy) { frameNext = t; return; }
  frameBusy = true;
  try { await S.ui.frame.contentWindow.renderFrame(t); } catch (e) { /* project reloading */ }
  frameBusy = false;
  if (frameNext != null) { const n = frameNext; frameNext = null; return seek(n); }
  updateSelBox();
}
function seekPoster(id) {
  const rs = S.res?.scenes?.find((s) => s.id === id); if (!rs) return;
  seek(rs.start + Math.min(rs.duration * 0.78, rs.duration - 0.15));
}
function togglePlay() { S.playing ? stopPlay() : startPlay(); }
function startPlay() {
  if (!S?.res) return;
  S.playing = true; S.ui.playBtn.textContent = '⏸ إيقاف';
  let t0 = performance.now(), base = S.t >= S.total - 0.05 ? 0 : S.t;
  const tick = async (now) => {
    if (!S?.playing) return;
    let t = base + (now - t0) / 1000;
    if (t >= S.total) { t = 0; base = 0; t0 = now; }
    await seek(t);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stopPlay() { if (S) { S.playing = false; S.ui?.playBtn && (S.ui.playBtn.textContent = '▶ تشغيل'); } }

// ---------- direct manipulation on the preview ----------
function updateSelBox() {
  const b = S?.ui?.sel; if (!b) return;
  const l = layer(); const win = S.ui.frame.contentWindow;
  if (!l || !win?.layerRect || !S.res) { b.style.display = 'none'; return; }
  const live = S.res.scenes.find((s) => s.id === S.selScene);
  if (!live || S.t < live.start || S.t > live.end) { b.style.display = 'none'; return; }
  const r = win.layerRect(S.selScene, S.selLayer); if (!r || r.w > 1070 && r.h > 1900) { b.style.display = 'none'; return; }
  Object.assign(b.style, { display: 'block', left: r.x * S.scale + 'px', top: r.y * S.scale + 'px', width: r.w * S.scale + 'px', height: r.h * S.scale + 'px' });
}
const DRAG = { text: ['x', 'y'], icon: ['x', 'y'], polaroid: ['x', 'y'], image: ['x', 'y'], bow: ['x', 'y'], rays: ['cx', 'cy'], ribbon: [null, 'y'], bgtext: [null, 'y'] };
function onStagePointerDown(e) {
  const win = S.ui.frame.contentWindow; if (!win?.hitTest || !S.res) return;
  stopPlay();
  const r = S.ui.vp.getBoundingClientRect();
  const x = (e.clientX - r.left) / S.scale, y = (e.clientY - r.top) / S.scale;
  const hit = win.hitTest(x, y);
  if (!hit) { S.selLayer = null; renderAll(); updateSelBox(); return; }
  const sceneChanged = hit.scene !== S.selScene;
  S.selScene = hit.scene; S.selLayer = hit.li;
  if (sceneChanged || S.tab !== 'scene') S.tab = 'scene';
  renderAll(); updateSelBox();
  const l = layer(); const keys = DRAG[l.type]; if (!keys) return;
  const start = { px: e.clientX, py: e.clientY, x0: keys[0] ? l[keys[0]] ?? 0 : 0, y0: keys[1] ? l[keys[1]] ?? 0 : 0 };
  let moved = false;
  const node = win.document.querySelector(`.layer[data-scene="${hit.scene}"][data-li="${hit.li}"]`);
  const move = (ev) => {
    const dx = (ev.clientX - start.px) / S.scale, dy = (ev.clientY - start.py) / S.scale;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    if (!moved) { snapshotIfNeeded('drag' + Date.now()); moved = true; }
    if (keys[0]) l[keys[0]] = Math.round(start.x0 + dx);
    if (keys[1]) l[keys[1]] = Math.round(start.y0 + dy);
    if (node && ['x', 'y'].every((k, i) => keys[i] === k)) { node.style.left = l.x + 'px'; node.style.top = l.y + 'px'; }
    updateSelBox();
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
    if (moved) { changed(); renderInspector(); }
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
}

// ---------- export ----------
async function startExport(kind) {
  if (S.previewErr) return toast('أصلحي الخطأ في المعاينة أولًا: ' + S.previewErr);
  if (S.issues.errors.length) return toast('يوجد أخطاء تمنع التصدير — راجعي الإشعار تحت المعاينة');
  if (kind === 'final' && S.issues.warns.some((w) => w.includes('Polaroid'))) {
    if (!confirm('بعض إطارات Polaroid بلا صورة (مكان فارغ). تصدير نهائي رغم ذلك؟')) return;
  }
  stopPlay(); await flushSave();
  const bar = S.ui.expbar.querySelector('.bar'); bar.hidden = false; S.ui.progress.style.width = '0';
  S.ui.jobtxt.textContent = 'جارٍ التجهيز…';
  let job;
  try {
    job = kind === 'still' ? await api(`/api/projects/${S.id}/still`, { method: 'POST', body: { t: S.t } })
      : await api(`/api/projects/${S.id}/render`, { method: 'POST', body: { preview: kind === 'preview' } });
  } catch (e) { S.ui.jobtxt.textContent = ''; bar.hidden = true; return toast(e.message); }
  const poll = async () => {
    const j = await api('/api/jobs/' + job.id).catch(() => null);
    if (!S || !j) return;
    S.ui.progress.style.width = Math.round(j.progress * 100) + '%';
    S.ui.jobtxt.textContent = j.done ? '' : `جارٍ التصدير ${Math.round(j.progress * 100)}%`;
    if (!j.done) return setTimeout(poll, 600);
    bar.hidden = true;
    if (!j.ok) return modal([el('h3', {}, 'فشل التصدير'), el('pre', { style: 'white-space:pre-wrap;direction:ltr;font-size:12px' }, j.log), el('button', { class: 'btn', onclick: closeModal }, 'إغلاق')]);
    const isVideo = j.file.endsWith('.mp4');
    modal([el('h3', { style: 'margin-top:0' }, isVideo ? 'الفيديو جاهز ✓' : 'الصورة جاهزة ✓'),
      isVideo ? el('video', { src: j.file, controls: true, autoplay: true }) : el('img', { src: j.file, style: 'max-width:100%;max-height:60vh' }),
      el('div', { class: 'row-actions' }, el('a', { class: 'btn red', href: j.file, download: '' }, 'تنزيل'), el('button', { class: 'btn', onclick: closeModal }, 'إغلاق'))]);
  };
  poll();
}
