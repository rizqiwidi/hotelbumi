/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.7
 * admin-appearance.js — Full Guest Page CMS Workspace & Bilingual ID/EN Presets (FR-CMS-01 s/d FR-CMS-08, FR-V64-06, FR-CRUD-AUTO)
 *
 * Setiap tombol Simpan Zona, Preset Bahasa (ID/EN), Mode Bahasa, dan Reset Standar OTOMATIS tersimpan ke Google Sheets!
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var icon = BSAdmin.icon || function () { return ''; };

  function getVal(id, fallback) {
    var el = $id(id);
    if (!el) return fallback !== undefined ? fallback : '';
    return (el.value || '').trim();
  }

  function setVal(id, val) {
    var el = $id(id);
    if (el && val !== undefined && val !== null) {
      el.value = val;
    }
  }

  function linesToArray(text, fallbackArr) {
    var raw = String(text || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
    return raw.length > 0 ? raw : (fallbackArr || []);
  }

  function arrayToLines(arr) {
    return Array.isArray(arr) ? arr.join('\n') : '';
  }

  /* ─────────────────────────────────────────────────────────────
   * 1. Populasi Seluruh Form CMS dari State / Defaults
   * ───────────────────────────────────────────────────────────── */
  function populateAppearance() {
    var cfg = BSAdmin.state.configData || {};
    var def = (window.BSConfig && BSConfig.DEFAULTS) || {};

    var gen = Object.assign({}, def.general || {}, cfg.general || {});
    var app = Object.assign({}, def.appearance || {}, cfg.appearance || {});
    var rev = Object.assign({}, def.review_settings || {}, cfg.review_settings || {});
    var gc  = Object.assign({}, def.guest_content || {}, cfg.guest_content || {});

    setVal('adm-cms-lang-mode',        gen.language_mode || 'en');
    setVal('adm-cms-hotel-name',       gen.hotel_name || 'Bumi Surabaya City Resort');
    setVal('adm-cms-hotel-desc',       gen.description || '');
    setVal('adm-cms-hotel-address',    gen.address || '');
    setVal('adm-cms-hotel-phone',      gen.phone || '');
    setVal('adm-cms-logo-url',         gen.logo_url || 'assets/images/logo-hotel.png');
    setVal('adm-cms-loading-title',    gc.loading_title || gen.hotel_name || 'Bumi Surabaya City Resort');
    setVal('adm-cms-loading-sub',      gc.loading_subtitle || 'Preparing your experience…');

    setVal('adm-app-hero-title',       app.hero_text || 'Bumi Surabaya City Resort');
    setVal('adm-app-hero-sub',         app.hero_subtitle || 'Five-Star City Resort in the Heart of Surabaya');
    setVal('adm-cms-hero-bg-url',      app.hero_bg_url || '');
    setVal('adm-app-welcome-gen',      app.welcome_msg_general || '');
    setVal('adm-app-welcome-staff',    app.welcome_msg_staff || '');
    setVal('adm-cms-welcome-sales',    app.welcome_msg_sales || '');
    setVal('adm-cms-welcome-outlet',   app.welcome_msg_outlet || '');
    setVal('adm-cms-welcome-nfc',      app.welcome_msg_nfc || '');
    setVal('adm-cms-hero-rev-btn',     gc.hero_review_btn_label || rev.button_text || 'Share Your Experience');
    setVal('adm-cms-hero-wa-btn',      gc.hero_wa_btn_label || 'Chat with Us');
    setVal('adm-cms-hero-scroll-hint', gc.hero_scroll_hint || 'Scroll to explore');

    setVal('adm-cms-review-url',       rev.review_url || gen.google_review_url || '');
    setVal('adm-cms-rev-sec-title',    gc.review_section_title || "We'd Love to Hear From You");
    setVal('adm-cms-rev-sec-sub',      gc.review_section_subtitle || 'Your feedback helps our team keep improving every day.');
    setVal('adm-cms-rev-card-title',   gc.review_card_title || 'Share Your Experience');
    setVal('adm-cms-rev-card-prompt',  rev.review_prompt || gc.review_card_prompt || '');
    setVal('adm-cms-rev-card-btn',     gc.review_card_btn_label || 'Review Us on Google');
    setVal('adm-cms-fb-toggle-btn',    gc.feedback_toggle_label || 'Direct Feedback');
    setVal('adm-cms-fb-rating-lbl',    gc.feedback_rating_label || 'How would you rate your experience?');
    setVal('adm-cms-fb-msg-ph',        gc.feedback_msg_placeholder || 'Tell us about your experience...');
    setVal('adm-cms-fb-name-ph',       gc.feedback_name_placeholder || 'Your name (optional)');
    setVal('adm-cms-fb-wa-ph',         gc.feedback_wa_placeholder || 'WhatsApp number (optional)');
    setVal('adm-cms-fb-submit-lbl',    gc.feedback_submit_label || 'Send Feedback');
    setVal('adm-cms-fb-thanks-txt',    gc.feedback_thanks_text || 'Thank you! Your feedback means a lot to us.');

    setVal('adm-cms-outlets-title',    gc.outlets_section_title || 'Discover Dining');
    setVal('adm-cms-outlets-sub',      gc.outlets_section_subtitle || 'Explore our iconic F&B outlets, each with its own culinary story.');
    setVal('adm-cms-outlets-cta',      gc.outlets_card_cta_label || 'Explore & Reserve →');
    setVal('adm-cms-outlets-wa-tpl',   gc.outlets_wa_template || 'Hello Bumi Surabaya, I would like the menu and table reservation info at {outlet_name}.');
    setVal('adm-cms-promos-title',     gc.promos_section_title || 'Exclusive Offers');
    setVal('adm-cms-promos-sub',       gc.promos_section_subtitle || 'Handpicked culinary experiences and special moments, just for you.');
    setVal('adm-cms-promos-cta',       gc.promos_card_cta_label || 'Discover More →');
    setVal('adm-cms-promos-wa-tpl',    gc.promos_wa_template || 'Hello Bumi Surabaya, I am interested in the promotion: {promo_name} at {outlet_name}. Please share reservation details.');

    setVal('adm-cms-wa-pill',          gc.wa_status_pill || 'Concierge Online');
    setVal('adm-cms-wa-title',         gc.wa_section_title || 'Reservations & Inquiries');
    setVal('adm-cms-wa-sub',           gc.wa_section_subtitle || 'Our team is one message away — table reservations, private events, and special requests.');
    setVal('adm-cms-wa-btn',           gc.wa_btn_label || 'Chat on WhatsApp');
    setVal('adm-cms-wap-badge',        gc.wa_picker_badge || 'CHAT WITH US');
    setVal('adm-cms-wap-title',        gc.wa_picker_title || 'Choose who to chat with');
    setVal('adm-cms-wap-sub',          gc.wa_picker_subtitle || 'Our sales team is ready to help you on WhatsApp. Pick a contact below:');
    setVal('adm-cms-wap-row-cta',      gc.wa_picker_row_cta || 'Chat');
    setVal('adm-cms-wap-empty',        gc.wa_picker_empty_text || 'Our sales team contacts are being updated. Meanwhile, you can reach our main reservation line below:');
    setVal('adm-cms-wap-fb-btn',       gc.wa_picker_fallback_btn || 'Chat Reservation');

    setVal('adm-cms-soc-title',        gc.social_section_title || 'Stay Connected');
    setVal('adm-cms-soc-sub',          gc.social_section_subtitle || 'Follow us for the latest stories and exclusive offers.');
    setVal('adm-cms-soc-ig-url',       gen.instagram || '');
    setVal('adm-cms-soc-ig-lbl',       gc.social_label_instagram || '📸 Instagram');
    setVal('adm-cms-soc-fb-url',       gen.facebook || '');
    setVal('adm-cms-soc-fb-lbl',       gc.social_label_facebook || '👍 Facebook');
    setVal('adm-cms-soc-tt-url',       gen.tiktok || '');
    setVal('adm-cms-soc-tt-lbl',       gc.social_label_tiktok || '🎵 TikTok');
    setVal('adm-cms-soc-yt-url',       gen.youtube || '');
    setVal('adm-cms-soc-yt-lbl',       gc.social_label_youtube || '▶️ YouTube');
    setVal('adm-cms-soc-web-url',      gen.website || '');
    setVal('adm-cms-soc-web-lbl',      gc.social_label_website || '🌐 Official Website');

    setVal('adm-cms-final-title',      gc.final_cta_title || 'We Look Forward to Welcoming You Again');
    setVal('adm-cms-final-sub',        gc.final_cta_subtitle || 'Until your next memorable experience at Hotel Bumi Surabaya.');
    setVal('adm-cms-final-rev-btn',    gc.final_review_btn_label || 'Share Your Experience');
    setVal('adm-cms-final-wa-btn',     gc.final_wa_btn_label || 'Contact Us');
    setVal('adm-cms-mob-rev-lbl',      gc.mobile_bar_review_label || 'Review');
    setVal('adm-cms-mob-wa-lbl',       gc.mobile_bar_wa_label || 'WhatsApp');
    setVal('adm-cms-ftr-privacy-lbl',  gc.footer_privacy_label || 'Privacy & Data Use Policy');
    setVal('adm-cms-ftr-admin-lbl',    gc.footer_admin_label || 'Management Portal');
    setVal('adm-cms-ftr-copyright',    gc.footer_copyright || '© 2026 Bumi Surabaya City Resort. All rights reserved.');
    setVal('adm-cms-ftr-version',      gc.footer_version_tag || 'Digital Guest Experience v6.7');
    if ($id('adm-cms-ftr-show-admin')) {
      $id('adm-cms-ftr-show-admin').checked = gc.footer_show_admin_link !== false;
    }

    setVal('adm-cms-prv-badge',        gc.privacy_badge || 'WORLD-CLASS RESORT PRIVACY STANDARD');
    setVal('adm-cms-prv-title',        gc.privacy_title || 'Guest Privacy & Data Use Policy');
    setVal('adm-cms-prv-lead-bold',    gc.privacy_lead_bold || '');
    setVal('adm-cms-prv-lead-sub',     gc.privacy_lead_sub || '');
    setVal('adm-cms-prv-b1-title',     gc.privacy_block1_title || 'Personal data we NEVER collect:');
    setVal('adm-cms-prv-b1-items',     arrayToLines(gc.privacy_block1_items));
    setVal('adm-cms-prv-b2-title',     gc.privacy_block2_title || 'Pseudonymous & technical data we process:');
    setVal('adm-cms-prv-b2-items',     arrayToLines(gc.privacy_block2_items));
    setVal('adm-cms-prv-b3-title',     gc.privacy_block3_title || 'Purpose & data retention:');
    setVal('adm-cms-prv-b3-items',     arrayToLines(gc.privacy_block3_items));
    setVal('adm-cms-prv-subtext',      gc.privacy_subtext || '');
    setVal('adm-cms-prv-btn',          gc.privacy_btn_label || 'I Understand');

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Kumpulkan Nilai Form CMS ke State
   * ───────────────────────────────────────────────────────────── */
  function collectDraftToState() {
    var cfg = BSAdmin.state.configData || {};
    var def = (window.BSConfig && BSConfig.DEFAULTS) || {};

    var revUrl = getVal('adm-cms-review-url', (def.review_settings && def.review_settings.review_url) || '');

    var genData = Object.assign({}, def.general || {}, cfg.general || {}, {
      hotel_name:        getVal('adm-cms-hotel-name', 'Bumi Surabaya City Resort'),
      description:       getVal('adm-cms-hotel-desc', ''),
      address:           getVal('adm-cms-hotel-address', ''),
      phone:             getVal('adm-cms-hotel-phone', ''),
      logo_url:          getVal('adm-cms-logo-url', 'assets/images/logo-hotel.png'),
      language_mode:     getVal('adm-cms-lang-mode', 'en'),
      google_review_url: revUrl,
      instagram:         getVal('adm-cms-soc-ig-url', ''),
      facebook:          getVal('adm-cms-soc-fb-url', ''),
      tiktok:            getVal('adm-cms-soc-tt-url', ''),
      youtube:           getVal('adm-cms-soc-yt-url', ''),
      website:           getVal('adm-cms-soc-web-url', '')
    });

    var appData = Object.assign({}, def.appearance || {}, cfg.appearance || {}, {
      accent_color:        '#c9a96e',
      hero_text:           getVal('adm-app-hero-title', 'Bumi Surabaya City Resort'),
      hero_subtitle:       getVal('adm-app-hero-sub', 'Five-Star City Resort in the Heart of Surabaya'),
      hero_bg_url:         getVal('adm-cms-hero-bg-url', ''),
      welcome_msg_general: getVal('adm-app-welcome-gen', ''),
      welcome_msg_staff:   getVal('adm-app-welcome-staff', ''),
      welcome_msg_sales:   getVal('adm-cms-welcome-sales', ''),
      welcome_msg_outlet:  getVal('adm-cms-welcome-outlet', ''),
      welcome_msg_nfc:     getVal('adm-cms-welcome-nfc', '')
    });

    var revData = Object.assign({}, def.review_settings || {}, cfg.review_settings || {}, {
      review_url:    revUrl,
      button_text:   getVal('adm-cms-hero-rev-btn', 'Share Your Experience'),
      review_prompt: getVal('adm-cms-rev-card-prompt', '')
    });

    var defGc = def.guest_content || {};
    var gcData = Object.assign({}, defGc, cfg.guest_content || {}, {
      loading_title:            getVal('adm-cms-loading-title', genData.hotel_name),
      loading_subtitle:         getVal('adm-cms-loading-sub', defGc.loading_subtitle),
      hero_review_btn_label:    getVal('adm-cms-hero-rev-btn', defGc.hero_review_btn_label),
      hero_wa_btn_label:        getVal('adm-cms-hero-wa-btn', defGc.hero_wa_btn_label),
      hero_scroll_hint:         getVal('adm-cms-hero-scroll-hint', defGc.hero_scroll_hint),

      review_section_title:     getVal('adm-cms-rev-sec-title', defGc.review_section_title),
      review_section_subtitle:  getVal('adm-cms-rev-sec-sub', defGc.review_section_subtitle),
      review_card_title:        getVal('adm-cms-rev-card-title', defGc.review_card_title),
      review_card_prompt:       getVal('adm-cms-rev-card-prompt', defGc.review_card_prompt),
      review_card_btn_label:    getVal('adm-cms-rev-card-btn', defGc.review_card_btn_label),
      feedback_toggle_label:    getVal('adm-cms-fb-toggle-btn', defGc.feedback_toggle_label),
      feedback_rating_label:    getVal('adm-cms-fb-rating-lbl', defGc.feedback_rating_label),
      feedback_msg_placeholder: getVal('adm-cms-fb-msg-ph', defGc.feedback_msg_placeholder),
      feedback_name_placeholder:getVal('adm-cms-fb-name-ph', defGc.feedback_name_placeholder),
      feedback_wa_placeholder:  getVal('adm-cms-fb-wa-ph', defGc.feedback_wa_placeholder),
      feedback_submit_label:    getVal('adm-cms-fb-submit-lbl', defGc.feedback_submit_label),
      feedback_thanks_text:     getVal('adm-cms-fb-thanks-txt', defGc.feedback_thanks_text),

      outlets_section_title:    getVal('adm-cms-outlets-title', defGc.outlets_section_title),
      outlets_section_subtitle: getVal('adm-cms-outlets-sub', defGc.outlets_section_subtitle),
      outlets_card_cta_label:   getVal('adm-cms-outlets-cta', defGc.outlets_card_cta_label),
      outlets_wa_template:      getVal('adm-cms-outlets-wa-tpl', defGc.outlets_wa_template),
      promos_section_title:     getVal('adm-cms-promos-title', defGc.promos_section_title),
      promos_section_subtitle:  getVal('adm-cms-promos-sub', defGc.promos_section_subtitle),
      promos_card_cta_label:    getVal('adm-cms-promos-cta', defGc.promos_card_cta_label),
      promos_wa_template:       getVal('adm-cms-promos-wa-tpl', defGc.promos_wa_template),

      wa_status_pill:           getVal('adm-cms-wa-pill', defGc.wa_status_pill),
      wa_section_title:         getVal('adm-cms-wa-title', defGc.wa_section_title),
      wa_section_subtitle:      getVal('adm-cms-wa-sub', defGc.wa_section_subtitle),
      wa_btn_label:             getVal('adm-cms-wa-btn', defGc.wa_btn_label),
      wa_picker_badge:          getVal('adm-cms-wap-badge', defGc.wa_picker_badge),
      wa_picker_title:          getVal('adm-cms-wap-title', defGc.wa_picker_title),
      wa_picker_subtitle:       getVal('adm-cms-wap-sub', defGc.wa_picker_subtitle),
      wa_picker_row_cta:        getVal('adm-cms-wap-row-cta', defGc.wa_picker_row_cta),
      wa_picker_empty_text:     getVal('adm-cms-wap-empty', defGc.wa_picker_empty_text),
      wa_picker_fallback_btn:   getVal('adm-cms-wap-fb-btn', defGc.wa_picker_fallback_btn),

      social_section_title:     getVal('adm-cms-soc-title', defGc.social_section_title),
      social_section_subtitle:  getVal('adm-cms-soc-sub', defGc.social_section_subtitle),
      social_label_instagram:   getVal('adm-cms-soc-ig-lbl', defGc.social_label_instagram),
      social_label_facebook:    getVal('adm-cms-soc-fb-lbl', defGc.social_label_facebook),
      social_label_tiktok:      getVal('adm-cms-soc-tt-lbl', defGc.social_label_tiktok),
      social_label_youtube:     getVal('adm-cms-soc-yt-lbl', defGc.social_label_youtube),
      social_label_website:     getVal('adm-cms-soc-web-lbl', defGc.social_label_website),
      final_cta_title:          getVal('adm-cms-final-title', defGc.final_cta_title),
      final_cta_subtitle:       getVal('adm-cms-final-sub', defGc.final_cta_subtitle),
      final_review_btn_label:   getVal('adm-cms-final-rev-btn', defGc.final_review_btn_label),
      final_wa_btn_label:       getVal('adm-cms-final-wa-btn', defGc.final_wa_btn_label),
      mobile_bar_review_label:  getVal('adm-cms-mob-rev-lbl', defGc.mobile_bar_review_label),
      mobile_bar_wa_label:      getVal('adm-cms-mob-wa-lbl', defGc.mobile_bar_wa_label),
      footer_privacy_label:     getVal('adm-cms-ftr-privacy-lbl', defGc.footer_privacy_label),
      footer_admin_label:       getVal('adm-cms-ftr-admin-lbl', defGc.footer_admin_label),
      footer_show_admin_link:   $id('adm-cms-ftr-show-admin') ? $id('adm-cms-ftr-show-admin').checked : true,
      footer_copyright:         getVal('adm-cms-ftr-copyright', defGc.footer_copyright),
      footer_version_tag:       getVal('adm-cms-ftr-version', defGc.footer_version_tag),

      privacy_badge:            getVal('adm-cms-prv-badge', defGc.privacy_badge),
      privacy_title:            getVal('adm-cms-prv-title', defGc.privacy_title),
      privacy_lead_bold:        getVal('adm-cms-prv-lead-bold', defGc.privacy_lead_bold),
      privacy_lead_sub:         getVal('adm-cms-prv-lead-sub', defGc.privacy_lead_sub),
      privacy_block1_title:     getVal('adm-cms-prv-b1-title', defGc.privacy_block1_title),
      privacy_block1_items:     linesToArray(getVal('adm-cms-prv-b1-items'), defGc.privacy_block1_items),
      privacy_block2_title:     getVal('adm-cms-prv-b2-title', defGc.privacy_block2_title),
      privacy_block2_items:     linesToArray(getVal('adm-cms-prv-b2-items'), defGc.privacy_block2_items),
      privacy_block3_title:     getVal('adm-cms-prv-b3-title', defGc.privacy_block3_title),
      privacy_block3_items:     linesToArray(getVal('adm-cms-prv-b3-items'), defGc.privacy_block3_items),
      privacy_subtext:          getVal('adm-cms-prv-subtext', defGc.privacy_subtext),
      privacy_btn_label:        getVal('adm-cms-prv-btn', defGc.privacy_btn_label)
    });

    BSAdmin.state.configData.general         = genData;
    BSAdmin.state.configData.appearance      = appData;
    BSAdmin.state.configData.review_settings = revData;
    BSAdmin.state.configData.guest_content   = gcData;

    return {
      general:         genData,
      appearance:      appData,
      review_settings: revData,
      guest_content:   gcData
    };
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Simpan Seluruh Konten Halaman Tamu ke Cloud
   * ───────────────────────────────────────────────────────────── */
  function saveAppearance(customToastMsg) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah konten halaman tamu.', 'warning');
      return;
    }

    var payloadConfig = collectDraftToState();

    var btn = $id('adm-app-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Menyimpan…';
    }
    BSAdmin.updateSyncStatus('saving');

    function syncApp() {
      window.BSApi && BSApi.saveAllAdminData({ config: payloadConfig }).then(function () {
        if (window.BSConfig) BSConfig.clearCache();
        BSAdmin.updateSyncStatus('saved');
        BSAdmin.showToast(customToastMsg || 'Seluruh perubahan konten halaman tamu berhasil disimpan ke server.', 'success');
      }).catch(function (err) {
        BSAdmin.updateSyncStatus('failed', err.message, syncApp);
        BSAdmin.showToast('Gagal menyimpan konten: ' + err.message, 'error');
      }).finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = icon('save', 14) + ' <span>Simpan Seluruh Konten Halaman Tamu</span>';
        }
      });
    }
    syncApp();
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. Preset Bahasa (ID / EN) & Reset Standar — Otomatis Tersimpan (FR-V64-06, FR-CRUD-AUTO)
   * ───────────────────────────────────────────────────────────── */
  function applyLanguagePreset(lang) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah konten halaman tamu.', 'warning');
      return;
    }
    var def = (window.BSConfig && BSConfig.DEFAULTS) || {};
    var pid = (window.BSConfig && BSConfig.PRESET_ID) || {};

    if (lang === 'id') {
      BSAdmin.state.configData.general = Object.assign({}, BSAdmin.state.configData.general || {}, { language_mode: 'id' });
      BSAdmin.state.configData.appearance = Object.assign({}, def.appearance || {}, pid.appearance || {});
      BSAdmin.state.configData.guest_content = Object.assign({}, def.guest_content || {}, pid.guest_content || {});
      BSAdmin.state.configData.review_settings = Object.assign({}, BSAdmin.state.configData.review_settings || {}, {
        button_text:   (pid.guest_content && pid.guest_content.hero_review_btn_label) || 'Bagikan Pengalaman Anda',
        review_prompt: (pid.guest_content && pid.guest_content.review_card_prompt) || ''
      });
      populateAppearance();
      saveAppearance('Preset Bahasa Indonesia berhasil diterapkan dan disimpan otomatis ke server.');
    } else {
      BSAdmin.state.configData.general = Object.assign({}, BSAdmin.state.configData.general || {}, { language_mode: 'en' });
      BSAdmin.state.configData.appearance = JSON.parse(JSON.stringify(def.appearance || {}));
      BSAdmin.state.configData.guest_content = JSON.parse(JSON.stringify(def.guest_content || {}));
      BSAdmin.state.configData.review_settings = Object.assign({}, BSAdmin.state.configData.review_settings || {}, {
        button_text:   (def.review_settings && def.review_settings.button_text) || 'Share Your Experience',
        review_prompt: (def.review_settings && def.review_settings.review_prompt) || ''
      });
      populateAppearance();
      saveAppearance('Preset Bahasa Inggris (EN) berhasil diterapkan dan disimpan otomatis ke server.');
    }
  }

  function resetToDefaults() {
    if (!confirm('Kembalikan seluruh teks dan konten halaman tamu ke nilai standar bawaan dan simpan ke server?')) {
      return;
    }
    var def = (window.BSConfig && BSConfig.DEFAULTS) || {};
    BSAdmin.state.configData.general         = JSON.parse(JSON.stringify(def.general || {}));
    BSAdmin.state.configData.appearance      = JSON.parse(JSON.stringify(def.appearance || {}));
    BSAdmin.state.configData.review_settings = JSON.parse(JSON.stringify(def.review_settings || {}));
    BSAdmin.state.configData.guest_content   = JSON.parse(JSON.stringify(def.guest_content || {}));
    populateAppearance();
    saveAppearance('Teks standar berhasil dipulihkan dan disimpan otomatis ke server.');
  }

  function switchCmsZone(zoneId) {
    document.querySelectorAll('[data-cms-zone-btn]').forEach(function (btn) {
      var active = btn.getAttribute('data-cms-zone-btn') === zoneId;
      btn.className = active
        ? 'adm-btn adm-btn-xs adm-btn-primary'
        : 'adm-btn adm-btn-xs adm-btn-secondary';
    });
    document.querySelectorAll('.adm-cms-zone-pane').forEach(function (pane) {
      if (zoneId === 'all') {
        pane.style.display = '';
      } else {
        pane.style.display = (pane.id === 'cms-zone-' + zoneId) ? '' : 'none';
      }
    });
  }

  function init() {
    var saveBtn = $id('adm-app-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () { saveAppearance(); });
    }

    document.querySelectorAll('.adm-cms-save-zone-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        saveAppearance('Perubahan zona CMS berhasil disimpan ke server.');
      });
    });

    var resetBtn = $id('adm-cms-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', resetToDefaults);
    }

    var presetIdBtn = $id('adm-cms-preset-id-btn');
    if (presetIdBtn) {
      presetIdBtn.addEventListener('click', function () { applyLanguagePreset('id'); });
    }

    var presetEnBtn = $id('adm-cms-preset-en-btn');
    if (presetEnBtn) {
      presetEnBtn.addEventListener('click', function () { applyLanguagePreset('en'); });
    }

    var langModeSel = $id('adm-cms-lang-mode');
    if (langModeSel) {
      langModeSel.addEventListener('change', function () {
        saveAppearance('Mode bahasa halaman tamu (' + this.value.toUpperCase() + ') otomatis disimpan ke server.');
      });
    }

    var ftrShowAdmin = $id('adm-cms-ftr-show-admin');
    if (ftrShowAdmin) {
      ftrShowAdmin.addEventListener('change', function () {
        saveAppearance('Pengaturan tautan footer otomatis disimpan ke server.');
      });
    }

    document.querySelectorAll('[data-cms-zone-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchCmsZone(btn.getAttribute('data-cms-zone-btn'));
      });
    });

    var tabApp = $id('tab-appearance');
    if (tabApp) {
      tabApp.addEventListener('input', function () {
        BSAdmin.updateSyncStatus('unsaved');
      });
    }
  }

  BSAdmin.appearance = {
    populate:            populateAppearance,
    collectDraftToState: collectDraftToState,
    save:                saveAppearance,
    resetToDefaults:     resetToDefaults,
    applyLanguagePreset: applyLanguagePreset,
    switchCmsZone:       switchCmsZone,
    init:                init
  };

  window.BSAdmin = BSAdmin;

})(window);
