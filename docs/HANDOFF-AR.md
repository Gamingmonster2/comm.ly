# وثيقة تسليم المشروع — comm.ly Network

> هذه الوثيقة مكتوبة **لوكيل ذكاء اصطناعي جديد** يفتح المشروع لأول مرة، أو لأي مطوّر يريد استكمال العمل.
> اقرأها بالكامل قبل أي تعديل. كل المعلومات أدناه مُتحقَّق منها فعلياً في تاريخ آخر تحديث.

---

## 0) بطاقة سريعة

| البند | القيمة |
|---|---|
| **اسم المشروع** | comm.ly Network — منصة اختصار روابط بشبكة نطاقات |
| **مسار المشروع على الجهاز** | `C:\Link shortening platform` |
| **الموقع الحي (الآن)** | https://comm-ly.pages.dev |
| **المستودع** | https://github.com/Gamingmonster2/comm.ly (فرع `main`) |
| **حساب Cloudflare** | `a9509f6a5546f386be2fd780ba517efb` (بريد safealigoog@gmail.com) |
| **مشروع Cloudflare Pages** | `comm-ly` (رابطه: comm-ly.pages.dev) |
| **قاعدة بيانات D1** | `comly` — ID: `417f6acd-60fa-4f88-a85f-f85a05fe0335` |
| **KV Namespace** | `CACHE` — ID: `e86ee4ad80904265a273d6a4d083bef3` |
| **بيئة التشغيل** | Node.js v24 · wrangler 4.154.0 (devDependency) |
| **حالة Git المحلية** | `main...origin/main [ahead 1]` — آخر commit محلي `d44e1df` غير مدفوع |

---

## 1) أين توجد الأشياء على الكمبيوتر؟

| ما تبحث عنه | المسار |
|---|---|
| **مجلد المشروع كاملاً** | `C:\Link shortening platform` |
| الكود المصدري (المحرك) | `C:\Link shortening platform\functions\` |
| مولّد الصفحات والقوالب | `C:\Link shortening platform\build\` |
| إعدادات المواقع والمحتوى | `C:\Link shortening platform\sites\registry.mjs` |
| مخطط قاعدة البيانات | `C:\Link shortening platform\d1\schema.sql` |
| التصميم (CSS/JS) | `C:\Link shortening platform\assets\` |
| مخرجات البناء (لا تُرفع لـGit) | `C:\Link shortening platform\dist\<site-id>\` |
| نموذج التصميم القديم (مرجع فقط) | `C:\Link shortening platform\prototype\` |
| **الأسرار والاعتمادات (مستثناة من Git)** | `C:\Link shortening platform\.secrets\` |
| اعتماد wrangler (OAuth) | `C:\Users\سيف الدين\AppData\Roaming\xdg.config\.wrangler\config\default.toml` |
| كاش/إعداد wrangler المحلي | `C:\Link shortening platform\.wrangler\` |
| أدلة سابقة | `C:\Link shortening platform\docs\` |

### محتويات `.secrets` (لا تُرفع أبداً — مُستثناة في `.gitignore`)

| الملف | المحتوى |
|---|---|
| `cloudflare-account-id.txt` | معرف حساب Cloudflare |
| `cloudflare-resources.txt` | ملخص: D1 ID + KV ID + Account ID |
| `cloudflare-token.txt` | توكن API (إن وُجد — غير مطلوب حالياً لأن wrangler مسجّل بـOAuth) |
| `github-token.txt` | توكن قديم/مُبطَل — لا تعتمد عليه |
| `README.txt` | ملاحظات |

> **تحذير:** لا تُضف `.secrets/` إلى Git أبداً. تحقّق من `.gitignore` دائماً.

---

## 2) الفكرة والعلامة التجارية

- المشروع **شبكة اختصار روابط**: عدة مواقع تعمل بمحرك واحد وقاعدة بيانات واحدة.
- **`comm.ly` هي العلامة الأساسية** (الموقع الرئيسي: المنتج، الأسعار، الحساب، لوحة التحكم، الصفحات القانونية).
- **المحركات** (`3/4/6/7/8/9.com.ly` وأي نطاق يُضاف لاحقاً) مواقع مستقلة الهوية والمحتوى لكنها:
  - تُنشئ روابط تعمل على **كل نطاقات الشبكة** (نفس محرك D1).
  - تضيف احتياطاً وتوزيعاً وفرص SEO.
  - يمكن إضافة نطاقات جديدة **بدون أي تعديل على الكود**: سطر في `sites/registry.mjs` + مشروع Pages جديد.
- **اللغة:** الإنجليزية رئيسية على `/` والعربية ثانوية على `/ar/` (مع hreflang).
- **نموذج العمل:** خطة مجانية + Pro $4 + Business $12 + Agency $39 + Enterprise (الأسعار كاملة في `sites/registry.mjs` وفي `docs/BUSINESS-MODEL-AR.md`).
- **الدفع:** مؤجل — سيُربط لاحقاً عبر منصة دفع جاهزة (كريبتو + بطاقات). البنية جاهزة عبر `/api/billing/webhook` وجدول `subscriptions`.

---

## 3) البنية التقنية

```
GitHub Repository (واحد)
        │
        ▼
