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

  // ── Utilitas DOM ──────────────────────────────────────────
  function $(sel) { return document.querySelector(sel); }
  function $$(sel){ return document.querySelectorAll(sel); }
  function setText(el, txt) { if (el) el.textContent = txt; }
  function setHTML(el, html){ if (el) el.innerHTML   = html; }
  function show(el)  { if (el) el.classList.remove('bs-hidden'); }
  function hide(el)  { if (el) el.classList.add('bs-hidden'); }

  // ── State ─────────────────────────────────────────────────
  var _config  = null;
  var _sources = [];
  var _sourceObj = null;  // Objek sumber aktif {code, name, type, role, outlet}

  /** Ambil sumber aktif dari cache Sources berdasarkan kode URL */
  function findSource(code) {
    if (!code || code === 'general') return null;
    var lc = code.toLowerCase();
    for (var i = 0; i < _sources.length; i++) {
      var s = _sources[i];
      if (s.active === false) continue;
      if ((s.code || '').toLowerCase() === lc) return s;
      // Cek legacy_codes juga
      if (s.legacy_codes) {
        try {
          var legacy = typeof s.legacy_codes === 'string' ? JSON.parse(s.legacy_codes) : s.legacy_codes;
          if (Array.isArray(legacy) && legacy.indexOf(lc) !== -1) return s;
        } catch(e) {}
      }
    }
    return null;
  }

  // ── Render hero & sapaan ──────────────────────────────────
  function renderHero() {
    var gen = (_config && _config.general)    || BSConfig.DEFAULTS.general;
    var app = (_config && _config.appearance) || BSConfig.DEFAULTS.appearance;
    var rev = (_config && _config.review_settings) || BSConfig.DEFAULTS.review_settings;
    var ws  = (_config && _config.whatsapp_settings) || BSConfig.DEFAULTS.whatsapp_settings;
    var sec = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;

    // Nama hotel
    setText($('#bs-hotel-name'), gen.hotel_name || 'Bumi Surabaya City Resort');
    setText($('#bs-subtitle'), app.hero_subtitle || '');

    // Sapaan personal berdasarkan source
    var src = BSTracker.getSource();
    _sourceObj = findSource(src);

    var welcomeEl = $('#bs-welcome-msg');
    var staffBadgeEl = $('#bs-staff-badge');

    if (_sourceObj) {
      // Sumber dikenali
      var st = _sourceObj.type || 'staff';
      var msg = '';
      if (st === 'staff' || st === 'sales') {
        msg = 'Halo! Anda saat ini dilayani dengan tulus oleh <strong>' +
              (_sourceObj.name || 'Tim Kami') + '</strong>' +
              (_sourceObj.role ? ' (' + _sourceObj.role + ')' : '') +
              (_sourceObj.outlet ? ' dari <em>' + _sourceObj.outlet + '</em>' : '') + '.';
        if (staffBadgeEl) {
          staffBadgeEl.innerHTML = '<span class="bs-dot"></span>' +
            '🪄 Dilayani oleh ' + (_sourceObj.name || '-');
          show(staffBadgeEl);
        }
      } else if (st === 'outlet') {
        msg = (app.welcome_msg_outlet || 'Selamat menikmati {outlet_name}.')
              .replace('{outlet_name}', _sourceObj.name || '');
      } else if (st === 'nfc') {
        msg = 'Selamat datang di <strong>' + (_sourceObj.outlet || _sourceObj.name || gen.hotel_name) + '</strong>! Nikmati pengalaman tak terlupakan bersama kami.';
      }
      if (welcomeEl) { welcomeEl.innerHTML = msg; }
    } else if (src && src !== 'general') {
      // Kode tidak dikenali — ramah, tanpa error teknis
      if (welcomeEl) welcomeEl.textContent = app.welcome_msg_general || BSConfig.DEFAULTS.appearance.welcome_msg_general;
      hide(staffBadgeEl);
    } else {
      // Tanpa source
      if (welcomeEl) welcomeEl.textContent = app.welcome_msg_general || BSConfig.DEFAULTS.appearance.welcome_msg_general;
      hide(staffBadgeEl);
    }

    // Hero background
    if (app.hero_bg_url) {
      var hero = $('.bs-hero');
      if (hero) {
        hero.style.backgroundImage = 'url(' + app.hero_bg_url + ')';
        hero.classList.add('has-bg');
      }
    }

    // Tombol Google Review
    var reviewBtn = $('#bs-btn-review');
    var reviewLink = $('#bs-review-link');
    var mobReview = $('.bs-mob-review');
    var reviewUrl = (rev && rev.review_url) || gen.google_review_url || '#';
    var reviewTxt = (rev && rev.button_text) || 'Berikan Ulasan di Google ⭐';

    if (reviewBtn) {
      reviewBtn.href = reviewUrl;
      reviewBtn.textContent = reviewTxt;
      if (sec && sec.show_review === false) hide(reviewBtn.closest('.bs-hero-cta-review'));
    }
    if (mobReview) mobReview.href = reviewUrl;

    // Tombol WhatsApp (Hero, Concierge card, & Floating Mobile bar)
    function cleanPhone(num) {
      if (!num) return '';
      var clean = String(num).replace(/[^0-9]/g, '');
      if (clean.indexOf('0') === 0) clean = '62' + clean.substring(1);
      return clean;
    }

    var waNum = '';
    var waMsg = '';

    if (_sourceObj && _sourceObj.whatsapp && cleanPhone(_sourceObj.whatsapp)) {
      waNum = cleanPhone(_sourceObj.whatsapp);
      waMsg = 'Halo, saya tamu Bumi Surabaya. Saya dilayani oleh ' + (_sourceObj.name || 'staf') + '.';
    } else {
      waNum = cleanPhone((ws && ws.number) || gen.whatsapp || '628113388523');
      if (_sourceObj && (_sourceObj.type === 'staff' || _sourceObj.type === 'sales')) {
        waMsg = ((ws && ws.template_staff) || 'Halo, saya tamu Bumi Surabaya. Saya dilayani oleh {staff_name}.')
                .replace('{staff_name}', _sourceObj.name || 'tim kami');
      } else {
        waMsg = (ws && ws.template_general) || 'Halo Bumi Surabaya, saya ingin informasi mengenai reservasi dan layanan hotel.';
      }
    }

    var waUrl = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(waMsg);

    var waBtn  = $('#bs-btn-wa');
    var waLink = $('#bs-wa-link');
    var mobWa  = $('.bs-mob-wa');
    if (waBtn)  waBtn.href  = waUrl;
    if (waLink) waLink.href = waUrl;
    if (mobWa)  mobWa.href  = waUrl;
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
      reviewLink.href = cfg.review_url || BSConfig.DEFAULTS.review_settings.review_url;
      reviewLink.textContent = cfg.button_text || BSConfig.DEFAULTS.review_settings.button_text;
    }
    show(el);
  }

  // ── Render promosi ────────────────────────────────────────
  function renderPromotions() {
    var promos = (_config && _config.promotions) || BSConfig.DEFAULTS.promotions;
    var sec    = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var container = $('#bs-promos-grid');
    var section   = $('#bs-promos-section');
    if (!container) return;

    if (sec && sec.show_promotions === false) { if (section) hide(section); return; }

    var now    = Date.now();
    var active = promos.filter(function(p) {
      if (p.active === false) return false;
      if (p.expires_at) {
        try { if (new Date(p.expires_at).getTime() < now) return false; } catch(e) {}
      }
      return true;
    });

    if (!active.length) { if (section) hide(section); return; }

    var html = active.map(function(p) {
      return '<div class="bs-promo-card" data-promo-id="' + (p.id || '') + '" tabindex="0">' +
        '<div class="bs-promo-img-wrap">' +
          (p.image_url
            ? '<img src="' + p.image_url + '" alt="' + (p.name || '') + '" loading="lazy">'
            : '<div class="bs-promo-img-placeholder">' + (p.emoji || '🍽️') + '</div>') +
        '</div>' +
        '<div class="bs-promo-body">' +
          '<div class="bs-promo-badge">' + (p.outlet || 'F&amp;B') + '</div>' +
          '<div class="bs-promo-name">' + (p.name || '') + '</div>' +
          '<div class="bs-promo-desc">' + (p.description || '') + '</div>' +
          (p.price ? '<div class="bs-promo-price">' + p.price + '</div>' : '') +
          (p.period ? '<div class="bs-promo-period">🗓️ ' + p.period + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    setHTML(container, html);

    // Track klik promosi
    $$('.bs-promo-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var promoId = card.getAttribute('data-promo-id');
        if (window.BSTracker) {
          BSTracker.track('promotion_click', { promo_id: promoId });
        }
      });
    });

    if (section) show(section);
  }

  // ── Render outlet ─────────────────────────────────────────
  function renderOutlets() {
    var outlets = (_config && _config.outlets) || BSConfig.DEFAULTS.outlets;
    var sec     = (_config && _config.guest_sections) || BSConfig.DEFAULTS.guest_sections;
    var container = $('#bs-outlets-grid');
    var section   = $('#bs-outlets-section');
    if (!container) return;

    if (sec && sec.show_outlets === false) { if (section) hide(section); return; }
    if (!outlets || !outlets.length) { if (section) hide(section); return; }

    var html = outlets.map(function(o) {
      return '<div class="bs-outlet-card" tabindex="0" data-outlet-id="' + (o.id || '') + '">' +
        '<div class="bs-outlet-img-wrap">' +
          (o.image_url
            ? '<img src="' + o.image_url + '" alt="' + (o.name || '') + '" loading="lazy">'
            : '<div class="bs-outlet-img-placeholder">' + (o.emoji || '🍽️') + '</div>') +
          (o.highlight ? '<span class="bs-outlet-badge">' + o.highlight + '</span>' : '') +
        '</div>' +
        '<div class="bs-outlet-content">' +
          '<div class="bs-outlet-header-row">' +
            '<div class="bs-outlet-name">' + (o.name || '') + '</div>' +
            '<span class="bs-outlet-icon-inline" aria-hidden="true">' + (o.emoji || '') + '</span>' +
          '</div>' +
          '<div class="bs-outlet-type">' + (o.type || '') + '</div>' +
          '<div class="bs-outlet-desc">' + (o.description || '') + '</div>' +
          (o.hours ? '<div class="bs-outlet-hours"><span class="bs-time-icon">🕒</span> ' + o.hours + '</div>' : '') +
          '<div class="bs-outlet-footer">' +
            '<span class="bs-outlet-action-btn">Eksplorasi Gerai &amp; Reservasi →</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    setHTML(container, html);

    $$('.bs-outlet-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var outletId = card.getAttribute('data-outlet-id');
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
    if (gen.instagram) links.push({ href: gen.instagram, label: '📸 Instagram', cls: 'instagram' });
    if (gen.facebook)  links.push({ href: gen.facebook,  label: '👍 Facebook',  cls: 'facebook'  });
    if (gen.tiktok)    links.push({ href: gen.tiktok,    label: '🎵 TikTok',    cls: 'tiktok'    });

    var container = el.querySelector('#bs-social-links');
    if (container && links.length) {
      setHTML(container, links.map(function(l) {
        return '<a href="' + l.href + '" target="_blank" rel="noopener" class="bs-social-link">' + l.label + '</a>';
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

  // ── Modal Privasi ─────────────────────────────────────────
  function initPrivacyModal() {
    var overlay = $('#bs-privacy-modal');
    var openBtn = $('#bs-privacy-link');
    var closeBtn = $('#bs-privacy-close');

    function openModal() {
      if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
      }
    }
    function closeModal() {
      if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
      }
    }

    if (openBtn)  openBtn.addEventListener('click', function(e) { e.preventDefault(); openModal(); });
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay)  overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
  }

  // ── Binding CTA event tracking ────────────────────────────
  function bindCtaTracking() {
    var reviewBtn = $('#bs-btn-review');
    var reviewLink = $('#bs-review-link');
    var mobReview = $('.bs-mob-review');
    [reviewBtn, reviewLink, mobReview].forEach(function(btn) {
      if (btn) {
        btn.addEventListener('click', function() {
          if (window.BSTracker) BSTracker.track('google_review_click', {});
        });
      }
    });

    var waBtn  = $('#bs-btn-wa');
    var waBtn2 = $('#bs-wa-link');
    var mobWa  = $('.bs-mob-wa');
    [waBtn, waBtn2, mobWa].forEach(function(btn) {
      if (btn) {
        btn.addEventListener('click', function() {
          if (window.BSTracker) BSTracker.track('whatsapp_click', {});
        });
      }
    });
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
        renderAll();
        // Sembunyikan loading screen
        var loading = $('#bs-loading');
        var main    = $('#bs-main');
        if (loading) loading.classList.add('bs-hidden');
        if (main)    main.classList.remove('bs-hidden');
      }, function(err) {
        console.warn('[BSApp] Config load error:', err);
        renderAll();
        var loading = $('#bs-loading');
        var main    = $('#bs-main');
        if (loading) loading.classList.add('bs-hidden');
        if (main)    main.classList.remove('bs-hidden');
      });
    } else {
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
