/**
 * Comly Network — Site registry (single source of truth)
 * ------------------------------------------------------
 * Add a new domain later = add one object here + deploy it.
 * The build script, sitemap, network page, workflow matrix and
 * deploy tooling all derive from this file.
 *
 * Brand architecture:
 *  - comm.ly        → the brand / main product (marketing, pricing, app, API, legal)
 *  - *.engines      → independently branded network engines (same shortening engine,
 *                     same shared D1 links, unique content/tools per domain)
 */

const t = (ar, en) => ({ ar, en });

export const brand = {
  name: 'comm.ly',
  host: 'comm.ly',
  url: 'https://comm.ly',
  networkName: 'comm.ly network',
  networkNameAr: 'شبكة comm.ly',
  founded: 2026,
  supportEmail: 'support@comm.ly',
  legalEmail: 'legal@comm.ly',
  plansPath: '/pricing/'
};

/* ------------------------------------------------------------------ */
/* Plans — rendered on comm.ly/pricing (AR + EN)                       */
/* ------------------------------------------------------------------ */
export const plans = [
  {
    id: 'free',
    name: t('المجاني', 'Free'),
    price: '$0',
    period: t('للأبد', 'forever'),
    desc: t('ابدأ بلا تسجيل. كل ما تحتاجه لاختصار الروابط ومشاركتها وقياسها.', 'Start without sign-up. Everything you need to shorten, share and measure.'),
    cta: t('ابدأ الآن', 'Start now'),
    href: '#shorten',
    featured: false,
    features: [
      t('200 رابط جديد شهرياً', '200 new links / month'),
      t('10 آلاف نقرة موثقة شهرياً', '10K tracked clicks / month'),
      t('العمل على نطاقات الشبكة الستة', 'Works across all network domains'),
      t('أكواد QR أساسية', 'Basic QR codes'),
      t('تحليلات 30 يوماً', '30-day analytics'),
      t('بدون إعلانات بينية أبداً', 'Never any interstitial ads')
    ]
  },
  {
    id: 'pro',
    name: t('Pro — أفراد ومبدعون', 'Pro — individuals & creators'),
    price: '$4',
    period: t('/شهر أو 36$/سنة', '/month or $36/year'),
    desc: t('للمحترفين الذين يريدون علامتهم وتحليلاتهم الكاملة.', 'For professionals who want their brand and full analytics.'),
    cta: t('ابدأ التجربة', 'Start free trial'),
    href: '#',
    featured: true,
    features: [
      t('روابط غير محدودة', 'Unlimited links'),
      t('100 ألف نقرة موثقة شهرياً', '100K tracked clicks / month'),
      t('3 نطاقات مخصصة خاصة بك', '3 custom branded domains'),
      t('تاريخ تحليلات سنة كاملة', '1 year of analytics history'),
      t('إزالة علامة «Powered by comm.ly»', 'Remove the "Powered by comm.ly" badge'),
      t('استهداف جغرافي وأجهزة + كلمات مرور', 'Geo/device targeting + password links')
    ]
  },
  {
    id: 'business',
    name: t('Business — أعمال', 'Business'),
    price: '$12',
    period: t('/شهر أو 108$/سنة', '/month or $108/year'),
    desc: t('للفرق الصغيرة والمتاجر التي تدير روابط كل يوم.', 'For small teams and stores running links every day.'),
    cta: t('ابدأ التجربة', 'Start free trial'),
    href: '#',
    featured: false,
    features: [
      t('5 مستخدمين ومساحات عمل', '5 users & workspaces'),
      t('500 ألف نقرة موثقة شهرياً', '500K tracked clicks / month'),
      t('10 نطاقات مخصصة', '10 custom domains'),
      t('تتبع التحويلات و Webhooks', 'Conversion tracking + webhooks'),
      t('أكواد QR بدفعات', 'Bulk QR codes'),
      t('دعم بريدي خلال 24 ساعة', 'Email support within 24h')
    ]
  },
  {
    id: 'agency',
    name: t('Agency — وكالات', 'Agency'),
    price: '$39',
    period: t('/شهر أو 348$/سنة', '/month or $348/year'),
    desc: t('علامة بيضاء كاملة لوكالات التسويق وإدارة عملاء متعددين.', 'Full white-label for agencies managing many clients.'),
    cta: t('تواصل معنا', 'Talk to us'),
    href: '#contact',
    featured: false,
    features: [
      t('20 مساحة عملاء مستقلة', '20 client workspaces'),
      t('نطاقات مخصصة بلا حدود', 'Unlimited custom domains'),
      t('علامة بيضاء كاملة (بلا أي علامة لنا)', 'Fully white-label'),
      t('ميغا نقرات (2 مليون/شهر)', '2M tracked clicks / month'),
      t('API حتى مليون طلب شهرياً', 'API up to 1M requests / month'),
      t('دعم أولوية + WhatsApp', 'Priority support + WhatsApp')
    ]
  },
  {
    id: 'enterprise',
    name: t('Enterprise — مؤسسات', 'Enterprise'),
    price: t('مخصص', 'Custom'),
    period: t('تفاوض', 'custom'),
    desc: t('للمؤسسات التي تحتاج SSO واتفاقية مستوى خدمة وامتثالاً.', 'For organizations needing SSO, SLA and compliance.'),
    cta: t('اطلب عرضاً', 'Request a quote'),
    href: '#contact',
    featured: false,
    features: [
      t('تسجيل دخول موحّد SSO', 'SAML / SSO'),
      t('اتفاقية مستوى خدمة SLA', 'Custom SLA'),
      t('سجلات تدقيق وامتثال', 'Audit logs & compliance'),
      t('مدير حساب مخصص', 'Dedicated account manager'),
      t('نطاقات ومساحات غير محدودة', 'Unlimited domains & workspaces'),
      t('دعم Slack مباشر', 'Private Slack support')
    ]
  }
];