Cloudflare Pages (مشروع Pages لكل نطاق — حالياً مشروع comm-ly فقط)
   ├── Statics: الصفحات المولّدة (عربي/إنجليزي)
   └── Pages Functions: محرك الاختصار + الحسابات + API
        │
        ├── D1 (comly) ← كل الروابط والحسابات والاشتراكات (مشتركة لكل النطاقات)
        └── KV (CACHE) ← كاش التحويل + حدود المعدل
```

- **البناء:** سكربت Node خالص بدون أي إطار عمل ولا تبعيات بناء. يقرأ `sites/registry.mjs` ويولّد `dist/<site-id>/` كاملة (HTML + assets + functions + sitemap + robots + `_headers` + `_routes.json`).
- **المحرك:** Cloudflare Pages Functions (JavaScript ES modules) يعمل على D1 + KV.
- **التصميم:** نظام CSS خاص مستوحى من **shadcn/ui** (ألوان zinc)، يدعم **الوضع الداكن والفاتح وحسب النظام**، ولوحة التحكم بطابع **Tabler**.
- **لماذا Cloudflare Pages؟** استضافة مجانية، عرض نطاق غير محدود، SSL تلقائي، ربط النطاقات من لوحة Cloudflare مباشرة (كل نطاقات المشروع مُدارة أصلاً على Cloudflare).

---

## 4) خريطة الملفات وشرح كل جزء

### الجذر
| الملف | الوظيفة |
|---|---|
| `package.json` | أوامر: `build`, `matrix`, `serve`, `preview:prototype`, `verify`, `test`, `test:dom` |
| `wrangler.toml` | إعدادات Cloudflare (D1 `DB` + KV `CACHE`) — مرجعي |
| `.gitattributes` | توحيد نهايات الأسطر `eol=lf` (بدون BOM) |
| `.gitignore` | يستثني `node_modules/`, `dist/`, `.tools/`, `.secrets/`, `.wrangler/`... |
| `README.md` | نظرة عامة سريعة |
| `LICENSE` | ملف الترخيص من المستودع |

### `sites/registry.mjs` — **أهم ملف**
المصدر الوحيد للحقيقة:
- `brand` (اسم comm.ly، البريد، الروابط)
- `plans` (5 خطط بأسعارها وميزاتها بالعربي/الإنجليزي)
- `addons` (الإضافات)
- `sites[]` — لكل موقع: `id`, `host`, `role` (`main` أو `engine`), `mark` (شكل الشعار), `colors`, `tool`, `tagline`, `heroA/heroB`, `lead`, `metaTitle/metaDesc`, `features[]`, `toolTitle/toolDesc`, `faq[]`
- **إضافة نطاق جديد = إضافة كائن هنا فقط** ثم `npm run build` ومشروع Pages.

### `build/` — مولّد الصفحات
- `build/build.mjs`: يبني كل المواقع (أو `--site=id`), ينسخ `assets/` و`functions/`, يولّد `sitemap.xml`, `robots.txt`, `_headers`, `_routes.json`. يحقن لكل موقع متغيّرات الألوان `--c1/--c2` في `<style>`.
- `build/render.mjs`: قوالب HTML كاملة (head/SEO/hreflang/JSON-LD، nav، footer، الصفحة الرئيسية، الشبكة، الأسعار، الخصوصية، شروط الاستخدام العادل، اتصال، login/register/app، 404/410). أسماء الصفحات: `urlFor()` هي التي تحدد المسارات (`/` للإنجليزية و`/ar/` للعربية).
- `build/util.mjs`: `escapeHtml` و`loc` (توطين نص/كائن).

### `functions/` — المحرك
| الملف | الوظيفة |
|---|---|
| `functions/_middleware.js` | نقطة الدخول لكل الطلبات → `engine.handle()` |
| `functions/_lib/engine.js` | التوجيه + `shorten` + `resolve` (تحويل 302) + `contact` + `billingWebhook` + `health` + صفحات 404/410 |
| `functions/_lib/links.js` | مسارات الحساب والروابط: `handleAuthRoute`, `handleLinksRoute`, `handleLookup`, `handleStatsRoute`, حدود الخطط |
| `functions/_lib/auth.js` | PBKDF2 (**100,000 دورة كحد أقصى على Workers**)، جلسات، كوكي، حماية Origin |
| `functions/_lib/site-config.js` | **مُتتبَّع في Git** — قائمة `NETWORK` + `siteFor(host)` (ضروري لأن Cloudflare يبني functions من جذر المستودع) |

### `assets/` — التصميم
| الملف | الوظيفة |
|---|---|
| `styles.css` | نظام التصميم كاملاً: متغيّرات shadcn (zinc) + مكوّنات + الوضع الداكن + الوضع الفاتح في الأسفل + مبدّل الثيمات |
| `theme-light.css` | ملف فارغ (التصميم داكن/فاتح في styles.css) |
| `extra.css` | ملف فارغ (احتياطي) |
| `theme.js` | محرك الثيم (light/dark/system + `?theme=` + localStorage `comly-theme`) |
| `app.js` | نموذج الاختصار + النسخ + QR + العدّادات + إظهار الأقسام عند التمرير + قائمة الجوال |
| `account.js` | تسجيل/دخول + لوحة `/app` (روابط، حذف، نسخ، إحصائيات، رسم بياني من `/api/stats`) |

### `d1/schema.sql` — قاعدة البيانات
9 جداول: `links` (فيها `workspace_id`), `daily_stats`, `contact_messages`, `users`, `sessions`, `workspaces`, `custom_domains`, `subscriptions`, `api_keys`.

### `scripts/`
- `scripts/serve.mjs` — معاينة محلية للبناء الحقيقي مع API وهمي في الذاكرة: `node scripts/serve.mjs commly 4174`.
- `scripts/matrix.mjs` — يولّد مصفوفة أسماء المواقع لـGitHub Actions.

### `tools/`
- `tools/engine-test.mjs` — **27 اختبار** للمحرك (بدون Cloudflare، بمحاكي D1/KV). شغّله: `node tools/engine-test.mjs`.
- `tools/verify-build.mjs` — **40 اختبار** نهاية-لنهاية على الخادم المحلي (يتطلب `npm run serve` على 4174).
- `tools/dom-test.mjs` — اختبارات النموذج القديم (prototype).
- `tools/screenshots.mjs` — لقطات بلا واجهة (يتطلب playwright + متصفح؛ لم يُثبَّت المتصفح).

### `docs/`
- `docs/DEPLOY-AR.md` — دليل النشر على Cloudflare Pages خطوة بخطوة.
- `docs/BUSINESS-MODEL-AR.md` — تحليل المنافسين والأسعار وخطط التسعير.
- `docs/FREE-STACK-AR.md` — كل الخدمات المجانية المستخدمة.
- `docs/HANDOFF-AR.md` — **هذه الوثيقة**.

### `.github/workflows/deploy.yml`
نشر تلقائي بمصفوفة: لكل موقع مشروع Pages `comly-<site-id>`، مع البناء `node build/build.mjs --site=<site-id>` والدفع عبر wrangler action. (غير مستخدم حالياً لأن النشر يدوي يعمل).

---

## 5) الروابط الحية والمعرّفات

| المورد | الرابط / القيمة |
|---|---|
| الإنتاج (إنجليزي) | https://comm-ly.pages.dev |
| العربية | https://comm-ly.pages.dev/ar/ |
| الأسعار | https://comm-ly.pages.dev/pricing |
| تسجيل الدخول | https://comm-ly.pages.dev/login |
| إنشاء حساب | https://comm-ly.pages.dev/register |
| لوحة الحساب | https://comm-ly.pages.dev/app |
| صفحة الشبكة | https://comm-ly.pages.dev/network |
| فحص صحي | https://comm-ly.pages.dev/api/health |
| آخر نشر معروف | `f099ee7c` ثم `7d5fadf4` (بعد إصلاح PBKDF2) — يمكن التحقق من `wrangler pages deployment list` |
| حساب Cloudflare | https://dash.cloudflare.com/a9509f6a5546f386be2fd780ba517efb |
| مشروع Pages | Workers & Pages → `comm-ly` |
| قاعدة D1 | Storage & Databases → D1 → `comly` |
| KV | Workers & Pages → KV → `CACHE` |

---

## 6) ما يعمل الآن (تم التحقق منه فعلياً على الإنتاج)

آخر اختبار E2E على `https://comm-ly.pages.dev` — كل النتائج نجحت:

