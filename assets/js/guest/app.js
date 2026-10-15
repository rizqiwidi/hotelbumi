/**
 * BUMI SURABAYA v6.4
 * app.js — Logika presentasi tampilan tamu, Full Guest Page CMS & Dwibahasa Otomatis ID/EN (FR-CMS-01 s/d FR-CMS-07, FR-V64-06)
 *
 * KONTRAK KERAS: Tidak mengubah tone warna ataupun tata letak halaman tamu (guest.css).
 */

(function(window, document) {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $$(sel){ return document.querySelectorAll(sel); }
  function setText(el, txt) { if (el && txt !== undefined && txt !== null) el.textContent = txt; }
  function setHTML(el, html){ if (el) el.innerHTML   = html; }
  function show(el)  { if (el) el.classList.remove('bs-hidden'); }
  function hide(el)  { if (el) el.classList.add('bs-hidden'); }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function sanitizeUrl(url) {
    if (!url) return '#';
    var u = String(url).trim();
    if (/^(javascript|vbscript|data|file):/i.test(u)) {
      return '#';
    }
    return u;
  }

  function cleanPhone(num) {
    if (!num) return '';
    var clean = String(num).replace(/[^0-9]/g, '');
    if (clean.indexOf('0') === 0) clean = '62' + clean.substring(1);
    return clean;
  }

  var _config    = null;
  var _sources   = [];
  var _sourceObj = null;

  /**
   * Resolusi bahasa aktif halaman tamu (FR-V64-06):
   * - Query param ?lang=id atau ?lang=en (prioritas tertinggi untuk pengujian/tautan langsung)
   * - general.language_mode === 'id' -> Bahasa Indonesia
   * - general.language_mode === 'en' -> Bahasa Inggris
   * - general.language_mode === 'auto' -> deteksi navigator.language (id* -> 'id', lainnya -> 'en')
   */
  function resolveActiveLang() {
    try {
      var qLang = (new URLSearchParams(window.location.search).get('lang') || '').toLowerCase().trim();
      if (qLang === 'id' || qLang === 'en') return qLang;
    } catch (_) {}

    var gen = (_config && _config.general) || (window.BSConfig && BSConfig.DEFAULTS && BSConfig.DEFAULTS.general) || {};
    var mode = String(gen.language_mode || 'en').toLowerCase();
    if (mode === 'id') return 'id';
    if (mode === 'en') return 'en';
    if (mode === 'auto') {
      var navLang = String((navigator && (navigator.language || navigator.userLanguage)) || 'en').toLowerCase();
      return navLang.indexOf('id') === 0 ? 'id' : 'en';
    }
    return 'en';
  }

  function getMergedSection(secName) {
    var def = (window.BSConfig && BSConfig.DEFAULTS && BSConfig.DEFAULTS[secName]) || {};
    var act = (_config && _config[secName]) || {};
    if (Array.isArray(def) || Array.isArray(act)) {
      return (_config && Array.isArray(_config[secName])) ? _config[secName] : def;
    }
    var lang = resolveActiveLang();
    var presetId = (lang === 'id' && window.BSConfig && BSConfig.PRESET_ID && BSConfig.PRESET_ID[secName])
      ? BSConfig.PRESET_ID[secName]
      : {};
    // Jika mode auto dan bahasa peramban adalah 'id', gunakan preset ID sebagai dasar,
    // namun tetap izinkan kustomisasi eksplisit admin dari _config[secName]
    var base = Object.assign({}, def, presetId);
    if (lang === 'id' && (_config && _config.general && _config.general.language_mode === 'auto')) {
      var customOverrides = {};
      Object.keys(act).forEach(function(k) {
        if (act[k] !== undefined && act[k] !== '' && JSON.stringify(act[k]) !== JSON.stringify(def[k])) {
          customOverrides[k] = act[k];
        }
      });
      return Object.assign({}, base, customOverrides);
    }
    return Object.assign({}, base, act);
  }

  function findSource(code) {
    if (!code || code === 'general') return null;
    var lc = code.toLowerCase().trim();
    for (var i = 0; i < _sources.length; i++) {
      var s = _sources[i];
      if (s.active === false) continue;

      if ((s.code || '').toLowerCase().trim() === lc) return s;

      if (s.migration_mode === true && s.migration_until) {
        var migTime = new Date(s.migration_until).getTime();
        if (!isNaN(migTime) && Date.now() < migTime) {
          if (s.legacy_codes) {
            try {
              var legacy = typeof s.legacy_codes === 'string' ? JSON.parse(s.legacy_codes) : s.legacy_codes;
              if (Array.isArray(legacy)) {
                for (var j = 0; j < legacy.length; j++) {
                  if (String(legacy[j]).toLowerCase().trim() === lc) return s;
                }
              }
            } catch(e) {}
          }
        }
      }
    }
    return null;
  }

  var ARUMANIS_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU';
  function resolveReviewUrl() {
    var gen = getMergedSection('general');
    var rev = getMergedSection('review_settings');
    var outletUrl = '';
    if (_sourceObj && _sourceObj.outlet) {
      var ol = String(_sourceObj.outlet).toLowerCase().trim();
      var outlets = getMergedSection('outlets');
      for (var i = 0; i < outlets.length; i++) {
        var o = outlets[i];
        if (o && o.active !== false &&
            (String(o.name || '').toLowerCase().trim() === ol ||
             String(o.id || '').toLowerCase().trim() === ol)) {
          outletUrl = o.review_url || '';
          break;
        }
      }
    }
    return sanitizeUrl(outletUrl || (rev && rev.review_url) || gen.google_review_url || ARUMANIS_REVIEW_URL);
  }

  function renderWelcomeGreeting(welcomeEl, template, sourceObj, hotelName) {
    if (!welcomeEl) return;
    welcomeEl.textContent = '';
    var sName   = (sourceObj && sourceObj.name)   || 'our team';
    var sRole   = (sourceObj && sourceObj.role)   || '';
    var sOutlet = (sourceObj && sourceObj.outlet) || (sourceObj && sourceObj.name) || hotelName;

    var tpl = String(template || '');
    if (tpl.indexOf('{staff_name}') !== -1) {
      var parts = tpl.split('{staff_name}');
      welcomeEl.appendChild(document.createTextNode(
        parts[0]
          .replace(/\{role\}/g, sRole)
          .replace(/\{outlet\}/g, sOutlet)
          .replace(/\{outlet_name\}/g, sOutlet)
          .replace(/\{hotel_name\}/g, hotelName)
      ));
      var strongName = document.createElement('strong');
      strongName.textContent = sName;
      welcomeEl.appendChild(strongName);
      var rest = (parts.slice(1).join(sName) || '')
        .replace(/\(\s*\{role\}\s*\)/g, sRole ? ('(' + sRole + ')') : '')
        .replace(/\{role\}/g, sRole)
        .replace(/\{outlet\}/g, sOutlet)
        .replace(/\{outlet_name\}/g, sOutlet)
        .replace(/\{hotel_name\}/g, hotelName)
        .replace(/\s+(from|dari)\s+\./g, '.')
        .replace(/\s{2,}/g, ' ');
      welcomeEl.appendChild(document.createTextNode(rest));
    } else if (tpl.indexOf('{outlet_name}') !== -1 || tpl.indexOf('{outlet}') !== -1) {
      var token = tpl.indexOf('{outlet_name}') !== -1 ? '{outlet_name}' : '{outlet}';
      var oParts = tpl.split(token);
      welcomeEl.appendChild(document.createTextNode(oParts[0].replace(/\{hotel_name\}/g, hotelName)));
      var strongOut = document.createElement('strong');
      strongOut.textContent = sOutlet;
      welcomeEl.appendChild(strongOut);
      welcomeEl.appendChild(document.createTextNode((oParts.slice(1).join(sOutlet) || '').replace(/\{hotel_name\}/g, hotelName)));
    } else if (sourceObj && (sourceObj.type === 'staff' || sourceObj.type === 'sales')) {
      var prefix = tpl ? (tpl.replace(/\.$/, '') + ' ') : 'Hello! You are currently being served wholeheartedly by ';
      welcomeEl.appendChild(document.createTextNode(prefix));
      var strongStaff = document.createElement('strong');
      strongStaff.textContent = sName;
      welcomeEl.appendChild(strongStaff);
      if (sRole) welcomeEl.appendChild(document.createTextNode(' (' + sRole + ')'));
      if (sourceObj.outlet) {
        welcomeEl.appendChild(document.createTextNode(' — '));
        var emOutlet = document.createElement('em');
        emOutlet.textContent = sourceObj.outlet;
        welcomeEl.appendChild(emOutlet);
      }
      welcomeEl.appendChild(document.createTextNode('.'));
    } else {
      welcomeEl.textContent = tpl.replace(/\{hotel_name\}/g, hotelName);
    }
  }

  function renderHero() {
    var gen = getMergedSection('general');
    var app = getMergedSection('appearance');
    var rev = getMergedSection('review_settings');
    var ws  = getMergedSection('whatsapp_settings');
    var sec = getMergedSection('guest_sections');
    var gc  = getMergedSection('guest_content');

    if (gen.hotel_name) {
      document.title = gen.hotel_name + ' — Digital Guest Experience';
    }
    var metaDesc = $('#bs-meta-desc');
    if (metaDesc && gen.description) {
      metaDesc.setAttribute('content', gen.description);
    }

    setText($('#bs-loading-title'), gc.loading_title || gen.hotel_name || 'Bumi Surabaya City Resort');
    setText($('#bs-loading-sub'),   gc.loading_subtitle || 'Preparing your experience…');

    var logoPath = gen.logo_url || 'assets/images/logo-hotel.png';
    var resolvedLogo = (window.BSConfig && BSConfig.resolveAsset) ? BSConfig.resolveAsset(logoPath) : logoPath;
    var safeLogo = sanitizeUrl(resolvedLogo);
    if (safeLogo && safeLogo !== '#') {
      var heroLogo   = $('#bs-hero-logo') || $('.bs-hotel-logo');
      var footerLogo = $('#bs-footer-logo') || $('.bs-footer-logo');
      if (heroLogo)   { heroLogo.src = safeLogo;   heroLogo.alt = gen.hotel_name || 'Bumi Surabaya City Resort'; }
      if (footerLogo) { footerLogo.src = safeLogo; footerLogo.alt = gen.hotel_name || 'Bumi Surabaya City Resort'; }
    }

    var heroTitle = app.hero_text || gen.hotel_name || 'Bumi Surabaya City Resort';
    setText($('#bs-hotel-name'), heroTitle);
    setText($('#bs-subtitle'), app.hero_subtitle || '');
    setText($('#bs-scroll-hint-text'), gc.hero_scroll_hint || 'Scroll to explore');

    var src = window.BSTracker ? BSTracker.getSource() : 'general';
    _sourceObj = findSource(src);

    var welcomeEl    = $('#bs-welcome-msg');
    var staffBadgeEl = $('#bs-staff-badge');
    var hotelName    = gen.hotel_name || 'Bumi Surabaya City Resort';

    if (_sourceObj) {
      var st = _sourceObj.type || 'staff';
      if (st === 'staff' || st === 'sales') {
        var staffTpl = (st === 'sales' && app.welcome_msg_sales)
          ? app.welcome_msg_sales
          : (app.welcome_msg_staff || 'Hello! You are currently being served wholeheartedly by {staff_name} ({role}) from {outlet}.');
        renderWelcomeGreeting(welcomeEl, staffTpl, _sourceObj, hotelName);
        if (staffBadgeEl) {
          staffBadgeEl.textContent = '';
          var dot = document.createElement('span');
          dot.className = 'bs-dot';
          staffBadgeEl.appendChild(dot);
          staffBadgeEl.appendChild(document.createTextNode((gc.staff_badge_prefix || 'Served by ') + (_sourceObj.name || '-')));
          show(staffBadgeEl);
        }
      } else if (st === 'outlet') {
        var outletTpl = app.welcome_msg_outlet || 'Enjoy an exclusive culinary experience at {outlet_name}.';
        renderWelcomeGreeting(welcomeEl, outletTpl, _sourceObj, hotelName);
        hide(staffBadgeEl);
      } else if (st === 'nfc') {
        var nfcTpl = app.welcome_msg_nfc || 'Welcome to {outlet_name}! Enjoy an unforgettable experience with us.';
        renderWelcomeGreeting(welcomeEl, nfcTpl, _sourceObj, hotelName);
        hide(staffBadgeEl);
      }
    } else {
      if (welcomeEl) {
        welcomeEl.textContent = (app.welcome_msg_general || BSConfig.DEFAULTS.appearance.welcome_msg_general).replace(/\{hotel_name\}/g, hotelName);
      }
      hide(staffBadgeEl);
    }

    var hero = $('.bs-hero');
    if (hero) {
      if (app.hero_bg_url) {
        var resolvedBg = (window.BSConfig && BSConfig.resolveAsset) ? BSConfig.resolveAsset(app.hero_bg_url) : app.hero_bg_url;
        var safeBg = sanitizeUrl(resolvedBg);
        if (safeBg && safeBg !== '#') {
          hero.style.backgroundImage = 'url("' + encodeURI(safeBg) + '")';
          hero.classList.add('has-bg');
        }
      } else {
        hero.style.backgroundImage = '';
        hero.classList.remove('has-bg');
      }
    }

    var reviewBtn   = $('#bs-btn-review');
    var mobReview   = $('.bs-mob-review');
    var finalReview = $('#bs-final-review');
    var reviewUrl   = resolveReviewUrl();
    var heroRevTxt  = gc.hero_review_btn_label || (rev && rev.button_text) || 'Share Your Experience';

    if (reviewBtn) {
      reviewBtn.href = reviewUrl;
      var reviewLabel = reviewBtn.querySelector('span');
      if (reviewLabel) reviewLabel.textContent = heroRevTxt; else reviewBtn.textContent = heroRevTxt;
      if (sec && sec.show_review === false) hide(reviewBtn); else show(reviewBtn);
    }
    if (finalReview) {
      finalReview.href = reviewUrl;
      var finalRevSpan = finalReview.querySelector('span');
      if (finalRevSpan) finalRevSpan.textContent = gc.final_review_btn_label || heroRevTxt;
      if (sec && sec.show_review === false) hide(finalReview); else show(finalReview);
    }
    if (mobReview) {
      mobReview.href = reviewUrl;
      var mobRevSpan = mobReview.querySelector('span');
      if (mobRevSpan) mobRevSpan.textContent = gc.mobile_bar_review_label || 'Review';
      if (sec && sec.show_review === false) hide(mobReview); else show(mobReview);
    }

    var waNum = '';
    var waMsg = '';
    if (_sourceObj && _sourceObj.type === 'sales' && _sourceObj.whatsapp && cleanPhone(_sourceObj.whatsapp)) {
      waNum = cleanPhone(_sourceObj.whatsapp);
      waMsg = (_sourceObj.welcome_template || 'Hello, I am a Bumi Surabaya guest. I am being served by {staff_name}.')
        .replace(/\{staff_name\}/g, _sourceObj.name || 'staff');
    } else {
      waNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');
      if (_sourceObj && (_sourceObj.type === 'staff' || _sourceObj.type === 'sales')) {
        waMsg = ((ws && ws.template_staff) || 'Hello, I am a Bumi Surabaya guest. I was just served by {staff_name} and would like to make a reservation.')
                .replace(/\{staff_name\}/g, _sourceObj.name || 'our team');
      } else {
        waMsg = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';
      }
    }

    var waUrl   = sanitizeUrl('https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg));
    var waBtn   = $('#bs-btn-wa');
    var waLink  = $('#bs-wa-link');
    var mobWa   = $('.bs-mob-wa');
    var finalWa = $('#bs-final-wa');

    if (waBtn) {
      var heroWaSpan = waBtn.querySelector('span');
      if (heroWaSpan) heroWaSpan.textContent = gc.hero_wa_btn_label || 'Chat with Us';
    }
    if (finalWa) {
      var finalWaSpan = finalWa.querySelector('span');
      if (finalWaSpan) finalWaSpan.textContent = gc.final_wa_btn_label || 'Contact Us';
    }
    if (mobWa) {
      var mobWaSpan = mobWa.querySelector('span');
      if (mobWaSpan) mobWaSpan.textContent = gc.mobile_bar_wa_label || 'WhatsApp';
    }

    [waBtn, waLink, mobWa, finalWa].forEach(function(btn) {
      if (!btn) return;
      btn.href = waUrl;
      if (!btn.getAttribute('data-wa-bound')) {
        btn.setAttribute('data-wa-bound', '1');
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          openWaPicker();
        });
      }
    });
  }

  function renderReviewSection() {
    var cfg = getMergedSection('review_settings');
    var sec = getMergedSection('guest_sections');
    var gc  = getMergedSection('guest_content');
    var el  = $('#bs-review-section');
    if (!el) return;
    if (sec && sec.show_review === false) { hide(el); return; }

    setText($('#bs-review-heading'),    gc.review_section_title    || "We'd Love to Hear From You");
    setText($('#bs-review-sub'),        gc.review_section_subtitle || 'Your feedback helps our team keep improving every day.');
    setText($('#bs-review-card-title'), gc.review_card_title       || 'Share Your Experience');

    var promptEl = el.querySelector('#bs-review-prompt');
    if (promptEl) {
      promptEl.textContent = gc.review_card_prompt || cfg.review_prompt || BSConfig.DEFAULTS.review_settings.review_prompt;
    }

    var reviewLink = el.querySelector('#bs-review-link');
    if (reviewLink) {
      reviewLink.href = resolveReviewUrl();
      var linkLabel = reviewLink.querySelector('span');
      var linkText = gc.review_card_btn_label || cfg.button_text || 'Review Us on Google';
      if (linkLabel) linkLabel.textContent = linkText; else reviewLink.textContent = linkText;
    }

    var fbToggle = $('#bs-feedback-toggle');
    var fbWrap   = $('#bs-feedback-form-wrap');
    if (sec && sec.show_direct_feedback === false) {
      hide(fbToggle);
      hide(fbWrap);
    } else {
      show(fbToggle);
      if (fbToggle) {
        var fbToggleSpan = fbToggle.querySelector('span');
        if (fbToggleSpan) fbToggleSpan.textContent = gc.feedback_toggle_label || 'Direct Feedback';
      }
      setText($('#bs-feedback-rating-label'), gc.feedback_rating_label || 'How would you rate your experience?');
      var msgInput  = $('#bs-feedback-msg');
      var nameInput = $('#bs-feedback-name');
      var waInput   = $('#bs-feedback-wa');
      if (msgInput  && gc.feedback_msg_placeholder)  msgInput.setAttribute('placeholder',  gc.feedback_msg_placeholder);
      if (nameInput && gc.feedback_name_placeholder) nameInput.setAttribute('placeholder', gc.feedback_name_placeholder);
      if (waInput   && gc.feedback_wa_placeholder)   waInput.setAttribute('placeholder',   gc.feedback_wa_placeholder);
      var submitBtn = $('#bs-feedback-submit');
      if (submitBtn) {
        var subSpan = submitBtn.querySelector('span');
        if (subSpan) subSpan.textContent = gc.feedback_submit_label || 'Send Feedback';
      }
      setText($('#bs-feedback-thanks-text'), gc.feedback_thanks_text || 'Thank you! Your feedback means a lot to us.');
    }

    show(el);
  }

  function renderPromotions() {
    var promos = getMergedSection('promotions');
    var sec    = getMergedSection('guest_sections');
    var ws     = getMergedSection('whatsapp_settings');
    var gen    = getMergedSection('general');
    var gc     = getMergedSection('guest_content');
    var container = $('#bs-promos-grid');
    var section   = $('#bs-promos-section');
    if (!container) return;

    setText($('#bs-promos-heading'), gc.promos_section_title    || 'Exclusive Offers');
    setText($('#bs-promos-sub'),     gc.promos_section_subtitle || 'Handpicked culinary experiences and special moments, just for you.');

    if (sec && sec.show_promotions === false) { if (section) hide(section); return; }

    var now = Date.now();
    var active = (promos || []).filter(function(p) {
      if (!p || p.active === false) return false;
      if (p.starts_at) {
        var startMs = new Date(p.starts_at).getTime();
        if (!isNaN(startMs) && now < startMs) return false;
      }
      var endStr = p.ends_at || p.expires_at;
      if (endStr) {
        var endMs = new Date(endStr + (String(endStr).length === 10 ? 'T23:59:59+07:00' : '')).getTime();
        if (!isNaN(endMs) && now > endMs) return false;
      }
      return true;
    });

    if (!active.length) { if (section) hide(section); return; }

    var defaultWaNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');
    var defaultCta   = gc.promos_card_cta_label || 'Discover More →';
    var promoWaTpl   = gc.promos_wa_template    || 'Hello Bumi Surabaya, I am interested in the promotion: {promo_name} at {outlet_name}. Please share reservation details.';

    var html = active.map(function(p) {
      var pId = escapeHtml(p.id || '');
      var pName = escapeHtml(p.name || '');
      var pOutlet = escapeHtml(p.outlet || 'F&B');
      var pDesc = escapeHtml(p.description || '');
      var pPrice = escapeHtml(p.price || '');
      var pPeriod = escapeHtml(p.period || '');
      var pEmoji = escapeHtml(p.emoji || '🍽️');
      var resolvedImg = p.image_url ? (window.BSConfig ? BSConfig.resolveAsset(p.image_url) : p.image_url) : '';
      var safeImg = resolvedImg ? sanitizeUrl(resolvedImg) : '';
      var imgHtml = safeImg && safeImg !== '#'
        ? '<img src="' + escapeHtml(safeImg) + '" alt="' + pName + '" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';"><div class="bs-promo-img-placeholder" style="display:none;">' + pEmoji + '</div>'
        : '<div class="bs-promo-img-placeholder">' + pEmoji + '</div>';

      var targetUrl = '';
      if (p.cta_url && sanitizeUrl(p.cta_url) !== '#') {
        targetUrl = sanitizeUrl(p.cta_url);
      } else {
        var promoMsg = promoWaTpl
          .replace(/\{promo_name\}/g, p.name || 'Special Offer')
          .replace(/\{outlet_name\}/g, p.outlet || 'Bumi Surabaya')
          .replace(/\{outlet\}/g, p.outlet || 'Bumi Surabaya');
        targetUrl = 'https://wa.me/' + defaultWaNum + '?text=' + encodeURIComponent(promoMsg);
      }
      var ctaLabel = escapeHtml(p.cta_label || defaultCta);

      return '<div class="bs-promo-card" data-promo-id="' + pId + '">' +
        '<div class="bs-promo-img-wrap">' + imgHtml + '</div>' +
        '<div class="bs-promo-body">' +
          '<div class="bs-promo-badge">' + pOutlet + '</div>' +
          '<h3 class="bs-promo-name">' + pName + '</h3>' +
          '<p class="bs-promo-desc">' + pDesc + '</p>' +
          (pPrice ? '<div class="bs-promo-price">' + pPrice + '</div>' : '') +
          (pPeriod ? '<div class="bs-promo-period"><span class="bs-period-icon">🗓️</span> ' + pPeriod + '</div>' : '') +
          '<div class="bs-promo-footer">' +
            '<a href="' + escapeHtml(targetUrl) + '" target="_blank" rel="noopener noreferrer" class="bs-btn bs-btn-gold bs-btn-sm bs-promo-action-btn" data-promo-id="' + pId + '" aria-label="' + ctaLabel + ' - ' + pName + '">' +
              ctaLabel +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    setHTML(container, html);

    $$('.bs-promo-action-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var promoId = btn.getAttribute('data-promo-id');
        if (window.BSTracker) {
          BSTracker.track('promotion_click', { promo_id: promoId });
        }
      });
    });

    if (section) show(section);
  }

  function renderOutlets() {
    var outlets = getMergedSection('outlets');
    var sec     = getMergedSection('guest_sections');
    var ws      = getMergedSection('whatsapp_settings');
    var gen     = getMergedSection('general');
    var gc      = getMergedSection('guest_content');
    var container = $('#bs-outlets-grid');
    var section   = $('#bs-outlets-section');
    if (!container) return;

    setText($('#bs-outlets-heading'), gc.outlets_section_title    || 'Discover Dining');
    setText($('#bs-outlets-sub'),     gc.outlets_section_subtitle || 'Explore our iconic F&B outlets, each with its own culinary story.');

    if (sec && sec.show_outlets === false) { if (section) hide(section); return; }

    var activeOutlets = (outlets || []).filter(function(o) {
      return o && o.active !== false;
    });

    if (!activeOutlets.length) { if (section) hide(section); return; }

    var defaultWaNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');
    var outletCtaLbl = gc.outlets_card_cta_label || 'Explore & Reserve →';
    var outletWaTpl  = gc.outlets_wa_template    || 'Hello Bumi Surabaya, I would like the menu and table reservation info at {outlet_name}.';

    var html = activeOutlets.map(function(o) {
      var oId = escapeHtml(o.id || '');
      var oName = escapeHtml(o.name || '');
      var oEmoji = escapeHtml(o.emoji || '🍽️');
      var oType = escapeHtml(o.type || '');
      var oDesc = escapeHtml(o.description || '');
      var oHours = escapeHtml(o.hours || '');
      var oHighlight = escapeHtml(o.highlight || '');
      var resolvedImg = o.image_url ? (window.BSConfig ? BSConfig.resolveAsset(o.image_url) : o.image_url) : '';
      var safeImg = resolvedImg ? sanitizeUrl(resolvedImg) : '';
      var imgHtml = safeImg && safeImg !== '#'
        ? '<img src="' + escapeHtml(safeImg) + '" alt="' + oName + '" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\';"><div class="bs-outlet-img-placeholder" style="display:none;">' + oEmoji + '</div>'
        : '<div class="bs-outlet-img-placeholder">' + oEmoji + '</div>';

      var targetUrl = '';
      if (o.reservation_url && sanitizeUrl(o.reservation_url) !== '#') {
        targetUrl = sanitizeUrl(o.reservation_url);
      } else if (o.url && sanitizeUrl(o.url) !== '#') {
        targetUrl = sanitizeUrl(o.url);
      } else {
        var outletWa = cleanPhone(o.whatsapp) || defaultWaNum;
        var outletMsg = outletWaTpl
          .replace(/\{outlet_name\}/g, o.name || 'the restaurant')
          .replace(/\{outlet\}/g, o.name || 'the restaurant');
        targetUrl = 'https://wa.me/' + outletWa + '?text=' + encodeURIComponent(outletMsg);
      }

      return '<div class="bs-outlet-card" data-outlet-id="' + oId + '">' +
        '<div class="bs-outlet-img-wrap">' +
          imgHtml +
          (oHighlight ? '<span class="bs-outlet-badge">' + oHighlight + '</span>' : '') +
        '</div>' +
        '<div class="bs-outlet-content">' +
          '<div class="bs-outlet-header-row">' +
            '<h3 class="bs-outlet-name">' + oName + '</h3>' +
            '<span class="bs-outlet-icon-inline" aria-hidden="true">' + oEmoji + '</span>' +
          '</div>' +
          '<div class="bs-outlet-type">' + oType + '</div>' +
          '<p class="bs-outlet-desc">' + oDesc + '</p>' +
          (oHours ? '<div class="bs-outlet-hours"><span class="bs-time-icon">🕒</span> ' + oHours + '</div>' : '') +
          '<div class="bs-outlet-footer">' +
            '<a href="' + escapeHtml(targetUrl) + '" target="_blank" rel="noopener noreferrer" class="bs-outlet-action-btn" data-outlet-id="' + oId + '" aria-label="Explore outlet and reservations ' + oName + '">' +
              escapeHtml(o.cta_label || outletCtaLbl) +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    setHTML(container, html);

    $$('.bs-outlet-action-btn').forEach(function(link) {
      link.addEventListener('click', function() {
        var outletId = link.getAttribute('data-outlet-id');
        if (window.BSTracker) {
          BSTracker.track('outlet_click', { outlet_id: outletId });
        }
      });
    });

    if (section) show(section);
  }

  function renderWaSection() {
    var sec = getMergedSection('guest_sections');
    var gc  = getMergedSection('guest_content');
    var el  = $('#bs-wa-section');

    setText($('#bs-wa-status-text'), gc.wa_status_pill      || 'Concierge Online');
    setText($('#bs-wa-heading'),     gc.wa_section_title    || 'Reservations & Inquiries');
    setText($('#bs-wa-sub'),         gc.wa_section_subtitle || 'Our team is one message away — table reservations, private events, and special requests.');
    var waLink = $('#bs-wa-link');
    if (waLink) {
      var waLinkSpan = waLink.querySelector('span');
      if (waLinkSpan) waLinkSpan.textContent = gc.wa_btn_label || 'Chat on WhatsApp';
    }

    setText($('#bs-wa-picker-badge'), gc.wa_picker_badge    || 'CHAT WITH US');
    setText($('#bs-wa-picker-title'), gc.wa_picker_title    || 'Choose who to chat with');
    setText($('#bs-wa-picker-sub'),   gc.wa_picker_subtitle || 'Our sales team is ready to help you on WhatsApp. Pick a contact below:');

    if (!el) return;
    if (sec && sec.show_wa === false) { hide(el); return; }
    show(el);
  }

  function renderSocial() {
    var gen = getMergedSection('general');
    var sec = getMergedSection('guest_sections');
    var gc  = getMergedSection('guest_content');
    var el  = $('#bs-social-section');
    if (!el) return;

    setText($('#bs-social-heading'), gc.social_section_title    || 'Stay Connected');
    setText($('#bs-social-sub'),     gc.social_section_subtitle || 'Follow us for the latest stories and exclusive offers.');

    if (sec && sec.show_social === false) { hide(el); return; }

    var links = [];
    if (gen.instagram) links.push({ href: sanitizeUrl(gen.instagram), label: gc.social_label_instagram || '📸 Instagram', cls: 'instagram' });
    if (gen.facebook)  links.push({ href: sanitizeUrl(gen.facebook),  label: gc.social_label_facebook  || '👍 Facebook',  cls: 'facebook'  });
    if (gen.tiktok)    links.push({ href: sanitizeUrl(gen.tiktok),    label: gc.social_label_tiktok    || '🎵 TikTok',    cls: 'tiktok'    });
    if (gen.youtube)   links.push({ href: sanitizeUrl(gen.youtube),   label: gc.social_label_youtube   || '▶️ YouTube',   cls: 'youtube'   });
    if (gen.website)   links.push({ href: sanitizeUrl(gen.website),   label: gc.social_label_website   || '🌐 Official Website', cls: 'website' });

    var validLinks = links.filter(function(l) { return l.href && l.href !== '#'; });

    var container = el.querySelector('#bs-social-links');
    if (container && validLinks.length) {
      setHTML(container, validLinks.map(function(l) {
        return '<a href="' + escapeHtml(l.href) + '" target="_blank" rel="noopener noreferrer" class="bs-social-link">' + escapeHtml(l.label) + '</a>';
      }).join(''));
      show(el);
    } else {
      hide(el);
    }
  }

  function renderFooterAndModals() {
    var gen = getMergedSection('general');
    var sec = getMergedSection('guest_sections');
    var gc  = getMergedSection('guest_content');

    var finalSec = $('#bs-final-section') || $('.bs-final');
    if (finalSec) {
      setText($('#bs-final-heading'), gc.final_cta_title    || 'We Look Forward to Welcoming You Again');
      setText($('#bs-final-sub'),     gc.final_cta_subtitle || 'Until your next memorable experience at Hotel Bumi Surabaya.');
      if (sec && sec.show_final_cta === false) hide(finalSec); else show(finalSec);
    }

    var mobBar = $('#bs-mobile-bar') || $('.bs-mobile-action-bar');
    if (mobBar) {
      if (sec && sec.show_mobile_bar === false) hide(mobBar); else show(mobBar);
    }

    setText($('#bs-hotel-name-footer'),     gen.hotel_name || 'Bumi Surabaya City Resort');
    setText($('#bs-address-footer'),        gen.address    || '');
    setText($('#bs-privacy-link'),          gc.footer_privacy_label   || 'Privacy & Data Use Policy');
    setText($('#bs-footer-admin-link'),     gc.footer_admin_label     || 'Management Portal');
    setText($('#bs-footer-copyright-text'), gc.footer_copyright       || '© 2026 Bumi Surabaya City Resort. All rights reserved.');
    setText($('#bs-footer-version-tag'),    gc.footer_version_tag     || 'Digital Guest Experience v6.4');

    var adminLink = $('#bs-footer-admin-link') || $('.bs-footer-admin');
    var footerSep = $('#bs-footer-sep')        || $('.bs-footer-sep');
    if (gc.footer_show_admin_link === false) {
      hide(adminLink);
      hide(footerSep);
    } else {
      show(adminLink);
      show(footerSep);
    }

    setText($('#bs-privacy-badge'),          gc.privacy_badge        || 'WORLD-CLASS RESORT PRIVACY STANDARD');
    setText($('#bs-privacy-title'),          gc.privacy_title        || 'Guest Privacy & Data Use Policy');
    setText($('#bs-privacy-lead-bold'),      gc.privacy_lead_bold    || 'Bumi Surabaya City Resort is committed to transparent, secure, and ethical privacy.');
    setText($('#bs-privacy-lead-sub'),       gc.privacy_lead_sub     || 'Your comfort and peace of mind are our absolute priority. We are fully transparent about the data processed when you use this digital service portal.');
    setText($('#bs-privacy-b1-title'),       gc.privacy_block1_title || 'Personal data we NEVER collect:');
    setText($('#bs-privacy-b2-title'),       gc.privacy_block2_title || 'Pseudonymous & technical data we process:');
    setText($('#bs-privacy-b3-title'),       gc.privacy_block3_title || 'Purpose & data retention:');
    setText($('#bs-privacy-subtext'),        gc.privacy_subtext      || 'By using this service, you help us build a finer, more transparent, and more trusted five-star hospitality standard together.');
    setText($('#bs-privacy-understand-btn'), gc.privacy_btn_label    || 'I Understand');

    function renderPrivacyList(listEl, items) {
      if (!listEl || !Array.isArray(items) || !items.length) return;
      listEl.innerHTML = '';
      items.forEach(function(itemText) {
        var txt = String(itemText || '').trim();
        if (!txt) return;
        var li = document.createElement('li');
        var colonIdx = txt.indexOf(':');
        if (colonIdx > 0 && colonIdx < 45) {
          var st = document.createElement('strong');
          st.textContent = txt.substring(0, colonIdx + 1);
          li.appendChild(st);
          li.appendChild(document.createTextNode(txt.substring(colonIdx + 1)));
        } else {
          li.textContent = txt;
        }
        listEl.appendChild(li);
      });
    }

    renderPrivacyList($('#bs-privacy-b1-list'), gc.privacy_block1_items);
    renderPrivacyList($('#bs-privacy-b2-list'), gc.privacy_block2_items);
    renderPrivacyList($('#bs-privacy-b3-list'), gc.privacy_block3_items);
  }

  var _feedbackInitialized = false;
  function initDirectFeedback() {
    if (_feedbackInitialized) return;
    var toggle  = $('#bs-feedback-toggle');
    var wrap    = $('#bs-feedback-form-wrap');
    var form    = $('#bs-feedback-form');
    var thanks  = $('#bs-feedback-thanks');
    var errEl   = $('#bs-feedback-error');
    var stars   = $$('.bs-star');
    if (!toggle || !wrap || !form) return;
    _feedbackInitialized = true;

    var rating = 0;

    function showError(msg) {
      if (!errEl) return;
      if (msg) { errEl.textContent = msg; show(errEl); }
      else hide(errEl);
    }

    toggle.addEventListener('click', function() {
      var open = wrap.classList.contains('bs-hidden');
      if (open) { show(wrap); toggle.setAttribute('aria-expanded', 'true'); }
      else { hide(wrap); toggle.setAttribute('aria-expanded', 'false'); }
    });

    stars.forEach(function(star) {
      star.addEventListener('click', function() {
        rating = parseInt(star.getAttribute('data-value'), 10) || 0;
        stars.forEach(function(s) {
          var v = parseInt(s.getAttribute('data-value'), 10) || 0;
          var on = v <= rating;
          s.classList.toggle('active', on);
          s.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        showError('');
      });
    });

    function throttleKey() {
      var d = new Date();
      return 'bs_feedback_' + d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }
    function throttleOk() {
      try {
        var n = parseInt(localStorage.getItem(throttleKey()) || '0', 10) || 0;
        return n < 3;
      } catch (e) { return true; }
    }
    function throttleBump() {
      try {
        var k = throttleKey();
        var n = parseInt(localStorage.getItem(k) || '0', 10) || 0;
        localStorage.setItem(k, String(n + 1));
      } catch (e) {}
    }

    form.addEventListener('submit', function(ev) {
      ev.preventDefault();
      showError('');
      var msg  = ($('#bs-feedback-msg')  ? $('#bs-feedback-msg').value  : '').trim();
      var name = ($('#bs-feedback-name') ? $('#bs-feedback-name').value : '').trim();
      var wa   = ($('#bs-feedback-wa')   ? $('#bs-feedback-wa').value   : '').trim();

      if (!rating)            { showError('Please select a star rating.'); return; }
      if (!msg)               { showError('Please tell us about your experience.'); return; }
      if (msg.length > 500)   { showError('Message is too long (max 500 characters).'); return; }
      if (!throttleOk())      { showError('You have reached today\u2019s feedback limit. Please try again tomorrow.'); return; }

      var gasUrl = (window.BSConfig && typeof window.BSConfig.getGasUrl === 'function')
        ? window.BSConfig.getGasUrl() : '';
      if (!gasUrl) { showError('Service unavailable. Please try again later.'); return; }

      var submitBtn = $('#bs-feedback-submit');
      if (submitBtn) submitBtn.disabled = true;

      var srcObj = (typeof _sourceObj !== 'undefined') ? _sourceObj : null;
      var hpValue = (window._bsHpValue || ($('#bs-hp-website') ? $('#bs-hp-website').value : '') || '').substring(0, 100);
      var payload = {
        action:      'submit_feedback',
        rating:      rating,
        message:     msg,
        guest_name:  name.substring(0, 80),
        guest_wa:    wa.replace(/[^0-9+]/g, '').substring(0, 20),
        source:      (window.BSTracker ? BSTracker.getSource() : 'general') || 'general',
        source_type: (window.BSTracker ? BSTracker.getSourceType() : 'general') || 'general',
        source_name: (srcObj && srcObj.name) || '',
        outlet:      (srcObj && srcObj.outlet) || '',
        device_id:   (window.BSTracker && BSTracker.getDeviceId) ? BSTracker.getDeviceId() : '',
        session_id:  (window.BSTracker ? BSTracker.getSessionId() : ''),
        hp:          hpValue,
        ts_client:   new Date().toISOString()
      };

      fetch(gasUrl, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body:    JSON.stringify(payload)
      }).then(function(r) {
        return r.json().then(function(data) {
          if (!r.ok || !data || data.ok !== true) {
            throw new Error((data && data.error) || ('HTTP ' + r.status));
          }
          throttleBump();
          hide(form); show(thanks);
          if (window.BSTracker) BSTracker.track('direct_feedback_submit', { rating: rating });
        });
      }).catch(function(err) {
        showError('Could not send feedback: ' + (err && err.message ? err.message : 'network error') + '. Please try again.');
        if (submitBtn) submitBtn.disabled = false;
      });
    });
  }

  var _privacyInitialized = false;
  function initPrivacyModal() {
    if (_privacyInitialized) return;
    var overlay = $('#bs-privacy-modal');
    var openBtn = $('#bs-privacy-link');
    var closeBtn = $('#bs-privacy-close');
    var understandBtn = $('#bs-privacy-understand-btn');
    if (!overlay) return;
    _privacyInitialized = true;
    var _previousActiveElement = null;

    function openModal() {
      _previousActiveElement = document.activeElement;
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      if (_previousActiveElement && typeof _previousActiveElement.focus === 'function') {
        _previousActiveElement.focus();
      }
    }

    if (openBtn)       openBtn.addEventListener('click', function(e) { e.preventDefault(); openModal(); });
    if (closeBtn)      closeBtn.addEventListener('click', closeModal);
    if (understandBtn) understandBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    document.addEventListener('keydown', function(e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeModal();
        return;
      }
      if (e.key === 'Tab') {
        var focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables || !focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
      }
    });
  }

  function getSalesList() {
    var out = [];
    for (var i = 0; i < _sources.length; i++) {
      var s = _sources[i];
      if (!s || s.active === false) continue;
      if ((s.type || '') !== 'sales') continue;
      var phone = cleanPhone(s.whatsapp || '');
      if (!phone) continue;
      var roleLabel = [s.role, s.outlet].filter(Boolean).join(' · ') || 'Sales & Reservation';
      out.push({
        code:             s.code || '',
        name:             s.name || 'Sales',
        role:             roleLabel,
        phone:            phone,
        service_hours:    s.service_hours || '',
        welcome_template: s.welcome_template || ''
      });
    }
    return out;
  }

  function waPickerDefault() {
    var gen = getMergedSection('general');
    var ws  = getMergedSection('whatsapp_settings');
    var num = cleanPhone((ws && ws.number) || (gen && gen.whatsapp) || '628113388523');
    var msg = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';
    return { num: num, msg: msg };
  }

  function buildWaPickerList() {
    var listEl = $('#bs-wa-picker-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    var sales = getSalesList();
    var ws    = getMergedSection('whatsapp_settings');
    var gc    = getMergedSection('guest_content');
    var tplGeneral = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';
    var rowCtaLbl  = gc.wa_picker_row_cta || 'Chat';

    function salesRow(s) {
      var msg = (s.welcome_template || tplGeneral).replace(/\{staff_name\}/g, s.name);
      var a = document.createElement('a');
      a.className = 'bs-wa-sales-row';
      a.href = sanitizeUrl('https://wa.me/' + s.phone + '?text=' + encodeURIComponent(msg));
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var info = document.createElement('span');
      info.className = 'bs-wa-sales-info';
      var avatar = document.createElement('span');
      avatar.className = 'bs-wa-sales-avatar';
      avatar.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i>';
      var txt = document.createElement('span');
      var nm = document.createElement('span');
      nm.className = 'bs-wa-sales-name';
      nm.textContent = s.name;
      var rl = document.createElement('span');
      rl.className = 'bs-wa-sales-role';
      rl.textContent = s.role + (s.service_hours ? (' (' + s.service_hours + ')') : '');
      txt.appendChild(nm);
      txt.appendChild(document.createElement('br'));
      txt.appendChild(rl);
      info.appendChild(avatar);
      info.appendChild(txt);
      var cta = document.createElement('span');
      cta.className = 'bs-wa-sales-cta';
      cta.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i> ' + escapeHtml(rowCtaLbl);
      a.appendChild(info);
      a.appendChild(cta);
      a.addEventListener('click', function() {
        if (window.BSTracker) BSTracker.track('whatsapp_click', { sales_code: s.code || 'default' });
      });
      return a;
    }

    if (sales.length) {
      sales.forEach(function(s) {
        listEl.appendChild(salesRow(s));
      });
    } else {
      var wrap = document.createElement('div');
      wrap.className = 'bs-wa-picker-empty';
      var p = document.createElement('p');
      p.textContent = gc.wa_picker_empty_text || 'Our sales team contacts are being updated. Meanwhile, you can reach our main reservation line below:';
      var def = waPickerDefault();
      var fb = document.createElement('a');
      fb.className = 'bs-btn bs-btn-gold';
      fb.href = sanitizeUrl('https://wa.me/' + def.num + '?text=' + encodeURIComponent(def.msg));
      fb.target = '_blank';
      fb.rel = 'noopener noreferrer';
      fb.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i> ' + escapeHtml(gc.wa_picker_fallback_btn || 'Chat Reservation');
      fb.addEventListener('click', function() {
        if (window.BSTracker) BSTracker.track('whatsapp_click', { sales_code: 'default' });
      });
      wrap.appendChild(p);
      wrap.appendChild(fb);
      listEl.appendChild(wrap);
    }
  }

  var _waPickerPreviousActive = null;

  function openWaPicker() {
    var overlay = $('#bs-wa-picker');
    if (!overlay) return;
    buildWaPickerList();
    _waPickerPreviousActive = document.activeElement;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    var closeBtn = $('#bs-wa-picker-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeWaPicker() {
    var overlay = $('#bs-wa-picker');
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    if (_waPickerPreviousActive && typeof _waPickerPreviousActive.focus === 'function') {
      _waPickerPreviousActive.focus();
    }
  }

  var _waPickerInitialized = false;
  function initWaPicker() {
    if (_waPickerInitialized) return;
    var overlay = $('#bs-wa-picker');
    var closeBtn = $('#bs-wa-picker-close');
    if (!overlay) return;
    _waPickerInitialized = true;
    if (closeBtn) closeBtn.addEventListener('click', closeWaPicker);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeWaPicker();
    });
    document.addEventListener('keydown', function(e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        closeWaPicker();
        return;
      }
      if (e.key === 'Tab') {
        var focusables = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!focusables || !focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    });
  }

  function bindCtaTracking() {
    var reviewBtn   = $('#bs-btn-review');
    var reviewLink  = $('#bs-review-link');
    var mobReview   = $('.bs-mob-review');
    var finalReview = $('#bs-final-review');
    [reviewBtn, reviewLink, mobReview, finalReview].forEach(function(btn) {
      if (btn && !btn.getAttribute('data-rev-bound')) {
        btn.setAttribute('data-rev-bound', '1');
        btn.addEventListener('click', function() {
          if (window.BSTracker) BSTracker.track('google_review_click', {});
        });
      }
    });
  }

  function renderAll() {
    renderHero();
    renderReviewSection();
    renderPromotions();
    renderOutlets();
    renderWaSection();
    renderSocial();
    renderFooterAndModals();
    bindCtaTracking();
    initPrivacyModal();
    initWaPicker();
    initDirectFeedback();
  }

  function checkPreviewDraft() {
    var isPreview = (new URLSearchParams(window.location.search).get('preview') === '1');
    if (!isPreview) return;
    try {
      var raw = sessionStorage.getItem('bs_preview_config');
      if (raw) {
        var draft = JSON.parse(raw);
        if (draft) {
          _config = Object.assign({}, _config || BSConfig.DEFAULTS, draft);
          if (Array.isArray(draft.promotions)) _config.promotions = draft.promotions;
          if (Array.isArray(draft.outlets))    _config.outlets    = draft.outlets;
          if (draft.guest_content && typeof draft.guest_content === 'object') {
            _config.guest_content = Object.assign({}, BSConfig.DEFAULTS.guest_content, draft.guest_content);
          }
        }
      }
      var sRaw = sessionStorage.getItem('bs_preview_sources');
      if (sRaw) {
        var sDraft = JSON.parse(sRaw);
        if (Array.isArray(sDraft)) _sources = sDraft;
      }
      if (!$('#bs-draft-preview-banner')) {
        var banner = document.createElement('div');
        banner.id = 'bs-draft-preview-banner';
        banner.style.cssText = 'position:sticky;top:0;z-index:9999;background:#1a3c2a;color:#c9a96e;padding:10px 16px;text-align:center;font-size:0.84rem;font-weight:600;border-bottom:2px solid #c9a96e;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        banner.innerHTML = '<strong>Mode Pratinjau Draft Admin</strong> — Menampilkan simulasi konten sebelum dipublikasikan ke tamu.';
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } catch (e) {
      console.warn('[BSApp] Gagal menerapkan preview draft:', e);
    }
  }

  function init() {
    var gasUrl = window.BSConfig ? BSConfig.getGasUrl() : '';

    if (window.BSTracker) {
      BSTracker.init({ gasUrl: gasUrl });
    }

    if (window.BSConfig) {
      BSConfig.loadConfig(gasUrl, function(cfg, sources) {
        _config  = cfg;
        _sources = sources || [];
        checkPreviewDraft();
        renderAll();
        var loading = $('#bs-loading');
        var main    = $('#bs-main');
        if (loading) loading.classList.add('bs-hidden');
        if (main)    main.classList.remove('bs-hidden');
      }, function(err) {
        console.warn('[BSApp] Config load error:', err);
        checkPreviewDraft();
        renderAll();
        var loading = $('#bs-loading');
        var main    = $('#bs-main');
        if (loading) loading.classList.add('bs-hidden');
        if (main)    main.classList.remove('bs-hidden');
      });
    } else {
      checkPreviewDraft();
      renderAll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.BSApp = {
    getSourceObj:      function() { return _sourceObj; },
    resolveActiveLang: resolveActiveLang,
    renderAll:         renderAll
  };

})(window, document);
