/* Comly Network — link-in-bio page builder (9.com.ly / n9). */
(function () {
  'use strict';

  var root = document.getElementById('bioTool');
  if (!root) return;

  var $ = function (id) { return document.getElementById(id); };

  var nameInput = $('bioName');
  var handleInput = $('bioHandle');
  var bioInput = $('bioBio');
  var themeInput = $('bioTheme');
  var avatarInput = $('bioAvatar');
  var linksContainer = $('bioLinks');
  var addBtn = $('bioAddLink');
  var publishBtn = $('bioPublish');
  var publishLabel = publishBtn ? publishBtn.querySelector('.btn-label') : null;
  var previewToggle = $('bioPreviewToggle');
  var resetBtn = $('bioReset');
  var preview = $('bioPreview');
  var errorBox = $('bioError');
  var resultBox = $('bioResult');
  var resultUrl = $('bioShortUrl');
  var copyBtn = $('bioCopyUrl');
  var openBtn = $('bioOpenUrl');
  var slugNode = $('bioSlug');

  if (!nameInput || !handleInput || !bioInput || !linksContainer || !preview) return;

  var COPY = {
    ar: {
      requiredName: 'اكتب اسم العرض أولاً.',
      needLink: 'أضف رابطاً صالحاً واحداً على الأقل يبدأ بـ http:// أو https://.',
      bioLong: 'الوصف طويل جداً — 160 حرفاً كحد أقصى.',
      tooMany: 'الحد الأقصى 12 رابطاً.',
      maxLinks: 'وصلت إلى الحد الأقصى: 12 رابطاً.',
      minLink: 'يجب إبقاء رابط واحد على الأقل.',
      publishing: 'جارٍ النشر…',
      publish: 'انشر الصفحة',
      handleTaken: 'هذا المعرّف مستخدم بالفعل — أضفنا لاحقة عشوائية وأعدنا المحاولة.',
      failed: 'تعذّر النشر الآن. تحقق من بياناتك وحاول مجدداً.',
      published: 'تم نشر صفحتك ✓',
      copied: 'تم نسخ رابط الصفحة ✓',
      reset: 'تمت إعادة الضبط.',
      titlePlaceholder: 'العنوان',
      urlPlaceholder: 'https://…',
      removeLink: 'إزالة الرابط'
    },
    en: {
      requiredName: 'Enter a display name first.',
      needLink: 'Add at least one valid link starting with http:// or https://.',
      bioLong: 'That bio is too long — 160 characters max.',
      tooMany: '12 links maximum.',
      maxLinks: 'You have reached the 12-link limit.',
      minLink: 'Keep at least one link.',
      publishing: 'Publishing…',
      publish: 'Publish page',
      handleTaken: 'That handle is already taken — we added a random suffix and retried.',
      failed: 'Could not publish right now. Check your details and try again.',
      published: 'Your page is live ✓',
      copied: 'Page link copied ✓',
      reset: 'Draft reset.',
      titlePlaceholder: 'Title',
      urlPlaceholder: 'https://…',
      removeLink: 'Remove link'
    }
  };

  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'ar'; }
  function t(key) { return COPY[lang()][key]; }

  /* window.comlyToast when the host page provides it; otherwise the local #toast. */
  function toast(message) {
    if (typeof window.comlyToast === 'function' && window.comlyToast !== toast) {
      window.comlyToast(message);
      return;
    }
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 2000);
  }
  if (typeof window.comlyToast !== 'function') window.comlyToast = toast;

  var THEMES = ['midnight', 'sunrise', 'mint', 'rose'];
  var MAX_LINKS = 12;
  var DEFAULT_ROWS = 3;
  var DRAFT_KEY = 'comly-bio-draft';

  var handleDirty = false;
  var pending = false;
  var saveTimer = null;
  var pageSeed = randomSuffix(6);

  var pvAvatar, pvName, pvHandle, pvBio, pvLinks;

  function on(node, evt, fn) { if (node) node.addEventListener(evt, fn); }
  function make(cls, tag) {
    var el = document.createElement(tag || 'div');
    if (cls) el.className = cls;
    return el;
  }

  function randomSuffix(len) {
    var s = Math.random().toString(36).slice(2, 2 + (len || 6)).replace(/[^a-z0-9]/g, '');
    return s || '123456';
  }

  function sanitizeHandle(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function deriveHandle(name) {
    var latin = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return latin || ('page-' + pageSeed);
  }

  function getHandle() { return sanitizeHandle(handleInput.value) || deriveHandle(nameInput.value); }

  function validUrl(value) {
    var raw = String(value || '').trim();
    if (!/^https?:\/\//i.test(raw)) return false;
    if (!window.URL) return true;
    try {
      var parsed = new URL(raw);
      return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !!parsed.hostname;
    } catch (e) { return false; }
  }

  function displayUrl(value) {
    var raw = String(value || '').trim();
    if (window.URL) {
      try { return new URL(raw).hostname || raw; } catch (e) { /* fall through */ }
    }
    return raw.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  }

  function setError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || '';
    errorBox.classList.toggle('show', !!message);
  }

  function buildPreview() {
    preview.textContent = '';
    pvAvatar = make('bio-preview-avatar');
    pvName = make('bio-preview-name');
    pvHandle = make('bio-preview-handle');
    pvBio = make('bio-preview-bio');
    pvLinks = make('bio-preview-links');
    preview.appendChild(pvAvatar);
    preview.appendChild(pvName);
    preview.appendChild(pvHandle);
    preview.appendChild(pvBio);
    preview.appendChild(pvLinks);
  }

  function avatarText() {
    var a = String(avatarInput ? avatarInput.value : '').trim();
    if (a) return a;
    var parts = String(nameInput.value || '').trim().split(/\s+/);
    var initials = '';
    for (var i = 0; i < parts.length && initials.length < 2; i++) {
      if (parts[i]) initials += parts[i].charAt(0);
    }
    return initials.toUpperCase();
  }

  function rowList() {
    var nodes = linksContainer.querySelectorAll('.bio-link-row');
    var arr = [];
    for (var i = 0; i < nodes.length; i++) arr.push(nodes[i]);
    return arr;
  }

  function rowFields(row) {
    return {
      title: row.querySelector('.bio-link-title'),
      url: row.querySelector('.bio-link-url'),
      remove: row.querySelector('.bio-link-remove')
    };
  }

  function createRow(title, url) {
    var row = make('bio-link-row');
    var titleEl = document.createElement('input');
    titleEl.type = 'text';
    titleEl.className = 'bio-link-title';
    titleEl.setAttribute('placeholder', t('titlePlaceholder'));
    titleEl.value = title || '';

    var urlEl = document.createElement('input');
    urlEl.type = 'url';
    urlEl.className = 'bio-link-url';
    urlEl.setAttribute('placeholder', t('urlPlaceholder'));
    urlEl.value = url || '';

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'bio-link-remove';
    remove.setAttribute('aria-label', t('removeLink'));
    remove.textContent = '\u00d7';

    row.appendChild(titleEl);
    row.appendChild(urlEl);
    row.appendChild(remove);
    return row;
  }

  function renderPreviewLinks() {
    pvLinks.textContent = '';
    var rows = rowList();
    for (var i = 0; i < rows.length; i++) {
      var fields = rowFields(rows[i]);
      var title = fields.title ? String(fields.title.value || '').trim() : '';
      var url = fields.url ? String(fields.url.value || '').trim() : '';
      if (!title && !url) continue;
      var a = document.createElement('a');
      a.className = 'bio-preview-link';
      a.textContent = title || displayUrl(url);
      a.setAttribute('href', validUrl(url) ? url : '#');
      pvLinks.appendChild(a);
    }
  }

  function syncAddButton() {
    if (addBtn) addBtn.disabled = rowList().length >= MAX_LINKS;
  }

  function renderPreview() {
    pvAvatar.textContent = avatarText();
    pvName.textContent = String(nameInput.value || '').trim();
    pvHandle.textContent = '@' + getHandle();
    pvBio.textContent = String(bioInput.value || '').trim();
    for (var i = 0; i < THEMES.length; i++) preview.classList.remove('bio-theme-' + THEMES[i]);
    var theme = themeInput && THEMES.indexOf(themeInput.value) > -1 ? themeInput.value : THEMES[0];
    preview.classList.add('bio-theme-' + theme);
    renderPreviewLinks();
    syncAddButton();
  }

  function collectState() {
    var links = [];
    var rows = rowList();
    for (var i = 0; i < rows.length; i++) {
      var fields = rowFields(rows[i]);
      links.push({
        title: fields.title ? String(fields.title.value || '').trim() : '',
        url: fields.url ? String(fields.url.value || '').trim() : ''
      });
    }
    return {
      name: String(nameInput.value || '').trim(),
      handle: getHandle(),
      handleDirty: handleDirty,
      bio: String(bioInput.value || '').trim(),
      theme: themeInput && THEMES.indexOf(themeInput.value) > -1 ? themeInput.value : THEMES[0],
      avatar: String(avatarInput ? avatarInput.value : '').trim(),
      links: links
    };
  }

  function saveDraft() {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(collectState())); } catch (e) { /* storage disabled */ }
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveTimer = null; saveDraft(); }, 250);
  }

  function hideResult() {
    if (!resultBox) return;
    resultBox.hidden = true;
    resultBox.classList.add('is-hidden');
  }

  function applyState(data) {
    nameInput.value = data.name || '';
    handleInput.value = data.handle || '';
    handleDirty = !!data.handleDirty;
    bioInput.value = data.bio || '';
    if (avatarInput) avatarInput.value = data.avatar || '';
    if (themeInput) themeInput.value = THEMES.indexOf(data.theme) > -1 ? data.theme : THEMES[0];

    linksContainer.textContent = '';
    var links = data.links && data.links.length ? data.links : null;
    if (links) {
      for (var i = 0; i < links.length && i < MAX_LINKS; i++) {
        linksContainer.appendChild(createRow(links[i].title, links[i].url));
      }
    } else {
      for (var j = 0; j < DEFAULT_ROWS; j++) linksContainer.appendChild(createRow('', ''));
    }
    hideResult();
    renderPreview();
  }

  function restoreDraft() {
    var raw;
    try { raw = window.localStorage.getItem(DRAFT_KEY); } catch (e) { return false; }
    if (!raw) return false;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return false; }
    if (!data || typeof data !== 'object') return false;
    applyState(data);
    return true;
  }

  function resetAll() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* storage disabled */ }
    nameInput.value = '';
    handleInput.value = deriveHandle('');
    handleDirty = false;
    bioInput.value = '';
    if (avatarInput) avatarInput.value = '';
    if (themeInput) themeInput.value = THEMES[0];
    linksContainer.textContent = '';
    for (var i = 0; i < DEFAULT_ROWS; i++) linksContainer.appendChild(createRow('', ''));
    if (preview) preview.classList.remove('is-wide');
    if (previewToggle) previewToggle.setAttribute('aria-pressed', 'false');
    setError('');
    hideResult();
    renderPreview();
    toast(t('reset'));
  }

  function validate() {
    if (!String(nameInput.value || '').trim()) { setError(t('requiredName')); nameInput.focus(); return false; }
    if (String(bioInput.value || '').length > 160) { setError(t('bioLong')); return false; }
    var rows = rowList();
    if (rows.length > MAX_LINKS) { setError(t('tooMany')); return false; }
    var valid = 0;
    for (var i = 0; i < rows.length; i++) {
      var fields = rowFields(rows[i]);
      if (fields.url && validUrl(fields.url.value)) valid++;
    }
    if (!valid) { setError(t('needLink')); return false; }
    setError('');
    return true;
  }

  function showResult(data) {
    if (!resultBox) return;
    var url = data.shortUrl || data.url || '';
    if (resultUrl) {
      resultUrl.textContent = url;
      if (resultUrl.tagName === 'A') resultUrl.setAttribute('href', url);
    }
    if (openBtn) {
      openBtn.setAttribute('href', url);
      openBtn.setAttribute('target', '_blank');
      openBtn.setAttribute('rel', 'noopener noreferrer');
    }
    if (slugNode) slugNode.textContent = data.slug || '';
    resultBox.hidden = false;
    resultBox.classList.remove('is-hidden');
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    try { ta.select(); } catch (e) { /* ignore */ }
    try { if (document.execCommand) document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function copyText(text, message) {
    var done = function () { toast(message); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text); done();
    }
  }

  function postBio(payload, isRetry) {
    return fetch('/api/bio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (res.status === 409 && !isRetry) {
        var retryHandle = payload.handle + '-' + randomSuffix(4);
        handleInput.value = retryHandle;
        handleDirty = true;
        var retryPayload = {
          title: payload.title,
          handle: retryHandle,
          bio: payload.bio,
          theme: payload.theme,
          avatar: payload.avatar,
          links: payload.links
        };
        setError('');
        toast(t('handleTaken'));
        scheduleSave();
        return postBio(retryPayload, true);
      }
      return res.json().then(function (data) {
        if (!res.ok || (data && data.ok === false)) throw new Error((data && data.error) || 'publish-failed');
        return data;
      }, function () { throw new Error('publish-failed'); });
    });
  }

  function publish() {
    if (pending) return;
    if (!validate()) return;

    var state = collectState();
    var payload = {
      title: state.name,
      handle: state.handle,
      bio: state.bio,
      theme: state.theme,
      avatar: state.avatar,
      links: []
    };
    for (var i = 0; i < state.links.length; i++) {
      if (state.links[i].url) payload.links.push({ title: state.links[i].title, url: state.links[i].url });
    }
    if (!payload.links.length) { setError(t('needLink')); return; }

    pending = true;
    if (publishBtn) { publishBtn.disabled = true; publishBtn.classList.add('is-loading'); }
    if (publishLabel) publishLabel.textContent = t('publishing');

    function finish() {
      pending = false;
      if (publishBtn) { publishBtn.disabled = false; publishBtn.classList.remove('is-loading'); }
      if (publishLabel) publishLabel.textContent = t('publish');
    }

    postBio(payload, false).then(function (data) {
      showResult(data || {});
      setError('');
      toast(t('published'));
      finish();
    }, function () {
      setError(t('failed'));
      finish();
    });
  }

  function addLink() {
    if (rowList().length >= MAX_LINKS) { toast(t('maxLinks')); return; }
    linksContainer.appendChild(createRow('', ''));
    renderPreview();
    scheduleSave();
  }

  function removeLink(row) {
    if (rowList().length <= 1) { toast(t('minLink')); return; }
    if (row.parentNode === linksContainer) linksContainer.removeChild(row);
    renderPreview();
    scheduleSave();
  }

  /* ---- events ---- */
  on(nameInput, 'input', function () {
    if (!handleDirty) handleInput.value = deriveHandle(nameInput.value);
    renderPreview();
    scheduleSave();
  });
  on(handleInput, 'input', function () { handleDirty = true; renderPreview(); scheduleSave(); });
  on(bioInput, 'input', function () { renderPreview(); scheduleSave(); });
  on(avatarInput, 'input', function () { renderPreview(); scheduleSave(); });
  on(themeInput, 'change', function () { renderPreview(); scheduleSave(); });

  on(linksContainer, 'input', function (e) {
    var target = e.target;
    if (!target || typeof target.className !== 'string') return;
    if (target.className.indexOf('bio-link-title') > -1 || target.className.indexOf('bio-link-url') > -1) {
      renderPreview();
      scheduleSave();
    }
  });
  on(linksContainer, 'click', function (e) {
    var target = e.target;
    if (!target || typeof target.className !== 'string' || target.className.indexOf('bio-link-remove') < 0) return;
    var row = target.parentNode;
    if (row && typeof row.className === 'string' && row.className.indexOf('bio-link-row') > -1) removeLink(row);
  });

  on(addBtn, 'click', addLink);
  on(publishBtn, 'click', publish);
  on(resetBtn, 'click', resetAll);
  on(copyBtn, 'click', function () { if (resultUrl) copyText(resultUrl.textContent, t('copied')); });
  on(previewToggle, 'click', function () {
    var wide = preview.classList.toggle('is-wide');
    if (previewToggle) previewToggle.setAttribute('aria-pressed', wide ? 'true' : 'false');
  });

  window.addEventListener('comly:lang', function () {
    var rows = rowList();
    for (var i = 0; i < rows.length; i++) {
      var fields = rowFields(rows[i]);
      if (fields.title) fields.title.setAttribute('placeholder', t('titlePlaceholder'));
      if (fields.url) fields.url.setAttribute('placeholder', t('urlPlaceholder'));
      if (fields.remove) fields.remove.setAttribute('aria-label', t('removeLink'));
    }
    if (publishLabel) publishLabel.textContent = t('publish');
    renderPreview();
  });

  /* ---- init ---- */
  buildPreview();
  if (!restoreDraft()) {
    for (var i = 0; i < DEFAULT_ROWS; i++) linksContainer.appendChild(createRow('', ''));
    handleInput.value = deriveHandle('');
    renderPreview();
  }
})();