| الاختبار | النتيجة |
|---|---|
| `/api/health` | ✅ 200 |
| الصفحات: `/`, `/ar/`, `/pricing/`, `/login/`, `/app/`, `/network/` | ✅ 200 جميعها |
| اختصار رابط جديد `POST /api/shorten` | ✅ 201 + رابط قصير |
| فتح الرابط القصير | ✅ 302 إلى الوجهة |
| إنشاء حساب جديد | ✅ 201 |
| `GET /api/auth/me` | ✅ 200 |
| إنشاء رابط من الحساب | ✅ 201 |
| قائمة الروابط + حدود الخطة | ✅ 200 |
| إحصائيات 14 يوماً `GET /api/stats` | ✅ 200 |
| حذف رابط | ✅ 200 |
| تسجيل الدخول بحساب موجود | ✅ 200 |

**ملاحظات:** تم تنظيف قاعدة البيانات من بيانات الاختبار (`users=0, links=0`). الجداول موجودة (9 جداول). Bindings مضبوطة على مشروع `comm-ly`: D1 `DB` + KV `CACHE`.

---

## 7) ما لم يُنجز بعد (خطة العمل التالية)

مرتبة حسب الأولوية:

1. **نشر المحركات الستة** (`n3, n4, n6, n7, n8, n9`) كمشاريع Pages:
   - لكل محرك: `node build/build.mjs --site=n3` ثم `wrangler pages deploy dist/n3 --project-name=comly-n3 --branch=main`.
   - ربط نفس `DB` و`CACHE` في إعدادات كل مشروع (Settings → Functions → Bindings) — أو عبر API.
   - إضافة نطاقاتها لاحقاً (DNS) عندما تقرر.
