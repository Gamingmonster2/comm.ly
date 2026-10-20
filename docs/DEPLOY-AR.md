# النشر على Cloudflare Pages — دليل عملي

المستودع يبني **مشروع Pages واحداً لكل نطاق** من نفس الكود، وكلها تتشارك نفس قاعدة D1 وKV.
عدد المشاريع الحالي: **7** (comm.ly + ستة محركات). إضافة نطاق لاحقاً = إضافة كائن في `sites/registry.mjs` + مشروع Pages جديد.

## 0) المتطلبات (مجانية)

- حساب GitHub واستيراد المستودع إليه.
- حساب Cloudflare (النطاقات `.com.ly` مُدارة فيه بالفعل عبر `ian/nancy.ns.cloudflare.com`).
- في لوحة Cloudflare: **D1** (قاعدة واحدة) و**KV** (مساحة واحدة) للشبكة كلها.

## 1) إنشاء قاعدة البيانات والكاش

```bash
npm i -D wrangler
npx wrangler login
npx wrangler d1 create comly
npx wrangler d1 execute comly --remote --file=./d1/schema.sql
npx wrangler kv namespace create CACHE
```

احفظ `database_id` و`id` الخاصين بـKV من مخرجات الأوامر.

## 2) إنشاء مشاريع Pages وربطها بالمستودع

لكل site في القائمة: `commly`, `n3`, `n4`, `n6`, `n7`, `n8`, `n9`

1. Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. اختر المستودع، واسم المشروع: **`comly-<site-id>`** (مثال: `comly-commly`, `comly-n3`).
3. إعدادات البناء:
   - Build command: `node build/build.mjs --site=<site-id>`
   - Build output directory: `dist/<site-id>`
4. بعد أول نشر → **Settings → Functions → Bindings**:
   - D1 database: `DB` → `comly`
   - KV namespace: `CACHE` → (الاسم الذي أنشأته)
5. **Custom domains** → أضف نطاق الموقع:
   - `comm.ly` للمشروع `comly-commly`
   - `3.com.ly` ... إلخ لكل محرك.
   - Cloudflare يضيف سجل DNS تلقائياً (النطاقات مُدارة هناك) ويصدر شهادة SSL.

> بديل: النشر عبر GitHub Actions — أضف `CLOUDFLARE_API_TOKEN` (صلاحية Pages/D1/KV) و`CLOUDFLARE_ACCOUNT_ID` في **Settings → Secrets and variables → Actions**، وسيقوم [deploy.yml](../.github/workflows/deploy.yml) ببناء ونشر السبعة تلقائياً عند كل push.

## 3) الربط بين المشاريع

- كل المشاريع تقرأ من نفس `DB` و`CACHE` → **أي رابط مختصر يعمل على كل النطاقات** تلقائياً.
- لا حاجة لأي متغير بيئة إضافي: إعداد كل موقع يُحقن وقت البناء في `dist/<site>/functions/_lib/site-config.js`.

## 4) التحقق بعد النشر

```bash
# 1) صفحة صحية
curl https://comm.ly/api/health
# 2) اختصار رابط
curl -X POST https://comm.ly/api/shorten \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","expiresIn":24}'
# 3) تحويل الرابط الناتج
curl -I https://comm.ly/<code>
# 4) نفس الرابط على نطاق آخر (شبكة موحّدة)
curl -I https://3.com.ly/<code>
```

## 5) بعد النشر — قائمة سريعة

- [ ] Search Console: أضف كل نطاق وارسل `sitemap.xml`.
- [ ] UptimeRobot: راقب `/api/health` للنطاق الأساسي.
- [ ] Email Routing: `support@comm.ly` و`legal@comm.ly`.
- [ ] حدّث بريد الدعم في `sites/registry.mjs`.
- [ ] أضف `ADMIN_PASSWORD` و`ADMIN_SECRET` كأسرار عند بناء لوحة الإدارة (المرحلة 2).

## ملاحظات حدود الطبقة المجانية

- Pages: 500 عملية بناء/شهر · Functions: 100,000 طلب/يوم لكل مشروع · D1: 5GB و100k كتابة/يوم · KV: 100k قراءة/يوم.
- ملف `_routes.json` المُولَّد يستثني الصفحات الثابتة من استدعاء Functions، فلا يستهلك الكوتا إلا صفحات الاختصار والـAPI.
- لا تنسَ أن مشروع Pages المجاني يحتاج **ربط Git** أو نشر CLI؛ كلا الطريقتين مدعومتان هنا.
