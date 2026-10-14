/**
 * BUMI SURABAYA v5.0
 * app.js — Logika presentasi tampilan tamu
 *
 * Bertanggung jawab untuk:
 * 1. Inisialisasi konfigurasi dari backend (atau fallback ke defaults)
 * 2. Sapaan personal berdasarkan ?source= (FR-GUE-01)
 * 3. Render promosi, outlet, tombol CTA (FR-GUE-02, FR-GUE-03)
 * 4. Modal privasi (FR-GUE-04)
 * 5. Koordinasi dengan BSTracker & BSConfig
 */

(function(window, document) {
  'use strict';

  // ── Utilitas DOM & Sanitasi ──────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel){ return document.querySelectorAll(sel); }
  function setText(el, txt) { if (el) el.textContent = txt; }
  function setHTML(el, html){ if (el) el.innerHTML   = html; }
  function show(el)  { if (el) el.classList.remove('bs-hidden'); }
  function hide(el)  { if (el) el.classList.add('bs-hidden'); }

  /**
   * Escape HTML string untuk mencegah injeksi XSS (GUE-04).
   * @param {*} str
   * @returns {string}
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Validasi dan sanitasi URL untuk mencegah javascript: dan skema berbahaya lainnya (GUE-04).
   * @param {string} url
   * @returns {string}
   */
  function sanitizeUrl(url) {
    if (!url) return '#';
    var u = String(url).trim();
    if (/^(javascript|vbscript|data|file):/i.test(u)) {
      return '#';
    }
    return u;
  }

  /**
   * Normalisasi nomor telepon ke format internasional 62xxx (GUE-06).
   * @param {*} num
   * @returns {string}
   */
  function cleanPhone(num) {
    if (!num) return '';
    var clean = String(num).replace(/[^0-9]/g, '');
    if (clean.indexOf('0') === 0) clean = '62' + clean.substring(1);
    return clean;
  }

  // ── State ─────────────────────────────────────────────────
  var _config  = null;
  var _sources = [];
  var _sourceObj = null;  // Objek sumber aktif {code, name, type, role, outlet}

  /**
   * Ambil sumber aktif dari cache Sources berdasarkan kode URL (GUE-03, SRC-02, SRC-04).
   * Rotasi kode mencabut kode lama secara default. Kode lama hanya berlaku bila
   * mode migrasi aktif dengan masa tenggang berlabel yang belum habis.
   */
  function findSource(code) {
    if (!code || code === 'general') return null;
    var lc = code.toLowerCase().trim();
    for (var i = 0; i < _sources.length; i++) {
      var s = _sources[i];
      // Hanya sumber aktif yang dapat diatribusikan (GUE-03, SRC-02)
      if (s.active === false) continue;

      // Kode utama aktif
      if ((s.code || '').toLowerCase().trim() === lc) return s;

      // Cek kode lama (legacy_codes) — hanya jika mode migrasi aktif dan belum kedaluwarsa (SRC-04)
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

  // REV-01: URL review mengikuti outlet pada halaman tamu.
  // REV-03: link g.page lama mati (redirect ke google.com) — default diganti
  // URL Google Review Arumanis yang terverifikasi aktif.
  // Urutan: review_url outlet sumber > review_settings.review_url > general.google_review_url > default Arumanis
  var ARUMANIS_REVIEW_URL = 'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU';
  function resolveReviewUrl() {
    var gen = (_config && _config.general)         || BSConfig.DEFAULTS.general;
    var rev = (_config && _config.review_settings) || BSConfig.DEFAULTS.review_settings;
    var outletUrl = '';
    if (_sourceObj && _sourceObj.outlet) {
      var ol = String(_sourceObj.outlet).toLowerCase().trim();
      var outlets = (_config && _config.outlets) || [];
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

  // ── Render hero & sapaan ──────────────────────────────────
  function renderHero() {
    var gen = (_config && _config.general)    || BSConfig.DEFAULTS.general;
    var app = (_config && _config.appearance) || BSConfig.DEFAULTS.appearance;
    var rev = (_config && _config.review_settings) || BSConfig.DEFAULTS.review_settings;
    var ws  = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var sec = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;

    // Nama hotel & judul hero dinamis (CNT-06)
    var heroTitle = app.hero_text || gen.hotel_name || 'Bumi Surabaya City Resort';
    setText($('#bs-hotel-name'), heroTitle);
    setText($('#bs-subtitle'), app.hero_subtitle || '');

    // Sapaan personal berdasarkan source
    var src = BSTracker.getSource();
    _sourceObj = findSource(src);

    var welcomeEl = $('#bs-welcome-msg');
    var staffBadgeEl = $('#bs-staff-badge');

    if (_sourceObj) {
      // Sumber aktif dikenali — render secara aman via DOM API (GUE-04)
      var st = _sourceObj.type || 'staff';
      if (st === 'staff' || st === 'sales') {
        if (welcomeEl) {
          welcomeEl.textContent = '';
          var prefixText = (app.welcome_msg_staff && app.welcome_msg_staff.indexOf('{staff_name}') !== -1)
            ? ''
            : 'Hello! You are currently being served wholeheartedly by ';
          if (prefixText) welcomeEl.appendChild(document.createTextNode(prefixText));

          if (app.welcome_msg_staff && app.welcome_msg_staff.indexOf('{staff_name}') !== -1) {
            var parts = app.welcome_msg_staff.split('{staff_name}');
            welcomeEl.appendChild(document.createTextNode(parts[0]));
            var strongName = document.createElement('strong');
            strongName.textContent = _sourceObj.name || 'our team';
            welcomeEl.appendChild(strongName);
            var rest = (parts[1] || '')
              .replace('{role}', _sourceObj.role || '')
              .replace('{outlet}', _sourceObj.outlet || '');
            welcomeEl.appendChild(document.createTextNode(rest));
          } else {
            var strongName = document.createElement('strong');
            strongName.textContent = _sourceObj.name || 'our team';
            welcomeEl.appendChild(strongName);
            if (_sourceObj.role) {
              welcomeEl.appendChild(document.createTextNode(' (' + _sourceObj.role + ')'));
            }
            if (_sourceObj.outlet) {
              welcomeEl.appendChild(document.createTextNode(' from '));
              var emOutlet = document.createElement('em');
              emOutlet.textContent = _sourceObj.outlet;
              welcomeEl.appendChild(emOutlet);
            }
            welcomeEl.appendChild(document.createTextNode('.'));
          }
        }
        if (staffBadgeEl) {
          staffBadgeEl.textContent = '';
          var dot = document.createElement('span');
          dot.className = 'bs-dot';
          staffBadgeEl.appendChild(dot);
          staffBadgeEl.appendChild(document.createTextNode('Served by ' + (_sourceObj.name || '-')));
          show(staffBadgeEl);
        }
      } else if (st === 'outlet') {
        if (welcomeEl) {
          var baseMsg = app.welcome_msg_outlet || 'Enjoy an exclusive culinary experience at {outlet_name}.';
          welcomeEl.textContent = baseMsg.replace('{outlet_name}', _sourceObj.name || '');
        }
        hide(staffBadgeEl);
      } else if (st === 'nfc') {
        if (welcomeEl) {
          welcomeEl.textContent = '';
          welcomeEl.appendChild(document.createTextNode('Welcome to '));
          var strongOutlet = document.createElement('strong');
          strongOutlet.textContent = _sourceObj.outlet || _sourceObj.name || gen.hotel_name || 'Bumi Surabaya City Resort';
          welcomeEl.appendChild(strongOutlet);
          welcomeEl.appendChild(document.createTextNode('! Enjoy an unforgettable experience with us.'));
        }
        hide(staffBadgeEl);
      }
    } else {
      // Sumber nonaktif / tidak dikenali / default (GUE-03)
      if (welcomeEl) welcomeEl.textContent = app.welcome_msg_general || BSConfig.DEFAULTS.appearance.welcome_msg_general;
      hide(staffBadgeEl);
    }

    // Hero background
    if (app.hero_bg_url) {
      var safeBg = sanitizeUrl(app.hero_bg_url);
      if (safeBg && safeBg !== '#') {
        var hero = $('.bs-hero');
        if (hero) {
          hero.style.backgroundImage = 'url("' + encodeURI(safeBg) + '")';
          hero.classList.add('has-bg');
        }
      }
    }

    // Tombol Google Review (GUE-05: label jelas, mengarah ke URL benar)
    var reviewBtn = $('#bs-btn-review');
    var reviewLink = $('#bs-review-link');
    var mobReview = $('.bs-mob-review');
    // REV-01: URL review mengikuti outlet pada halaman tamu (lihat resolveReviewUrl)
    var reviewUrl = resolveReviewUrl();
    var reviewTxt = (rev && rev.button_text) || 'Share Your Experience';
    var finalReview = $('#bs-final-review');

    if (reviewBtn) {
      reviewBtn.href = reviewUrl;
      // Teks tombol memakai <span> agar ikon FA tidak tertimpa
      var reviewLabel = reviewBtn.querySelector('span');
      if (reviewLabel) reviewLabel.textContent = reviewTxt; else reviewBtn.textContent = reviewTxt;
      if (sec && sec.show_review === false) hide(reviewBtn);
    }
    if (finalReview) finalReview.href = reviewUrl;
    if (mobReview) mobReview.href = reviewUrl;

    // Tombol WhatsApp (GUE-06: dinormalisasi dan divalidasi)
    var waNum = '';
    var waMsg = '';

    // SLS-01: nomor WhatsApp sumber hanya dipakai bila rolenya sales;
    // waiter/staf/meja jatuh ke nomor umum agar nomor pribadinya tidak diketahui tamu.
    if (_sourceObj && _sourceObj.type === 'sales' && _sourceObj.whatsapp && cleanPhone(_sourceObj.whatsapp)) {
      waNum = cleanPhone(_sourceObj.whatsapp);
      waMsg = 'Hello, I am a Bumi Surabaya guest. I am being served by ' + (_sourceObj.name || 'staff') + '.';
    } else {
      waNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');
      if (_sourceObj && (_sourceObj.type === 'staff' || _sourceObj.type === 'sales')) {
        waMsg = ((ws && ws.template_staff) || 'Hello, I am a Bumi Surabaya guest. I was just served by {staff_name} and would like to make a reservation.')
                .replace('{staff_name}', _sourceObj.name || 'tim kami');
      } else {
        waMsg = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';
      }
    }

    // REV-04: tombol WA utama TIDAK lagi langsung ke satu nomor — klik membuka
    // pemilih sales ala Linktree (openWaPicker). href tetap diisi sebagai fallback.
    var waUrl = sanitizeUrl('https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg));

    var waBtn  = $('#bs-btn-wa');
    var waLink = $('#bs-wa-link');
    var mobWa  = $('.bs-mob-wa');
    var finalWa = $('#bs-final-wa');
    [waBtn, waLink, mobWa, finalWa].forEach(function(btn) {
      if (!btn) return;
      btn.href = waUrl;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        openWaPicker();
      });
    });
  }

  // ── Render seksi Google Review ────────────────────────────
  function renderReviewSection() {
    var cfg = (_config && _config.review_settings) || BSConfig.DEFAULTS.review_settings;
    var sec = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var el  = $('#bs-review-section');
    if (!el) return;
    if (sec && sec.show_review === false) { hide(el); return; }

    var promptEl = el.querySelector('#bs-review-prompt');
    if (promptEl) promptEl.textContent = cfg.review_prompt || BSConfig.DEFAULTS.review_settings.review_prompt;

    var reviewLink = el.querySelector('#bs-review-link');
    if (reviewLink) {
      // REV-01: samakan dengan tombol utama — URL mengikuti outlet halaman tamu
      reviewLink.href = resolveReviewUrl();
      var linkLabel = reviewLink.querySelector('span');
      var linkText = cfg.button_text || BSConfig.DEFAULTS.review_settings.button_text;
      if (linkLabel) linkLabel.textContent = linkText; else reviewLink.textContent = linkText;
    }
    show(el);
  }

  // ── Render promosi (GUE-08, GUE-09, GUE-10, CNT-02 s/d CNT-05) ──
  function renderPromotions() {
    var promos = (_config && _config.promotions) || BSConfig.DEFAULTS.promotions;
    var sec    = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var ws     = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var gen    = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var container = $('#bs-promos-grid');
    var section   = $('#bs-promos-section');
    if (!container) return;

    if (sec && sec.show_promotions === false) { if (section) hide(section); return; }

    var now = Date.now();
    var active = (promos || []).filter(function(p) {
      if (!p || p.active === false) return false;
      // Validasi tanggal starts_at & ends_at (Asia/Jakarta / WIB) (GUE-08, CNT-03)
      if (p.starts_at) {
        var startMs = new Date(p.starts_at).getTime();
        if (!isNaN(startMs) && now < startMs) return false;
      }
      var endStr = p.ends_at || p.expires_at;
      if (endStr) {
        var endMs = new Date(endStr).getTime();
        if (!isNaN(endMs) && now > endMs) return false;
      }
      return true;
    });

    if (!active.length) { if (section) hide(section); return; }

    var defaultWaNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');

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

      // Tujuan CTA promo tervalidasi (GUE-10, CNT-04)
      var targetUrl = '';
      if (p.cta_url && sanitizeUrl(p.cta_url) !== '#') {
        targetUrl = sanitizeUrl(p.cta_url);
      } else {
        var promoMsg = 'Hello Bumi Surabaya, I am interested in the promotion: ' + (p.name || 'Special Offer') + ' at ' + (p.outlet || 'Bumi Surabaya') + '. Please share reservation details.';
        targetUrl = 'https://wa.me/' + defaultWaNum + '?text=' + encodeURIComponent(promoMsg);
      }
      var ctaLabel = escapeHtml(p.cta_label || 'Discover More →');

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

    // Track klik promosi pada CTA nyata
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

  // ── Render outlet (GUE-07, GUE-10, CNT-01, CNT-04, CNT-05) ──
  function renderOutlets() {
    var outlets = (_config && _config.outlets) || BSConfig.DEFAULTS.outlets;
    var sec     = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var ws      = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var gen     = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var container = $('#bs-outlets-grid');
    var section   = $('#bs-outlets-section');
    if (!container) return;

    if (sec && sec.show_outlets === false) { if (section) hide(section); return; }

    // Hanya outlet AKTIF yang dirender ke tamu (GUE-07, CNT-05)
    var activeOutlets = (outlets || []).filter(function(o) {
      return o && o.active !== false;
    });

    if (!activeOutlets.length) { if (section) hide(section); return; }

    var defaultWaNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');

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

      // Tujuan CTA tervalidasi: URL reservasi khusus / WhatsApp reservasi (GUE-07, GUE-10, CNT-01)
      var targetUrl = '';
      if (o.reservation_url && sanitizeUrl(o.reservation_url) !== '#') {
        targetUrl = sanitizeUrl(o.reservation_url);
      } else if (o.url && sanitizeUrl(o.url) !== '#') {
        targetUrl = sanitizeUrl(o.url);
      } else {
        var outletWa = cleanPhone(o.whatsapp) || defaultWaNum;
        var outletMsg = 'Hello Bumi Surabaya, I would like the menu and table reservation info at ' + (o.name || 'the restaurant') + '.';
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
              'Explore &amp; Reserve →' +
            '</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    setHTML(container, html);

    // Track klik tombol outlet yang benar-benar bernavigasi (GUE-10)
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

  // ── Render WhatsApp section ───────────────────────────────
  function renderWaSection() {
    var sec = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var el  = $('#bs-wa-section');
    if (!el) return;
    if (sec && sec.show_wa === false) { hide(el); return; }
    show(el);
  }

  // ── Render sosial media ───────────────────────────────────
  function renderSocial() {
    var gen = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var sec = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var el  = $('#bs-social-section');
    if (!el) return;
    if (sec && sec.show_social === false) { hide(el); return; }

    var links = [];
    if (gen.instagram) links.push({ href: sanitizeUrl(gen.instagram), label: '📸 Instagram', cls: 'instagram' });
    if (gen.facebook)  links.push({ href: sanitizeUrl(gen.facebook),  label: '👍 Facebook',  cls: 'facebook'  });
    if (gen.tiktok)    links.push({ href: sanitizeUrl(gen.tiktok),    label: '🎵 TikTok',    cls: 'tiktok'    });

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

  // ── Render footer ─────────────────────────────────────────
  function renderFooter() {
    var gen = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var el  = $('#bs-hotel-name-footer');
    if (el) el.textContent = gen.hotel_name || 'Bumi Surabaya City Resort';
    var addr = $('#bs-address-footer');
    if (addr) addr.textContent = gen.address || '';
  }

  // ── Direct Feedback (REV-02) ──────────────────────────────
  function initDirectFeedback() {
    var toggle  = $('#bs-feedback-toggle');
    var wrap    = $('#bs-feedback-form-wrap');
    var form    = $('#bs-feedback-form');
    var thanks  = $('#bs-feedback-thanks');
    var errEl   = $('#bs-feedback-error');
    var stars   = $$('.bs-star');
    if (!toggle || !wrap || !form) return;

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

  // ── Modal Privasi (GUE-14, PRD 6.4: Escape, Focus Trap & Return) ──
  function initPrivacyModal() {
    var overlay = $('#bs-privacy-modal');
    var openBtn = $('#bs-privacy-link');
    var closeBtn = $('#bs-privacy-close');
    var understandBtn = $('#bs-privacy-understand-btn');
    var _previousActiveElement = null;

    function openModal() {
      if (!overlay) return;
      _previousActiveElement = document.activeElement;
      overlay.classList.add('active');
      overlay.setAttribute('aria-hidden', 'false');
      // Berikan fokus ke tombol tutup pertama
      if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
      if (!overlay) return;
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
      // Kembalikan fokus ke elemen pembuka
      if (_previousActiveElement && typeof _previousActiveElement.focus === 'function') {
        _previousActiveElement.focus();
      }
    }

    if (openBtn)  openBtn.addEventListener('click', function(e) { e.preventDefault(); openModal(); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (understandBtn) understandBtn.addEventListener('click', closeModal);
    if (overlay)  overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    // Keyboard support: Escape untuk menutup & focus trap
    document.addEventListener('keydown', function(e) {
      if (!overlay || !overlay.classList.contains('active')) return;
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
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });
  }

  // ── Pemilih Sales WhatsApp ala Linktree (REV-04) ────────────────────
  // SLS-01: hanya sumber bertipe 'sales' yang nomornya boleh tampil ke tamu.
  function getSalesList() {
    var out = [];
    for (var i = 0; i < _sources.length; i++) {
      var s = _sources[i];
      if (!s || s.active === false) continue;
      if ((s.type || '') !== 'sales') continue;
      var phone = cleanPhone(s.whatsapp || '');
      if (!phone) continue;
      out.push({ code: s.code || '', name: s.name || 'Sales', phone: phone });
    }
    return out;
  }

  function waPickerDefault() {
    var gen = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var ws  = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var num = cleanPhone((ws && ws.number) || (gen && gen.whatsapp) || '628113388523');
    var msg = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';
    return { num: num, msg: msg };
  }

  function buildWaPickerList() {
    var listEl = $('#bs-wa-picker-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    var sales = getSalesList();
    var gen = (_config && _config.general) || BSConfig.DEFAULTS.general;
    var ws  = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var tplGeneral = (ws && ws.template_general) || 'Hello Bumi Surabaya, I would like information about hotel reservations and services.';

    function salesRow(name, code, phone, msg) {
      var a = document.createElement('a');
      a.className = 'bs-wa-sales-row';
      a.href = sanitizeUrl('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg));
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
      nm.textContent = name;
      var rl = document.createElement('span');
      rl.className = 'bs-wa-sales-role';
      rl.textContent = 'Sales';
      txt.appendChild(nm);
      txt.appendChild(document.createElement('br'));
      txt.appendChild(rl);
      info.appendChild(avatar);
      info.appendChild(txt);
      var cta = document.createElement('span');
      cta.className = 'bs-wa-sales-cta';
      cta.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i> Chat';
      a.appendChild(info);
      a.appendChild(cta);
      a.addEventListener('click', function() {
        if (window.BSTracker) BSTracker.track('whatsapp_click', { sales_code: code || 'default' });
      });
      return a;
    }

    if (sales.length) {
      sales.forEach(function(s) {
        listEl.appendChild(salesRow(s.name, s.code, s.phone, tplGeneral));
      });
    } else {
      // Fallback ramah bila belum ada sales terdaftar (PRD 17.2 poin 5)
      var wrap = document.createElement('div');
      wrap.className = 'bs-wa-picker-empty';
      var p = document.createElement('p');
      p.textContent = 'Our sales team contacts are being updated. Meanwhile, you can reach our main reservation line below:';
      var def = waPickerDefault();
      var fb = document.createElement('a');
      fb.className = 'bs-btn bs-btn-gold';
      fb.href = sanitizeUrl('https://wa.me/' + def.num + '?text=' + encodeURIComponent(def.msg));
      fb.target = '_blank';
      fb.rel = 'noopener noreferrer';
      fb.innerHTML = '<i class="fab fa-whatsapp" aria-hidden="true"></i> Chat Reservation';
      fb.addEventListener('click', function() {
        if (window.BSTracker) BSTracker.track('whatsapp_click', { sales_code: 'default' });
      });
      wrap.appendChild(p);
      wrap.appendChild(fb);
      listEl.appendChild(wrap);
    }
  }

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

  var _waPickerPreviousActive = null;

  function initWaPicker() {
    var overlay = $('#bs-wa-picker');
    var closeBtn = $('#bs-wa-picker-close');
    if (closeBtn) closeBtn.addEventListener('click', closeWaPicker);
    if (overlay) overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeWaPicker();
    });
    document.addEventListener('keydown', function(e) {
      if (!overlay || !overlay.classList.contains('active')) return;
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

  // ── Binding CTA event tracking ────────────────────────────
  function bindCtaTracking() {
    var reviewBtn = $('#bs-btn-review');
    var reviewLink = $('#bs-review-link');
    var mobReview = $('.bs-mob-review');
    var finalReview = $('#bs-final-review');
    [reviewBtn, reviewLink, mobReview, finalReview].forEach(function(btn) {
      if (btn) {
        btn.addEventListener('click', function() {
          if (window.BSTracker) BSTracker.track('google_review_click', {});
        });
      }
    });

    // REV-04: tombol WA utama kini membuka pemilih sales (bukan langsung ke wa.me),
    // sehingga event whatsapp_click dicatat saat tamu memilih salah satu sales
    // di dalam picker (lihat openWaPicker), bukan saat tombol diklik.
  }

  // ── Render semua ─────────────────────────────────────────
  function renderAll() {
    renderHero();
    renderReviewSection();
    renderPromotions();
    renderOutlets();
    renderWaSection();
    renderSocial();
    renderFooter();
    bindCtaTracking();
    initPrivacyModal();
    initWaPicker();
    initDirectFeedback();
  }

  // ── Pratinjau Draft Admin (CNT-09) ──────────────────────
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
          if (Array.isArray(draft.outlets)) _config.outlets = draft.outlets;
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
        banner.innerHTML = '👁️ <strong>Mode Pratinjau Draft Admin (CNT-09)</strong> — Menampilkan simulasi konten sebelum dipublikasikan ke tamu.';
        document.body.insertBefore(banner, document.body.firstChild);
      }
    } catch (e) {
      console.warn('[BSApp] Gagal menerapkan preview draft:', e);
    }
  }

  // ── Inisialisasi utama ────────────────────────────────────
  function init() {
    var gasUrl = window.BSConfig ? BSConfig.getGasUrl() : '';

    // Inisialisasi tracker dulu
    if (window.BSTracker) {
      BSTracker.init({ gasUrl: gasUrl });
    }

    // Muat konfigurasi
    if (window.BSConfig) {
      BSConfig.loadConfig(gasUrl, function(cfg, sources) {
        _config  = cfg;
        _sources = sources || [];
        checkPreviewDraft();
        renderAll();
        // Sembunyikan loading screen
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

  // ── Tunggu DOM ready ──────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Ekspos minimal ke global (untuk debugging)
  window.BSApp = { getSourceObj: function() { return _sourceObj; } };

})(window, document);