2. **ربط نطاق `comm.ly` الحقيقي** كمشروع Pages مستقل (حالياً الموقع فقط على `comm-ly.pages.dev`). يمكن أيضاً إضافة نطاق مخصص لمشروع `comm-ly` مباشرة.
3. **الأدوات التفاعلية لكل محرك** — أهم شيء للسيو والزيارات:
   - 3.com.ly: مولّد QR تفاعلي
   - 4.com.ly: منشئ روابط UTM
   - 6.com.ly: اختصار جماعي (لصق قائمة/CSV)
   - 7.com.ly: API Playground حقيقي
   - 8.com.ly: فاحص/موسّع روابط (يستخدم `/api/lookup`)
   - 9.com.ly: منشئ صفحة بايو (يحتاج جدول/مسار إضافي)
4. **لوحة إدارة `/admin`** — مراجعة الروابط المسيئة ورسائل الاتصال (جدول `contact_messages` موجود).
5. **البريد:** رابط سحري للدخول + إشعارات نموذج الاتصال (Resend مجاني). حالياً الاتصال يُخزَّن في D1 فقط.
6. **الدفع:** ربط منصة الدفع عبر `POST /api/billing/webhook` (جاهز) + صفحة ترقية + Adapter. (المزوّد لم يُحدد نهائياً بعد.)
7. **محتوى وSEO:** مقالات عربية/إنجليزية، صور OG، Search Console، سايت ماب لكل نطاق بعد ربط النطاقات.
8. **تحسينات تقنية:** Turnstile، قوائم حظر للتصيّد، لوحة تحليلات أعمق، تصدير CSV، إدارة النطاقات المخصصة للعملاء (Cloudflare for SaaS).

