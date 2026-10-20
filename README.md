# comm.ly network — منصة اختصار الروابط

شبكة من عدة مواقع اختصار روابط تعمل بمحرك واحد وقاعدة بيانات واحدة:

- **comm.ly** — العلامة الأساسية للمشروع (المنتج، الأسعار، الحساب، لوحة التحكم، API).
- **المحركات** — نطاقات بهوية ومحتوى وأدوات مستقلة (3/4/6/7/8/9) ويمكن إضافة أي نطاقات جديدة لاحقاً.
- أي رابط مختصر يعمل على **كل نطاقات الشبكة** (احتياطي موزّع) — والبيانات مشتركة في D1.

**معاينة النموذج التصميمي:** `npm run preview:prototype` → http://127.0.0.1:4173 (ولوحة التحكم: `/dashboard`).
**معاينة البناء الحقيقي:** `npm run build && npm run serve` → http://127.0.0.1:4174

---

## بنية المستودع

```
sites/registry.mjs           ← المصدر الوحيد للحقيقة: العلامة، النطاقات، الخطط، المحتوى
build/build.mjs              ← يبني dist/<site-id>/ (HTML ثابت عربي/إنجليزي + sitemap + robots + headers)
build/render.mjs             ← قوالب الصفحات (هبوط، شبكة، أسعار، خصوصية، شروط، اتصال)
functions/_middleware.js     ← محرك Cloudflare Pages Functions (اختصار + تحويل + اتصال)
functions/_lib/engine.js     ← منطق الاختصار والتحويل على D1/KV
d1/schema.sql                ← جداول D1 (روابط، نقرات، رسائل، وجداول المرحلة 2)
assets/                      ← نظام التصميم والثيمات (فاتح افتراضي + ليلي + حسب النظام)
.github/workflows/deploy.yml ← نشر تلقائي: مشروع Pages لكل نطاق
docs/                        ← الخطة، نموذج العمل، دليل النشر
scripts/serve.mjs            ← معاينة محلية للبناء الحقيقي (API وهمي في الذاكرة)
prototype/                   ← النموذج التصميمي الأصلي (مرجع بصري)
```

## التشغيل المحلي

```bash
npm run build          # بناء كل المواقع
npm run serve          # معاينة comm.ly على http://127.0.0.1:4174
node scripts/serve.mjs n3 4175   # معاينة محرك آخر
```

## إضافة نطاق جديد للشبكة

1. أضف كائناً جديداً في `sites/registry.mjs` (id, host, mark, colors, المحتوى).
2. `npm run build` ثم اربط النطاق بمشروعه في Cloudflare Pages.
3. لا حاجة لتغيير أي كود آخر — الصفحات والشبكة والـsitemap تتحدث تلقائياً.

## النشر على Cloudflare Pages

راجع [docs/DEPLOY-AR.md](docs/DEPLOY-AR.md): مشروع Pages لكل نطاق من نفس المستودع، وكلها تقرأ من نفس D1.
نموذج الدفع والاشتراكات سيكون مستقلاً عن المزوّد (`/api/billing/webhook` + جدول subscriptions) لتوصيل منصة الدفع الجاهزة لاحقاً.

## الوثائق

- [docs/FREE-STACK-AR.md](docs/FREE-STACK-AR.md) — كل ما نحتاجه مجاناً (Cloudflare، GitHub، الأدوات).
- [docs/BUSINESS-MODEL-AR.md](docs/BUSINESS-MODEL-AR.md) — تحليل المنافسين، الخطط والأسعار، والإجابات المعمارية.
