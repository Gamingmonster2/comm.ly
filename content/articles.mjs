/**
 * Simple, user-focused articles for every site in the comm.ly network.
 * Five topics x two languages = ten articles per site.
 *
 * Images are served from Unsplash (free to use under the Unsplash License).
 * Titles are written around natural 4-5 word long-tail search phrases.
 */

const IMG = {
  network: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  laptop: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  analytics: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
  phone: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1200&q=80',
  team: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80'
};

const TOPICS = [
  {
    slug: 'shorten-long-link-fast',
    image: IMG.laptop,
    ar: {
      title: 'كيف تختصر رابطاً طويلاً بسرعة',
      keyword: 'اختصار رابط طويل بسرعة',
      desc: 'طريقة بسيطة لتحويل الرابط الطويل إلى رابط قصير سهل المشاركة في ثوانٍ، بدون تسجيل أو خطوات معقدة.',
      intro: 'الروابط الطويلة تبدو فوضوية في الرسائل والمنشورات، وقد تقطعها تطبيقات المراسلة. لحسن الحظ، اختصارها يستغرق ثوانٍ فقط.',
      sections: [
        { h: 'لماذا نختصر الروابط؟', p: ['الرابط القصير أنظف في الشاشات الصغيرة، وأسهل في نسخه وإرساله، ويُظهر لمن يفتح الرابط مصدراً واضحاً بدلاً من سلسلة أحرف عشوائية.'] },
        { h: 'خطوات إنشاء رابط قصير', p: ['الصق الرابط الطويل في المربع المخصص، واضغط إنشاء. يمكنك إضافة كلمة مخصصة لتسهيل تذكر الرابط، أو تحديد تاريخ انتهاء له.'] },
        { h: 'نصيحة قبل المشاركة', p: ['افتح الرابط المختصر مرة واحدة بنفسك قبل نشره للتأكد من أنه يصل إلى المكان الصحيح.'] }
      ]
    },
    en: {
      title: 'How to shorten a long link quickly',
      keyword: 'shorten a long link quickly',
      desc: 'A simple way to turn a messy long URL into a short, shareable link in seconds — no sign-up needed.',
      intro: 'Long URLs look messy in messages and posts, and some apps cut them off. Shortening one takes just a few seconds.',
      sections: [
        { h: 'Why shorten links at all?', p: ['A short link looks cleaner on small screens, is easier to copy and share, and gives the reader a clearer source instead of a random string of characters.'] },
        { h: 'Creating your short link', p: ['Paste the long URL into the box and press create. You can add a custom word to make it memorable, or set an expiry date.'] },
        { h: 'One tip before you share', p: ['Open your short link once yourself before publishing it to make sure it lands in the right place.'] }
      ]
    }
  },
  {
    slug: 'free-link-shortener-social-media',
    image: IMG.phone,
    ar: {
      title: 'افضل موقع لاختصار الروابط مجاناً',
      keyword: 'موقع اختصار الروابط مجانا',
      desc: 'ما الذي تبحث عنه في أداة اختصار مجانية: سرعة، روابط مخصصة، وإحصاءات بسيطة دون إعلانات مزعجة.',
      intro: 'المواقع المجانية كثيرة، لكن القليل منها يجمع بين السرعة والبساطة والخصوصية. إليك ما يهم فعلاً عند الاختيار.',
      sections: [
        { h: 'ابدأ بلا تسجيل', p: ['أفضل أداة تسمح لك بإنشاء رابط فوراً. إذا طلبت بياناتك قبل أن تجربها، فابحث عن بديل.'] },
        { h: 'ابحث عن إحصاءات واضحة', p: ['معرفة عدد النقرات ومصدرها تساعدك على معرفة ما نجح في حملتك، حتى لو كنت تستخدم الرابط للاستخدام الشخصي.'] },
        { h: 'انتبه للإعلانات', p: ['بعض الخدمات تعرض إعلاناً قبل الوصول إلى وجهتك. اختر خدمة تحترم وقت المستخدم وتوصله مباشرة.'] }
      ]
    },
    en: {
      title: 'Best free link shortener for social media',
      keyword: 'free link shortener social media',
      desc: 'What to look for in a free shortener: speed, custom links and simple stats without annoying ads.',
      intro: 'There are many free sites, but few combine speed, simplicity and privacy. Here is what actually matters when you choose one.',
      sections: [
        { h: 'Start without signing up', p: ['The best tool lets you create a link instantly. If it asks for your details before you try it, look elsewhere.'] },
        { h: 'Look for clear stats', p: ['Knowing how many clicks you got and where they came from helps you understand what worked in your campaign.'] },
        { h: 'Watch out for ads', p: ['Some services show an ad before the destination. Pick one that respects the visitor and delivers them straight there.'] }
      ]
    }
  },
  {
    slug: 'create-custom-branded-short-link',
    image: IMG.team,
    ar: {
      title: 'كيف تنشئ رابطاً مخصصاً لعلامتك',
      keyword: 'رابط مخصص للعلامة التجارية',
      desc: 'الروابط المخصصة تجعل مشاركاتك أوضح وأكثر ثقة. تعرّف على طريقة كتابتها وما الذي يجب تجنبه.',
      intro: 'بدلاً من رمز عشوائي مثل x7kp2، يمكنك أن تكتب اسماً يشرح المحتوى. هذا يجعل رابطك أسهل للتذكر وأكثر مهنية.',
      sections: [
        { h: 'اكتب كلمة قصيرة وواضحة', p: ['استخدم كلمة واحدة أو كلمتين تعبّران عن المحتوى، مثل offer أو menu. تجنّب الأرقام والرموز غير المفهومة.'] },
        { h: 'حافظ على الاتساق', p: ['إذا كنت تنشر لعلامتك، اجعل كل الروابط بنفس النمط حتى يتعرف جمهورك عليها بسرعة.'] },
        { h: 'لا تستخدم أسماء الآخرين', p: ['لا تكتب أسماء علامات تجارية لا تملكها؛ هذا يربك المستخدمين وقد يمنع الرابط.'] }
      ]
    },
    en: {
      title: 'How to create a custom branded short link',
      keyword: 'create custom branded short link',
      desc: 'Custom links make your posts clearer and more trustworthy. Learn how to write them and what to avoid.',
      intro: 'Instead of a random code like x7kp2, you can write a name that explains the content. That makes your link easier to remember and more professional.',
      sections: [
        { h: 'Use a short, clear word', p: ['Pick one or two descriptive words, such as offer or menu. Avoid strange numbers and symbols.'] },
        { h: 'Stay consistent', p: ['If you post for a brand, keep all links in the same style so your audience recognises them quickly.'] },
        { h: 'Do not borrow other names', p: ['Do not use trademarks you do not own; it confuses people and can get the link blocked.'] }
      ]
    }
  },
  {
    slug: 'what-is-qr-code-link-generator',
    image: IMG.network,
    ar: {
      title: 'ما فائدة مولد رموز QR للروابط',
      keyword: 'مولد رموز QR للروابط',
      desc: 'رمز QR يحوّل رابطك إلى مربع يمكن مسحه بالهاتف. اكتشف متى تستخدمه وكيف تطبعه بشكل صحيح.',
      intro: 'رمز QR هو الطريقة الأسهل لنقل رابط من ورقة أو لافتة إلى هاتف المستخدم، دون كتابة أي حرف.',
      sections: [
        { h: 'متى تستخدم رمز QR؟', p: ['على بطاقات العمل، وقوائم المطاعم، والملصقات، وأي مكان لا يستطيع فيه المستخدم نسخ رابط طويل.'] },
        { h: 'اجعله كبيراً بما يكفي', p: ['اترك مساحة بيضاء حول الرمز واطبعه بحجم واضح. الرمز الصغير جداً يصعب مسحه من الكاميرا.'] },
        { h: 'اختبره قبل الطباعة', p: ['امسح الرمز بهاتفك للتأكد من فتح الرابط الصحيح، خصوصاً إذا كنت ستطبع نسخاً كثيرة.'] }
      ]
    },
    en: {
      title: 'What is a QR code link generator',
      keyword: 'QR code link generator',
      desc: 'A QR code turns your link into a square you can scan with a phone. See when to use one and how to print it well.',
      intro: 'A QR code is the easiest way to move a link from a flyer or sign to someone’s phone without typing a single character.',
      sections: [
        { h: 'When to use a QR code', p: ['On business cards, restaurant menus, posters and anywhere a person cannot copy a long link.'] },
        { h: 'Make it big enough', p: ['Leave a quiet white margin around the code and print it at a readable size. Tiny codes are hard for cameras to scan.'] },
        { h: 'Test before printing', p: ['Scan the code with your own phone to confirm it opens the right link, especially before a large print run.'] }
      ]
    }
  },
  {
    slug: 'track-link-clicks-for-free',
    image: IMG.analytics,
    ar: {
      title: 'كيف تعرف عدد نقرات روابطك مجاناً',
      keyword: 'تتبع نقرات الروابط مجانا',
      desc: 'تتبع النقرات لا يحتاج أدوات معقدة. تعرّف على الأرقام المفيدة وكيف تقرأها لتحسين مشاركاتك.',
      intro: 'إنشاء الرابط خطوة أولى، لكن معرفة ما حدث بعد نشره هي الخطوة التي تصنع الفرق.',
      sections: [
        { h: 'ابدأ بعدد النقرات', p: ['الرقم الأساسي هو عدد مرات فتح الرابط. تتبعه يومياً لتعرف أي منشور جلب تفاعلاً أكثر.'] },
        { h: 'انظر إلى المصدر', p: ['إذا كان الرابط منشوراً في أكثر من مكان، فإن معرفة المصدر تخبرك أي قناة تستحق المزيد من الوقت.'] },
        { h: 'لا تُغرق نفسك في البيانات', p: ['ثلاثة أرقام بسيطة تكفي لمعظم المستخدمين: النقرات، المصدر، والوقت. الباقي يمكن الاستغناء عنه.'] }
      ]
    },
    en: {
      title: 'How to track link clicks for free',
      keyword: 'track link clicks for free',
      desc: 'Tracking clicks does not need complex tools. Learn which numbers matter and how to read them.',
      intro: 'Creating the link is the first step. Knowing what happened after you shared it is the step that makes a difference.',
      sections: [
        { h: 'Start with the click count', p: ['The basic number is how often the link was opened. Check it daily to see which post got more attention.'] },
        { h: 'Look at the source', p: ['If you shared the link in several places, the source tells you which channel deserves more of your time.'] },
        { h: 'Do not drown in data', p: ['Three simple numbers are enough for most people: clicks, source and time. The rest is optional.'] }
      ]
    }
  }
];

function fill(text, site) {
  return String(text)
    .replaceAll('{host}', site.host)
    .replaceAll('{tool}', site.tool?.ar || site.tool?.en || site.host)
    .replaceAll('{toolEn}', typeof site.tool === 'string' ? site.tool : (site.tool?.en || site.host));
}

export function articlesFor(site) {
  const out = [];
  for (const topic of TOPICS) {
    for (const lang of ['ar', 'en']) {
      const a = topic[lang];
      out.push({
        key: `article:${topic.slug}`,
        slug: topic.slug,
        lang,
        title: fill(a.title, site),
        keyword: fill(a.keyword, site),
        description: fill(a.desc, site),
        intro: fill(a.intro, site),
        sections: a.sections.map((s) => ({ h: fill(s.h, site), p: s.p.map((x) => fill(x, site)) })),
        image: topic.image,
        imageAlt: lang === 'ar' ? `صورة توضيحية لمقال: ${a.title}` : `Illustration for: ${a.title}`
      });
    }
  }
  return out;
}

export const IMAGE_CREDIT = 'Photo via Unsplash (free license)';