---

## 8) أوامر التشغيل والبناء والنشر

```powershell
cd "C:\Link shortening platform"

# تثبيت التبعيات (مرة واحدة)
npm install

# بناء كل المواقع → dist/<site-id>
node build/build.mjs

# بناء موقع واحد
node build/build.mjs --site=commly

# معاينة محلية للبناء الحقيقي (API وهمي)
node scripts/serve.mjs commly 4174     # ثم افتح http://127.0.0.1:4174
node scripts/serve.mjs n3 4175         # معاينة محرك

# اختبارات المحرك (بدون Cloudflare)
node tools/engine-test.mjs

# اختبارات البناء (يتطلب تشغيل serve.mjs أولاً على 4174)
node tools/verify-build.mjs

# النشر على Cloudflare Pages (مشروع comm-ly)
node node_modules/wrangler/bin/wrangler.js pages deploy dist/commly --project-name=comm-ly --branch=main

# حالة الموارد
node node_modules/wrangler/bin/wrangler.js whoami
node node_modules/wrangler/bin/wrangler.js d1 list
node node_modules/wrangler/bin/wrangler.js pages project list
```

**النشر عبر Git (بديل):** ادفع إلى GitHub → Cloudflare يبني المشروع بـ:
- Build command: `node build/build.mjs --site=commly`
- Build output directory: `dist/commly`

---

## 9) نظام التصميم (مهم عند التعديل)

- **الاتجاه:** shadcn/ui — خلفية `#09090b`، حدود `#27272a`، أزرار بيضاء/نص أسود، Radius 8px، خطوط: `Inter` للإنجليزي و`Rubik` للعربي و`JetBrains Mono` للأرقام/الأكواد.
- **الثيمات:** فاتح/داكن/حسب النظام. المبدّل في `nav-actions`، والمحرك في `assets/theme.js`. يدعم `?theme=light|dark|system`. المتغيّرات كلها CSS variables في `assets/styles.css` (الوضع الفاتح مُعرَّف في أسفل الملف تحت `html[data-theme='light']`).
- **الألوان الخاصة بكل موقع:** `--c1` و`--c2` تُحقن في `<style>` من `build/build.mjs` (شعار الشبكة والبطاقات فقط). الواجهة العامة محايدة.
- **لوحة `/app`:** تخطيط Tabler (شريط جانبي + KPI + جدول + شارت). رسم الشارت يُبنى في `account.js` من `/api/stats`.
- **لا تُعِد إدخال التصميم القديم** (`prototype/` مرجع فقط، ألوان gradients/glow القديمة مرفوضة).

