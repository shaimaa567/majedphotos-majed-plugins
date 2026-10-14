# Arabian Motion Studio

أداة تنتج فيديوهات قصيرة عمودية **9:16 (1080×1920)** بنصوص عربية RTL ورسوم رقمية حادة وأيقونات Lucide وصور/مقاطع Pexels، وتصدّرها كملف **MP4 حقيقي** (H.264 + AAC).

## كيف تعمل (التقنية)

```
project.json (مشاهد كبيانات)  ──►  engine/runtime.js  (SVG + CSS + DOM، دالة في الزمن t)
                                     │  Chromium بلا واجهة (Playwright) يلتقط إطارًا لكل t
                                     ▼
                                   ffmpeg: ترميز H.264 + مزج الصوت + ضبط الجهارة −14 LUFS
```

- **لماذا DOM/SVG؟** المتصفح يشكّل الحروف العربية ويدعم RTL والـ bidi بشكل صحيح؛ أفضل من Canvas.
- **حتمي:** نفس `t` = نفس الصورة دائمًا، فالمعاينة تطابق التصدير.
- الخطوط: Tajawal وNoto Kufi Arabic (OFL) بأوزانها الحقيقية في `assets/fonts/`.

## التشغيل

```bash
npm install
node src/cli.mjs check demo                       # فحص المشروع
node src/cli.mjs sheet demo --from 0 --to 4       # لوحة معاينة (صورة واحدة بكل الحركة)
node src/cli.mjs render demo --preview            # معاينة منخفضة الدقة
node src/cli.mjs render demo                      # تصدير نهائي → output/demo/demo_v1.mp4
```

يتطلب: Node ≥ 20.12، `ffmpeg`/`ffprobe`، وChromium (مع Playwright؛ إن لم يكن مثبتًا: `npx playwright install chromium` أو اضبط `CHROME_PATH`).

## بنية المشروع

```
engine/            محرك المشاهد (لا تحتاج تعديله عادةً)
src/               الأوامر: render, audio, pexels, validate, project
assets/fonts/      الخطوط + تراخيصها
projects/<name>/
  project.json     المشاهد والطبقات والصوت
  assets.json      سجل الصور/المقاطع (المصدر، المصوّر، الرخصة، أين تُستخدم)
  media/ audio/ icons/   ملفاتك (icons/ لأيقونات SVG مخصصة)
output/            ناتج التصدير (خارج git)
```

مشروع جديد: `node src/cli.mjs new my-reel`.

## أنواع الطبقات في المشهد

| type | الاستخدام |
|---|---|
| `art` | رسم رقمي حاد مولّد بـ seed: `style` = `shards` `lines` `rings` `bands` `grid` |
| `bgtext` | نص ضخم في الخلفية (إطار فقط) يتحرك ببطء، صفوف بعكس الاتجاه |
| `text` | نص عربي RTL، كشف كلمة كلمة. `*كلمة*` = إبراز. الكلمات اللاتينية تُعزل تلقائيًا (LTR) |
| `icon` | أيقونة Lucide بالاسم `"name":"rocket"` مع رسم الخط `in:"draw"` وإطار `badge` |
| `image` | صورة من `assets.json`: `clip` (قصّ مضلّع حاد)، `kenburns`، `filter`، `overlay` |
| `video` | مقطع من `assets.json` (`trim` = ثواني البداية داخل المقطع) |
| `shape` | مستطيل/مضلّع حاد |

حركات الدخول `in`: `fade rise drop slideR slideL scale pop wipe wipeUp blur draw` — والخروج `out` + `outAt`.
`slideR` و`wipe` يتقدمان من اليمين لليسار (اتجاه القراءة العربي).

انتقالات المشهد `transitionIn`: `wipe` (قطع قطري) · `bars` (قضبان) · `slide` · `fade`.

## الصور والأيقونات (تغييرها سهل)

- **أيقونة:** غيّر `"name"` فقط. البحث: `node src/cli.mjs icons search video`.
- **صورة من Pexels:**
  ```bash
  node src/cli.mjs pexels search demo --q "كاميرا سينمائية" --type photo     # قد يلزم بالإنجليزية: "cinema camera"
  # راجع الصور المصغرة في projects/demo/.cache/candidates/ ثم:
  node src/cli.mjs pexels pick demo --id 1234567 --as hero_s2 --scene s2
  ```
  ثم أضف طبقة `{"type":"image","asset":"hero_s2", ...}` في المشهد. لتغييرها لاحقًا: غيّر `asset` أو اختر غيرها.
- **تجنب التكرار:** `check` يفشل إذا تكرر أصل أو رقم Pexels أو ملف مطابق أو أيقونة أو (style+seed) أو نص بين المشاهد، و`pick` يرفض اختيار نفس المقطع مرتين.

## مفاتيح API (بأمان)

1. أنشئ مفتاح Pexels المجاني من https://www.pexels.com/api/
2. `cp .env.example .env` ثم الصق المفتاح بعد `PEXELS_API_KEY=` واحفظ.
3. الملف `.env` مستثنى من git؛ لا تلصق المفتاح في المحادثة ولا في أي ملف آخر.

بدون مفتاح تعمل كل الميزات الأخرى (الرسم الرقمي، الأيقونات، الصور/المقاطع التي تضعها بنفسك).

## الصوت والتعليق الصوتي والمزامنة

في `project.json`:
```json
"sync": "sync.json",
"audio": { "vo": "audio/vo.mp3", "music": "audio/music.mp3", "musicGain": -18,
           "sfx": [ { "file": "audio/whoosh.wav", "at": "@scene:s2", "gain": -8 } ] }
```
1. اكتب سكربت التعليق، ولّده بصوت من اختيارك، وضع الملف في `audio/`.
2. `pip install faster-whisper` ثم `node src/cli.mjs sync <project>` ← يكتب `sync.json` بزمن كل كلمة. قارن النص بالسكربت وصحّح.
3. اربط العناصر بالكلام: `"at": "@w12"` (بداية الكلمة 12) · `"@w12.e"` (نهايتها) · `"@w12+0.2"` · `"@scene:s3"` · نص كامل: `"wordsFrom": 12` يكشف كل كلمة مع نطقها. ونهاية المشهد: `"endAt": "@w20+0.4"` بدل `duration`.
4. الموسيقى تنخفض تلقائيًا أثناء الصوت (ducking) والمخرج −14 LUFS.

## الحالة

المرحلة 1 منجزة ومختبرة (انظر `docs/PLAN.md`).