export const addons = [
  t('نطاق مخصص إضافي — 1.5$/شهر', 'Extra custom domain — $1.5/mo'),
  t('حزمة 100 ألف نقرة إضافية — 3$', '100K extra clicks pack — $3'),
  t('500 كود QR قابل للطباعة — 2$', '500 printable QR codes — $2'),
  t('ترحيل روابطك من خدمة أخرى — 19$ مرة واحدة', 'Migration from another service — $19 once'),
  t('خصم 5% عند الدفع بالعملات الرقمية', '5% discount when paying with crypto'),
  t('تسعير إقليمي مخفّض للدول العربية عند تفعيل الدفع المحلي', 'Regional pricing for Arab countries once local billing is live')
];

/* ------------------------------------------------------------------ */
/* Sites                                                               */
/* ------------------------------------------------------------------ */
export const sites = [
  {
    id: 'commly',
    host: 'comm.ly',
    role: 'main',
    mark: 'comet',
    name: 'comm.ly',
    colors: ['#0f766e', '#6d28d9'],
    accent3: '#db2777',
    defaultLang: 'ar',
    tool: t('محرك الاختصار + QR', 'Shortener + QR'),
    tagline: t('روابط أقصر، علامة أقوى.', 'Short links. Stronger brand.'),
    heroA: t('روابط أقصر،', 'Short links,'),
    heroB: t('علامة أقوى.', 'stronger brand.'),
    lead: t(
      'اختصار روابط بسرعة الحافة العالمية، تحليلات فورية، وأكواد QR — من شبكة comm.ly التي تعمل على عدة نطاقات كبنية واحدة.',
      'Edge-fast URL shortening, instant analytics and QR codes — from the comm.ly network, operating across multiple domains as one infrastructure.'
    ),
    metaTitle: t('comm.ly — اختصار الروابط بسرعة الحافة | شبكة comm.ly', 'comm.ly — Edge-fast URL shortening | The comm.ly network'),
    metaDesc: t(
      'اختصار روابط مجاني بلا إعلانات، تحليلات، أكواد QR، ونطاقات مخصصة. من comm.ly — العلامة الأساسية لشبكة اختصار الروابط.',
      'Free, ad-free URL shortening with analytics, QR codes and custom domains. From comm.ly — the home brand of the network.'
    ),
    features: [
      {
        title: t('سرعة الحافة', 'Edge speed'),
        desc: t('الروابط تُحلّ على أقرب نقطة حافة لزائرك — بلا خادم وسيط وبلا انتظار.', 'Links resolve at the edge closest to your visitor — no origin, no waiting.')
      },
      {
        title: t('بدون إعلانات', 'No ads'),
        desc: t('لا صفحات إعلانية بين الزائر وهدفه. روابطك تبقى روابطك.', 'No interstitial ad pages between your visitor and their destination.')
      },
      {
        title: t('نطاقات مخصصة', 'Custom domains'),
        desc: t('استخدم نطاقك الخاص على الخطط المدفوعة، مع SSL تلقائي.', 'Use your own branded domain on paid plans with automatic SSL.')
      }
    ],
    toolTitle: t('جرّب محرك الاختصار مباشرة', 'Try the engine right now'),
    toolDesc: t('الصق رابطك واحصل على رابط قصير يعمل على كل نطاقات الشبكة.', 'Paste a link and get a short URL that resolves on every network domain.'),
    faq: [
      { q: t('هل الخدمة مجانية؟', 'Is it free?'), a: t('نعم، الخطة المجانية سخية وبلا إعلانات: 200 رابط شهرياً وتحليلات 30 يوماً. الخطط المدفوعة تضيف النطاقات المخصصة والتحليلات الأعمق والفرق.', 'Yes — a generous, ad-free free plan with 200 links/month and 30-day analytics. Paid plans add custom domains, deeper analytics and teams.') },
      { q: t('ما علاقة comm.ly بالنطاقات الأخرى؟', 'How does comm.ly relate to the other domains?'), a: t('comm.ly هي العلامة الأساسية. بقية النطاقات محركات تابعة للشبكة تعمل على نفس المحرك وقاعدة البيانات، وتضيف مرونة واحتياطاً وسلطة سيو — يمكن إضافة نطاقات جديدة في أي وقت دون التأثير على الموقع الأساسي.', 'comm.ly is the home brand. The other domains are network engines sharing the same shortening engine and database — adding redundancy, resilience and SEO reach. New domains can be added anytime without touching the main site.') },
      { q: t('هل الروابط تنتهي؟', 'Do links expire?'), a: t('أنت تختار: 24 ساعة أو 7 أيام أو 30 يوماً أو بلا انتهاء.', 'You choose: 24 hours, 7 days, 30 days or never.') }
    ]
  },
  {
    id: 'n3',
    host: '3.com.ly',
    role: 'engine',
    mark: 'triangle',
    name: '3.com.ly',
    colors: ['#0d9488', '#8b5cf6'],
    accent3: '#f472b6',
    defaultLang: 'ar',
    tool: t('مولّد أكواد QR', 'QR code generator'),
    tagline: t('اختصار + QR في خطوة واحدة', 'Shorten + QR in one step'),
    heroA: t('رابط قصير،', 'Short link,'),
    heroB: t('أكواد QR جاهزة.', 'QR ready.'),
    lead: t('اختصار سريع مع توليد رمز QR لكل رابط — مثالي للمنيو والمطبوعات والحملات.', 'Fast shortening with a QR code for every link — perfect for menus, print and campaigns.'),
    metaTitle: t('3.com.ly — اختصار روابط ومولّد QR | شبكة comm.ly', '3.com.ly — URL shortener + QR generator | comm.ly network'),
    metaDesc: t('اختصار روابط سريع مع رمز QR لكل رابط. جزء من شبكة comm.ly.', 'Fast URL shortening with a QR code for every link. Part of the comm.ly network.'),
    features: [
      { title: t('QR لكل رابط', 'QR for every link'), desc: t('رمز قابل للتنزيل بمقاسات الطباعة مباشرة بعد الاختصار.', 'A downloadable, print-ready QR generated right after shortening.') },
      { title: t('سرعة عند الحافة', 'Edge fast'), desc: t('تحويل فوري على أقرب نقطة حافة.', 'Instant redirect at the nearest edge location.') },
      { title: t('مجاني بلا إعلانات', 'Free, no ads'), desc: t('بلا صفحات إعلانية ولا تسجيل إجباري.', 'No ad pages and no forced sign-up.') }
    ],
    toolTitle: t('حمّل رمز QR لأي رابط', 'Generate a QR for any link'),
    toolDesc: t('اختصار ثم تنزيل رمز QR — جاهز للطباعة أو العرض.', 'Shorten first, then download a QR ready for print or display.'),
    faq: [
      { q: t('هل أكواد QR مجانية؟', 'Are QR codes free?'), a: t('نعم، لكل رابط مختصر رمز QR أساسي مجاني، ويمكن تخصيصه بشعارك على الخطط المدفوعة.', 'Yes, every short link gets a free basic QR; logo customisation is available on paid plans.') },
      { q: t('هل يعمل الرابط على نطاقات أخرى؟', 'Does the link work on other domains?'), a: t('نعم، أي رابط من الشبكة يعمل على كل نطاقات شبكة comm.ly.', 'Yes — every network link resolves on all comm.ly network domains.') }
    ]
  },
  {
    id: 'n4',
    host: '4.com.ly',
    role: 'engine',
    mark: 'diamond',
    name: '4.com.ly',
    colors: ['#f59e0b', '#fb7185'],
    accent3: '#f97316',
    defaultLang: 'ar',
    tool: t('منشئ UTM للحملات', 'UTM campaign builder'),
    tagline: t('روابط حملات نظيفة وقابلة للقياس', 'Clean, measurable campaign links'),
    heroA: t('حملاتك،', 'Your campaigns,'),
    heroB: t('بروابط مقيسة.', 'measured links.'),
    lead: t('بناء روابط UTM منظمة لحملاتك — بلا فوضى ولا تكرار، مع تقارير موحدة.', 'Build tidy UTM links for every campaign — no clutter, no duplicates, unified reports.'),
    metaTitle: t('4.com.ly — منشئ روابط UTM للحملات | شبكة comm.ly', '4.com.ly — UTM campaign builder | comm.ly network'),
    metaDesc: t('منشئ UTM وروابط حملات نظيفة. جزء من شبكة comm.ly.', 'UTM builder and clean campaign links. Part of the comm.ly network.'),
    features: [
      { title: t('UTM منظم', 'Tidy UTMs'), desc: t('قوالب UTM جاهزة تمنع الأخطاء والتكرار.', 'UTM templates that prevent typos and duplicates.') },
      { title: t('أداء الحملات', 'Campaign performance'), desc: t('قارن المصدر والوسيط عبر جميع روابطك.', 'Compare source and medium across all your links.') },
      { title: t('جاهز للفريق', 'Team ready'), desc: t('مساحات عمل للإدارة والمطورين على خطة Business.', 'Workspaces for managers and developers on Business.') }
    ],
    toolTitle: t('ابنِ رابط حملتك الآن', 'Build your campaign link'),
    toolDesc: t('اختصار + وسوم UTM في خطوة واحدة، مع رابط يعمل على كل النطاقات.', 'Shorten + UTM tags in one step, resolving on every network domain.'),
    faq: [
      { q: t('ما فائدة UTM؟', 'Why UTM?'), a: t('تمييز مصادر الزيارات (واتساب، فيسبوك، بحث) بدقة في التحليلات.', 'To accurately attribute traffic sources (WhatsApp, Facebook, search).') },
      { q: t('هل أحتاج حساباً؟', 'Do I need an account?'), a: t('لا للبدء، والحساب يضيف حفظ القوالب والتقارير.', 'Not to start; an account adds saved templates and reports.') }
    ]
  },
  {
    id: 'n6',
    host: '6.com.ly',
    role: 'engine',
    mark: 'hexagon',
    name: '6.com.ly',
    colors: ['#a78bfa', '#60a5fa'],
    accent3: '#818cf8',
    defaultLang: 'ar',
    tool: t('اختصار جماعي للشركات', 'Bulk shorten for teams'),
    tagline: t('إدارة روابط الشركات من مكان واحد', 'Company links, one place'),
    heroA: t('روابط شركتك،', 'Your company links,'),
    heroB: t('تحت السيطرة.', 'under control.'),
    lead: t('اختصار جماعي للروابط ومجلدات ومساحات عمل للفرق — روابط منظمة وقابلة للمراجعة.', 'Bulk shortening, folders and team workspaces — organised, reviewable company links.'),
    metaTitle: t('6.com.ly — اختصار جماعي وإدارة روابط الشركات | شبكة comm.ly', '6.com.ly — Bulk shortening & team link management | comm.ly network'),
    metaDesc: t('اختصار جماعي للروابط ومساحات عمل للفرق. جزء من شبكة comm.ly.', 'Bulk link shortening and team workspaces. Part of the comm.ly network.'),
    features: [
      { title: t('اختصار جماعي', 'Bulk shorten'), desc: t('ارفع CSV وأختصر آلاف الروابط دفعة واحدة.', 'Upload CSV and shorten thousands of links at once.') },
      { title: t('مجلدات وصلاحيات', 'Folders & roles'), desc: t('تنظيم حسب الفريق أو الحملة مع صلاحيات دقيقة.', 'Organise by team or campaign with fine-grained roles.') },
      { title: t('تدقيق وتقارير', 'Audit & reporting'), desc: t('سجل عمليات وإحصاءات لكل رابط وقسم.', 'Activity log and stats per link and department.') }
    ],
    toolTitle: t('اختصر قائمة روابط دفعة واحدة', 'Shorten a list of links at once'),
    toolDesc: t('الصق حتى 100 رابط (سطر لكل رابط) واختصرها بتسميات منظمة.', 'Paste up to 100 links (one per line) and shorten them with tidy labels.'),
    faq: [
      { q: t('هل يوجد حد للاختصار الجماعي؟', 'Is there a bulk limit?'), a: t('المجاني حتى 100 رابط لكل دفعة، وBusiness يرفع الحد ويدعم CSV.', 'Up to 100 links per batch free; Business raises the limit and supports CSV.') },
      { q: t('هل بيانات الشركة معزولة؟', 'Are company links isolated?'), a: t('مساحات العمل تعزل الروابط بين الأقسام والعملاء.', 'Workspaces isolate links between departments and clients.') }
    ]
  },
  {
    id: 'n7',
    host: '7.com.ly',
    role: 'engine',
    mark: 'heptagon',
    name: '7.com.ly',
    colors: ['#34d399', '#facc15'],
    accent3: '#22c55e',
    defaultLang: 'en',
    tool: t('API Playground للمطورين', 'Developer API playground'),
    tagline: t('The link engine developers trust', 'The link engine developers trust'),
    heroA: t('Let the API', 'Let the API'),
    heroB: t('do the shortening.', 'do the shortening.'),
    lead: t('واجهة REST نظيفة، مفاتيح API، webhooks، وتوثيق كامل — لبناء الاختصار داخل منتجك.', 'A clean REST API, API keys, webhooks and full docs — shorten links inside your own product.'),
    metaTitle: t('7.com.ly — URL shortener API for developers | comm.ly network', '7.com.ly — URL shortener API for developers | comm.ly network'),
    metaDesc: t('URL shortener API: keys, webhooks, docs. Part of the comm.ly network.', 'URL shortener API with keys, webhooks and docs. Part of the comm.ly network.'),
    features: [
      { title: t('REST بسيط', 'Simple REST'), desc: t('نقطة واحدة للاختصار، وأكواد واضحة للأخطاء.', 'One endpoint to shorten, with clear error codes.') },
      { title: t('Webhooks', 'Webhooks'), desc: t('استقبل حدث إنشاء الرابط أو النقرة مباشرة.', 'Receive link and click events in real time.') },
      { title: t('توثيق كامل', 'Full docs'), desc: t('أمثلة cURL وJavaScript وPython جاهزة للنسخ.', 'Copy-ready cURL, JavaScript and Python examples.') }
    ],
    toolTitle: t('APIs حقيقية — جرّب الآن', 'Real APIs — try one now'),
    toolDesc: t('اضغط لتجربة طلب اختصار فعلي (Demo key) وشاهد الاستجابة.', 'Fire a real shorten request (demo key) and inspect the response.'),
    faq: [
      { q: t('هل توجد مفاتيح مجانية؟', 'Are API keys free?'), a: t('نعم، حتى 1,000 طلب شهرياً على الخطة المجانية، وحتى مليون على الوكالات.', 'Yes, 1,000 requests/month free and up to 1M on Agency.') },
      { q: t('هل يعمل في أي لغة برمجة؟', 'Does it work with any language?'), a: t('أي لغة تدعم HTTP/JSON تعمل مباشرة.', 'Any language that speaks HTTP/JSON works directly.') }
    ]
  },
  {
    id: 'n8',
    host: '8.com.ly',
    role: 'engine',
    mark: 'octagon',
    name: '8.com.ly',
    colors: ['#22d3ee', '#818cf8'],
    accent3: '#38bdf8',
    defaultLang: 'en',
    tool: t('Link safety checker', 'Link safety checker'),
    tagline: t('Open it safely. Share it confidently.', 'Open it safely. Share it confidently.'),
    heroA: t('Check before', 'Check before'),
    heroB: t('you click.', 'you click.'),
    lead: t('Expand, inspect and safety-check any short link before trusting it — for readers and brands alike.', 'Expand, inspect and safety-check any short link before trusting it — for readers and brands alike.'),
    metaTitle: t('8.com.ly — Short link checker & URL expander | comm.ly network', '8.com.ly — Short link checker & URL expander | comm.ly network'),
    metaDesc: t('Expand short links and check safety. Part of the comm.ly network.', 'Expand short links safely. Part of the comm.ly network.'),
    features: [
      { title: t('Expand safely', 'Expand safely'), desc: t('يرى الوجهة النهائية قبل فتحها، بلا تحويل فعلي.', 'See the final destination before opening, without a real redirect.') },
      { title: t('Safety signals', 'Safety signals'), desc: t('قوائم حظر وجودة HTTPS عمر النطاق.', 'Blocklists, HTTPS quality and domain age signals.') },
      { title: t('Built for share', 'Built for share'), desc: t('شارك الرابط بعد التحقق مع أصدقائك وفريقك.', 'Share the verified link with friends and teammates.') }
    ],
    toolTitle: t('Paste a short link to inspect it', 'Paste a short link to inspect it'),
    toolDesc: t('اختبر أي رابط مختصر قبل فتحه — النتيجة تشمل الوجهة والحالة.', 'Test any short link before opening it — you get destination and status.'),
    faq: [
      { q: t('Do you log the links I check?', 'Do you log the links I check?'), a: t('فقط إحصاءات مجهولة، ولا نشارك الوجهات مع أي طرف.', 'Anonymous aggregates only; destinations are never shared.') },
      { q: t('Is there an API?', 'Is there an API?'), a: t('نعم، عبر API الشبكة على 7.com.ly.', 'Yes, through the network API documented on 7.com.ly.') }
    ]
  },
  {
    id: 'n9',
    host: '9.com.ly',
    role: 'engine',
    mark: 'nonagon',
    name: '9.com.ly',
    colors: ['#fb7185', '#f472b6'],
    accent3: '#ec4899',
    defaultLang: 'ar',
    tool: t('منشئ صفحة الروابط (Bio)', 'Link-in-bio page builder'),
    tagline: t('كل روابطك في صفحة واحدة', 'All your links, one page'),
    heroA: t('صفحة واحدة،', 'One page,'),
    heroB: t('كل روابطك.', 'every link.'),
    lead: t('ابنِ صفحة روابط أنيقة لجمهورك — لكل الروابط والفيديوهات والمتجر في عنوان واحد.', 'Build a clean link page for your audience — links, videos and store in one address.'),
    metaTitle: t('9.com.ly — منشئ صفحة الروابط | شبكة comm.ly', '9.com.ly — Link-in-bio page builder | comm.ly network'),
    metaDesc: t('صفحة روابط أنيقة لجمهورك. جزء من شبكة comm.ly.', 'A clean link page for your audience. Part of the comm.ly network.'),
    features: [
      { title: t('صفحة بلا كود', 'No-code page'), desc: t('أضف روابطك وأعد ترتيبها واسحب وأفلت.', 'Add links, reorder them, drag and drop.') },
      { title: t('ثيمات جاهزة', 'Ready themes'), desc: t('تصاميم عربية وإنجليزية جاهزة للجوال.', 'Arabic and English mobile-first themes.') },
      { title: t('تحليلات', 'Analytics'), desc: t('اعرف ما ينقر عليه جمهورك أكثر.', 'Learn which links your audience clicks most.') }
    ],
    toolTitle: t('جرّب منشئ الصفحة', 'Try the page builder'),
    toolDesc: t('أنشئ صفحة روابط فوراً — بلا تسجيل، ثم احفظها بحسابك.', 'Create a link page instantly — no sign-up; save it later with an account.'),
    faq: [
      { q: t('هل الصفحة مجانية؟', 'Is the page free?'), a: t('صفحة واحدة مجانية، وحتى 25 على Business.', 'One page free, up to 25 on Business.') },
      { q: t('هل يمكن ربطها بالنطاقات؟', 'Can it use the network domains?'), a: t('الصفحة تُنشر على نطاق من الشبكة، ويمكن استخدام نطاقك الخاص على Pro.', 'Pages publish on a network domain; your own domain works on Pro.') }
    ]
  }
];

export const engineSites = sites.filter((site) => site.role === 'engine');
export const mainSite = sites.find((site) => site.role === 'main');

export function siteById(id) {
  return sites.find((site) => site.id === id);
}

export function networkHosts(exceptId) {
  return sites.filter((site) => site.id !== exceptId).map((site) => site.host);
}