---

## 10) المحرك والـAPI — المرجع الكامل

### الصفحات (Static)
`/` إنجليزي · `/ar/` عربي · `/network/` و`/ar/network/` · `/pricing/` و`/ar/pricing/` (لـcomm.ly فقط) · `/privacy/` · `/terms/` · `/contact/` · `/login/` · `/register/` · `/app/` · `404.html` · `410.html` · `sitemap.xml` · `robots.txt`.

### API
| المسار | الطريقة | الوظيفة |
|---|---|---|
| `/api/health` | GET | حالة المحرك |
| `/api/shorten` | POST | اختصار رابط `{url, slug?, expiresIn?}` → `{shortUrl, code, expiresAt, network}` |
| `/api/contact` | POST | نموذج الاتصال → D1 |
| `/api/lookup?url=` | GET | فحص/توسيع رابط من نطاقات الشبكة |
| `/api/auth/register` | POST | `{name, email, password}` → 201 + كوكي جلسة |
| `/api/auth/login` | POST | `{email, password}` |
| `/api/auth/logout` | POST | إنهاء الجلسة |
| `/api/auth/me` | GET | بيانات المستخدم + الخطة + الاستخدام |
| `/api/links` | GET/POST | قائمة/إنشاء روابط (يتطلب جلسة) |
| `/api/links/:code` | DELETE/PATCH/GET | حذف/تعطيل/إحصاءات (ملكية فقط) |
| `/api/stats` | GET | سلسلة 14 يوماً + إجماليات |
| `/api/billing/webhook` | POST | تحديث الاشتراك (يتطلب `BILLING_WEBHOOK_SECRET`) |

### حدود الخطط (في `functions/_lib/links.js`)
`free`: 200 رابط/شهر · 10k نقرة · 0 نطاق · `pro`: 10k/100k/3 · `business`: 100k/500k/10 · `agency`: 1M/2M/100 · `enterprise`: بلا حدود.

### آلية الاختصار
1. POST `/api/shorten` → تحقق URL (يمنع localhost/الشبكات الخاصة/روابط الشبكة نفسها) + كود عشوائي أو مخصص + إدخال D1 + كتابة KV.
2. GET `/:code` → قراءة KV (أو D1) → 302، مع تسجيل النقرة في `daily_stats` و`links.clicks` عبر `waitUntil`.
3. الرابط نفسه يعمل على كل نطاقات الشبكة لأن D1 مشتركة.

---

## 11) الأسرار والاعتمادات — ما هو صالح وما لا

| الاعتماد | الحالة |
|---|---|
| **wrangler OAuth** | ✅ مسجّل ويعمل (token محفوظ في `...\xdg.config\.wrangler\config\default.toml`). الأوامر `wrangler whoami / d1 / pages` تعمل. |
| `.secrets/cloudflare-account-id.txt` | ✅ صالح (نصي، ليس سراً حقيقياً) |
| `.secrets/cloudflare-token.txt` | ⚠️ غير مطلوب حالياً — لا تعتمد عليه ما دام wrangler OAuth يعمل |
| `.secrets/github-token.txt` | ❌ قديم/مُبطَل — احذفه إن لم تستخدمه |
| **GitHub push** | يتم عبر GitHub Desktop أو توكن جديد إن لزم. `origin` مضبوط على `https://github.com/Gamingmonster2/comm.ly.git` |

**قاعدة ذهبية:** أي سر جديد يُوضع في `.secrets/` فقط، ولا يُكتب داخل كود أو commit.

---

## 12) أخطاء شائعة وحلولها (دروس مستخلصة)

