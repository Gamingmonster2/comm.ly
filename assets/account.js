/* Account pages: login, register, dashboard (/app). */
(function () {
  'use strict';
  const lang = () => (document.documentElement.lang === 'en' ? 'en' : 'ar');
  const T = {
    ar: {
      sending: 'جارٍ…', welcome: 'مرحباً', links: 'روابطك', clicks: 'النقرات', plan: 'الخطة', month: 'روابط هذا الشهر',
      newLink: 'رابط جديد', url: 'الرابط الطويل', slug: 'كود مخصص (اختياري)', expiry: 'الانتهاء', create: 'أنشئ الرابط',
      created: 'تم إنشاء الرابط ✓', copy: 'نسخ', copied: 'تم النسخ ✓', del: 'حذف', confirmDel: 'حذف هذا الرابط؟',
      empty: 'لا توجد روابط بعد — أنشئ أول رابط.', noAccount: 'ليس لديك حساب؟ سجّل الآن', haveAccount: 'لديك حساب؟ سجّل الدخول',
      logout: 'خروج', invalid: 'بيانات غير صحيحة', weak: 'كلمة المرور 8 أحرف على الأقل', emailTaken: 'البريد مستخدم مسبقاً',
      limit: 'وصلت لحد خطتك الشهرية — رقّ خطتك للمتابعة.', loading: 'جارٍ التحميل…', expireNever: 'بلا انتهاء',
      expires24: '24 ساعة', expires168: '7 أيام', expires720: '30 يوماً', configMissing: 'ميزة الحساب غير مفعّلة بعد على هذا النشر.'
    },
    en: {
      sending: 'Sending…', welcome: 'Welcome', links: 'Your links', clicks: 'Clicks', plan: 'Plan', month: 'Links this month',
      newLink: 'New link', url: 'Long URL', slug: 'Custom code (optional)', expiry: 'Expiry', create: 'Create link',
      created: 'Link created ✓', copy: 'Copy', copied: 'Copied ✓', del: 'Delete', confirmDel: 'Delete this link?',
      empty: 'No links yet — create your first one.', noAccount: 'No account? Register now', haveAccount: 'Have an account? Sign in',
      logout: 'Log out', invalid: 'Invalid credentials', weak: 'Password must be at least 8 characters', emailTaken: 'Email already registered',
      limit: 'You reached your plan limit — upgrade to continue.', loading: 'Loading…', expireNever: 'Never',
      expires24: '24 hours', expires168: '7 days', expires720: '30 days', configMissing: 'Accounts are not enabled on this deployment yet.'
    }
  };
  const t = (key) => T[lang()][key] || key;

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  }

  function message(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--danger)' : 'var(--ok)';
  }

  /* ---------------- login / register ---------------- */
  const authForm = document.getElementById('authForm');
  if (authForm) {
    const kind = authForm.dataset.kind;
    const status = document.getElementById('authStatus');
    authForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        email: document.getElementById('emailInput').value,
        password: document.getElementById('passwordInput').value
      };
      if (kind === 'register') payload.name = document.getElementById('nameInput').value;
      message(status, t('sending'));
      const { ok, data } = await api(`/api/auth/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
      if (ok) {
        location.href = '../app/';
        return;
      }
      const errors = { invalid_credentials: t('invalid'), weak_password: t('weak'), email_taken: t('emailTaken') };
      message(status, errors[data.error] || t('configMissing'), true);
    });
  }

  /* ---------------- dashboard ---------------- */
  const dash = document.getElementById('dash');
  if (dash) {
    const status = document.getElementById('dashStatus');
    const tableBody = document.getElementById('linksBody');
    const empty = document.getElementById('emptyState');
    const form = document.getElementById('newLinkForm');
    let state = { links: [], plan: null, usage: null };

    function render() {
      document.getElementById('statLinks').textContent = state.links.length;
      document.getElementById('statClicks').textContent = state.links.reduce((sum, link) => sum + (link.clicks || 0), 0);
      document.getElementById('statPlan').textContent = (state.plan && state.plan.linksPerMonth === Infinity) ? '∞' : (state.plan ? state.plan.linksPerMonth : '—');
      document.getElementById('statMonth').textContent = state.usage ? `${state.usage.linksThisMonth}` : '0';
      tableBody.innerHTML = state.links.map((link) => `
        <tr>
          <td class="td-link"><a href="${link.shortUrl}" target="_blank" rel="noopener">${link.code}</a></td>
          <td class="td-dest" title="${link.url}">${link.url}</td>
          <td class="td-clicks">${link.clicks}</td>
          <td style="color:var(--muted-2);font-size:12px">${(link.createdAt || '').slice(0, 10)}</td>
          <td>
            <div class="td-actions">
              <button class="icon-btn" data-copy="${link.shortUrl}" title="${t('copy')}">⧉</button>
              <button class="icon-btn" data-delete="${link.code}" title="${t('del')}">✕</button>
            </div>
          </td>
        </tr>`).join('');
      empty.style.display = state.links.length ? 'none' : 'block';
    }

    async function load() {
      message(status, t('loading'));
      const me = await api('/api/auth/me');
      if (!me.ok) {
        location.href = '../login/';
        return;
      }
      document.getElementById('who').textContent = `${t('welcome')}، ${me.data.user.name || me.data.user.email}`;
      const links = await api('/api/links');
      if (!links.ok) {
        message(status, t('configMissing'), true);
        return;
      }
      state = { links: links.data.links || [], plan: links.data.plan, usage: links.data.usage };
      render();
      message(status, '');
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        url: document.getElementById('linkUrl').value,
        slug: document.getElementById('linkSlug').value || undefined,
        expiresIn: Number(document.getElementById('linkExpiry').value)
      };
      const { ok, data } = await api('/api/links', { method: 'POST', body: JSON.stringify(payload) });
      if (ok) {
        form.reset();
        message(status, t('created'));
        load();
      } else {
        message(status, data.error === 'plan_limit' ? t('limit') : (data.error || t('invalid')), true);
      }
    });

    tableBody.addEventListener('click', async (event) => {
      const copy = event.target.closest('[data-copy]');
      if (copy) {
        try { await navigator.clipboard.writeText(copy.dataset.copy); } catch { /* ignore */ }
        window.comlyToast ? window.comlyToast(t('copied')) : null;
        return;
      }
      const del = event.target.closest('[data-delete]');
      if (del && confirm(t('confirmDel'))) {
        await api(`/api/links/${del.dataset.delete}`, { method: 'DELETE' });
        load();
      }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
      await api('/api/auth/logout', { method: 'POST' });
      location.href = '/';
    });

    load();
  }
})();