| المشكلة | السبب | الحل |
|---|---|---|
| `Pbkdf2 failed: iteration counts above 100000 are not supported` | Workers يقصّ PBKDF2 عند 100,000 | استخدم 100,000 كحد أقصى (مضبوط في `auth.js`) |
| `Could not resolve "./site-config.js"` أثناء بناء Pages Functions | Cloudflare يبني `functions/` من **جذر المستودع** وليس من `dist/` | `functions/_lib/site-config.js` يجب أن يبقى **مُتتبَّعاً في Git** (وهو كذلك). لا تولّده فقط في dist. |
| `(fixes is not a valid attribute name: .gitattributes:1` | BOM في بداية `.gitattributes` | أعد كتابته بـUTF-8 بدون BOM |
| الصفحات تظهر بيضاء/فارغة | كلاس `.reveal` يخفي العناصر ولا يوجد سكربت يزيلها | الإصلاح موجود: `app.js` يضيف `.in`، وCSS يجعل `.reveal` مرئياً افتراضياً |
| الثيم الفاتح لا يعمل | ملف `theme-light.css` فارغ مقصود؛ الفاتح معرّف في `styles.css` | عدّل `html[data-theme='light']` هناك |
| تغيير Bindings لا يُطبَّق | تغييرات Bindings تحتاج نشراً جديداً | بعد الحفظ: Deployments → Create deployment (وليس Retry فقط) |
| `Retry deployment` ينشر نسخة قديمة | Retry يعيد نفس الـcommit | استخدم **Create deployment** من أحدث commit، أو انشر مباشرة بـ`wrangler pages deploy` |
| مشروع Git-connected وتعذّر الرفع المباشر | بعض المشاريع لا تقبل Direct Upload | الدفع عبر Git (GitHub Desktop) ثم بناء Cloudflare |
| ظهور مجلدات غريبة في `git status` | مجلدات مشاريع أخرى داخل نفس المسار | مستثناة في `.gitignore` (`Cyber Michelangelo/`, `acl-recovery/`, `stream.com.ly/`); أضف أي مجلد جديد للاستثناء ولا ترفعه |
| `wrangler` يُنشئ ملفات في `.wrangler/` | كاش/إعداد محلي | مستثنى من Git — طبيعي |

---

## 13) الاختبارات — الحالة الحالية

```powershell
node tools/engine-test.mjs     # 27 اختباراً — كلها ناجحة (لا يحتاج Cloudflare)
node tools/verify-build.mjs    # 40 اختباراً — يتطلب: node scripts/serve.mjs commly 4174
```

> `verify-build` يتحقق من: الصفحات، اللغتين، الأسعار، الشبكة، لوحة الحساب، `_routes.json`، sitemap، الاختصار، التحويل، رفض URL الخبيث، الاتصال.

---

## 14) سجل الـcommits المهمة (Git log)

| Commit | الوصف |
|---|---|
| `a6599b8` | الأساس: مستودع + 7 مواقع + محرك D1/KV + نشر + وثائق |
| `318c408` | دمج Initial commit من GitHub (LICENSE) |
| `7326fed` | الحسابات: auth + جلسات + `/app` + إدارة روابط + حدود خطط + webhook دفع |
| `e953c0a` | خطوط Rubik + تهدئة التوهجات (خطوة تصميم) |
| `135b8f1` | خلفية نهاري أهدأ |
| `875fb7d` | إعادة تصميم كاملة shadcn الداكن + Tabler + إنجليزي أساسي |
| `2de94f9` | الوضع الفاتح + الداكن + حسب النظام (مبدّل الثيمات) |
| `d44e1df` | إصلاح PBKDF2 100k + اختبار E2E حي (**غير مدفوع بعد**) |

**قبل البدء:** شغّل `git status` وتأكد. إن كان هناك commit غير مدفوع ادفعه عبر GitHub Desktop أو توكن.

---

## 15) نصائح للوكيل الجديد (اقرأها قبل أي تعديل)

1. **لا تلمس `prototype/`** — مرجع تصميم قديم فقط ولا يُنشر.
2. **ابدأ من `sites/registry.mjs`** عند أي تغيير في المحتوى أو الأسعار أو إضافة نطاق.
3. **بعد أي تعديل:** `node build/build.mjs` ثم `node tools/engine-test.mjs`، وتأكد من نجاح `tools/verify-build.mjs` (بتشغيل serve).
4. **لا تكتب أسراراً في الكود** — استخدم `.secrets/` أو `wrangler secret`/متغيرات Cloudflare.
5. **قبل النشر:** ابنِ وشغّل المعاينة المحلية، وتأكد أن صفحة الاختصار تعمل.
6. **النشر:** `wrangler pages deploy dist/commly --project-name=comm-ly --branch=main` (يعمل مباشرة على المشروع الحالي).
7. **بعد النشر:** اختبر `https://comm-ly.pages.dev/api/health` و`/api/shorten` فعلياً (bash/node fetch) قبل إعلان النجاح.
8. **إن أضفت نطاقاً:** أضفه في `registry` + مشروع Pages جديد + نفس Bindings (DB/CACHE) + أضف النطاق من Cloudflare.
9. **الأسرار المالية/الدفع** لم تُفعَّل بعد؛ لا تبنِ تكاملات دفع دون قرار المزوّد.
10. **الملفات خارج المشروع** (`Cyber Michelangelo/`, `acl-recovery/`, `stream.com.ly/`, `snake/`) ليست جزءاً منه — تجاهلها.

---

## 16) الحالة النهائية باختصار (تحديث 2026-11-19)

- ✅ الموقع الرئيسي حي: https://comm-ly.pages.dev (و`/ar/`).
- ✅ المحركات الستة منشورة ومربوطة بنفس `DB` و`CACHE`:
  - https://comly-n3.pages.dev — مولّد QR
  - https://comly-n4.pages.dev — منشئ UTM
  - https://comly-n6.pages.dev — اختصار جماعي
  - https://comly-n7.pages.dev — ملعب API
  - https://comly-n8.pages.dev — فاحص الروابط
  - https://comly-n9.pages.dev — منشئ صفحة بايو
- ✅ الأدوات التفاعلية الستة مكتملة وتعمل محلياً وعلى الإنتاج (بدون مكتبات خارجية).
- ✅ تصميم shadcn/Magic UI موحّد على كل المواقع، مع ثيمات داكن/فاتح/نظام.
- ✅ جداول D1 محدّثة (10 جداول، منها `bio_pages`) على الإنتاج.
- ✅ اختبارات محلية وحيّة ناجحة: `engine-test`, `qr-test`, `check-utm-bulk`, `check-api-lookup`, `check-bio`, `check-tool-contract`, `verify-build`, `verify-live`.
- 🟡 النطاقات المخصصة (`3.com.ly` … `9.com.ly`) لم تُر بعد؛ الروابط الحية على `*.pages.dev`.
- 🔴 لوحة `/admin`، البريد، الدفع، والمحتوى التحريري لا تزال خطة لاحقة.

### النشر بعد أي تعديل

```powershell
cd "C:\Link shortening platform"
node build/build.mjs
node scripts/deploy.mjs commly n3 n4 n6 n7 n8 n9
node tools/verify-live.mjs
```

`scripts/deploy.mjs` يكتب مؤقتاً `pages_build_output_dir` + Bindings في `wrangler.toml` ثم يستعيد الملف الأصلي، وينشر من جذر المشروع حتى تُضمّن Functions. لا تستخدم `--config` مع Pages (غير مدعوم)، ولا تحذف `--force` عند إنشاء مشروع Pages جديد عبر Wrangler.

---

*آخر تحديث لهذه الوثيقة: بعد اكتمال الأدوات الستة ونشر كل المواقع على Cloudflare Pages ونجاح الفحص الحي.*
