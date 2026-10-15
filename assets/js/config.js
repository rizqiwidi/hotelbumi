/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.3
 * config.js — Konstanta dasar, fallback defaults & skema penuh Guest CMS (FR-CMS-01 s/d FR-CMS-07)
 * Hanya berisi nilai publik yang aman; TIDAK ada token/rahasia.
 */

(function(window) {
  'use strict';

  /** URL backend Google Apps Script produksi v6.3 */
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbwrx5XUk37A3uhIpqNjKR9u87Z5hfg6LcBBVkUKFfgKi16YZPrde37ks7r4IsHu__cL/exec';

  /** Key localStorage untuk override URL backend (opsional) */
  var GAS_URL_KEY = 'bs_gas_url';

  /** Cache konfigurasi di sessionStorage */
  var CONFIG_CACHE_KEY   = 'bs_remote_config';
  var CONFIG_VERSION_KEY = 'bs_config_version';
  var SOURCE_CACHE_KEY   = 'bs_sources_cache';

  /** Nama key sessionStorage untuk sumber atribusi */
  var SESSION_SOURCE_KEY = 'bs_session_source';

  /** Nama key localStorage untuk perangkat persisten */
  var DEVICE_ID_KEY      = 'bs_device_id';

  /** Nama key localStorage untuk retry queue */
  var RETRY_QUEUE_KEY    = 'bs_retry_queue';

  /** Default konfigurasi hotel (dipakai saat backend belum terhubung) */
  var DEFAULTS = {
    general: {
      hotel_name:        'Bumi Surabaya City Resort',
      description:       'Welcome to Bumi Surabaya City Resort — a five-star city resort in the heart of Surabaya with lush tropical gardens and legendary culinary destinations.',
      address:           'Jl. Jenderal Basuki Rachmat No.106-128, Surabaya 60271, East Java, Indonesia',
      phone:             '+62313545888',
      whatsapp:          '628113388523',
      google_review_url: 'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      instagram:         'https://www.instagram.com/bumisurabaya/',
      facebook:          'https://www.facebook.com/bumisurabaya/',
      tiktok:            '',
      youtube:           '',
      website:           '',
      logo_url:          'assets/images/logo-hotel.png'
    },
    appearance: {
      accent_color:        '#c9a96e',
      hero_text:           'Bumi Surabaya City Resort',
      hero_subtitle:       'Five-Star City Resort in the Heart of Surabaya',
      hero_bg_url:         '',
      welcome_msg_general: 'We are delighted to welcome you to Bumi Surabaya City Resort.',
      welcome_msg_staff:   'Hello! You are currently being served wholeheartedly by {staff_name} ({role}) from {outlet}.',
      welcome_msg_sales:   'Hello! You are currently being assisted by {staff_name} ({role}) from {outlet}.',
      welcome_msg_outlet:  'Enjoy an exclusive culinary experience at {outlet_name}.',
      welcome_msg_nfc:     'Welcome to {outlet_name}! Enjoy an unforgettable experience with us.'
    },
    guest_sections: {
      show_review:          true,
      show_direct_feedback: true,
      show_wa:              true,
      show_promotions:      true,
      show_outlets:         true,
      show_social:          true,
      show_final_cta:       true,
      show_mobile_bar:      true
    },
    review_settings: {
      review_url:    'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      button_text:   'Share Your Experience',
      review_prompt: 'Had a memorable moment with us? Your review helps other guests discover the Bumi Surabaya experience.'
    },
    whatsapp_settings: {
      number:           '628113388523',
      template_staff:   'Halo, saya tamu Bumi Surabaya. Saya baru saja dilayani oleh {staff_name} dan ingin melakukan reservasi.',
      template_general: 'Halo Bumi Surabaya, saya ingin informasi mengenai reservasi dan layanan hotel.'
    },
    /**
     * Skema CMS penuh untuk mengelola 100% isi tampilan halaman tamu (FR-CMS-01 s/d FR-CMS-07)
     * Tanpa mengubah tone warna ataupun layout guest.css
     */
    guest_content: {
      // Zona 1 & 2: Loading Screen & Hero
      loading_title:            'Bumi Surabaya City Resort',
      loading_subtitle:         'Preparing your experience…',
      hero_review_btn_label:    'Share Your Experience',
      hero_wa_btn_label:        'Chat with Us',
      hero_scroll_hint:         'Scroll to explore',
      staff_badge_prefix:       'Served by ',

      // Zona 3: Seksi Google Review & Direct Feedback
      review_section_title:     "We'd Love to Hear From You",
      review_section_subtitle:  'Your feedback helps our team keep improving every day.',
      review_card_title:        'Share Your Experience',
      review_card_prompt:       'Had a memorable moment with us? Your review helps other guests discover the Bumi Surabaya experience.',
      review_card_btn_label:    'Review Us on Google',
      feedback_toggle_label:    'Direct Feedback',
      feedback_rating_label:    'How would you rate your experience?',
      feedback_msg_placeholder: 'Tell us about your experience...',
      feedback_name_placeholder:'Your name (optional)',
      feedback_wa_placeholder:  'WhatsApp number (optional)',
      feedback_submit_label:    'Send Feedback',
      feedback_thanks_text:     'Thank you! Your feedback means a lot to us.',

      // Zona 4: Seksi Gerai F&B (Outlets) & Promosi
      outlets_section_title:    'Discover Dining',
      outlets_section_subtitle: 'Explore our iconic F&B outlets, each with its own culinary story.',
      outlets_card_cta_label:   'Explore & Reserve →',
      outlets_wa_template:      'Hello Bumi Surabaya, I would like the menu and table reservation info at {outlet_name}.',
      promos_section_title:     'Exclusive Offers',
      promos_section_subtitle:  'Handpicked culinary experiences and special moments, just for you.',
      promos_card_cta_label:    'Discover More →',
      promos_wa_template:       'Hello Bumi Surabaya, I am interested in the promotion: {promo_name} at {outlet_name}. Please share reservation details.',

      // Zona 5: Seksi WhatsApp Concierge & Modal WA Sales Picker
      wa_status_pill:           'Concierge Online',
      wa_section_title:         'Reservations & Inquiries',
      wa_section_subtitle:      'Our team is one message away — table reservations, private events, and special requests.',
      wa_btn_label:             'Chat on WhatsApp',
      wa_picker_badge:          'CHAT WITH US',
      wa_picker_title:          'Choose who to chat with',
      wa_picker_subtitle:       'Our sales team is ready to help you on WhatsApp. Pick a contact below:',
      wa_picker_row_cta:        'Chat',
      wa_picker_empty_text:     'Our sales team contacts are being updated. Meanwhile, you can reach our main reservation line below:',
      wa_picker_fallback_btn:   'Chat Reservation',

      // Zona 6: Media Sosial, Final CTA, Floating Mobile Bar & Footer
      social_section_title:     'Stay Connected',
      social_section_subtitle:  'Follow us for the latest stories and exclusive offers.',
      social_label_instagram:   '📸 Instagram',
      social_label_facebook:    '👍 Facebook',
      social_label_tiktok:      '🎵 TikTok',
      social_label_youtube:     '▶️ YouTube',
      social_label_website:     '🌐 Official Website',
      final_cta_title:          'We Look Forward to Welcoming You Again',
      final_cta_subtitle:       'Until your next memorable experience at Hotel Bumi Surabaya.',
      final_review_btn_label:   'Share Your Experience',
      final_wa_btn_label:       'Contact Us',
      mobile_bar_review_label:  'Review',
      mobile_bar_wa_label:      'WhatsApp',
      footer_privacy_label:     'Privacy & Data Use Policy',
      footer_admin_label:       'Management Portal',
      footer_show_admin_link:   true,
      footer_copyright:         '© 2026 Bumi Surabaya City Resort. All rights reserved.',
      footer_version_tag:       'Digital Guest Experience v6.3',

      // Zona 7: Modal Kebijakan Privasi (#bs-privacy-modal)
      privacy_badge:            'WORLD-CLASS RESORT PRIVACY STANDARD',
      privacy_title:            'Guest Privacy & Data Use Policy',
      privacy_lead_bold:        'Bumi Surabaya City Resort is committed to transparent, secure, and ethical privacy.',
      privacy_lead_sub:         'Your comfort and peace of mind are our absolute priority. We are fully transparent about the data processed when you use this digital service portal.',
      privacy_block1_title:     'Personal data we NEVER collect:',
      privacy_block1_items: [
        'Guest full name or ID/passport identity',
        'Guest personal phone number (unless you voluntarily contact our concierge via WhatsApp)',
        'Personal email address',
        'Credit card numbers, PINs, or banking details'
      ],
      privacy_block2_title:     'Pseudonymous & technical data we process:',
      privacy_block2_items: [
        'Pseudonymous identifiers: random per-session identifiers (session_id) and device identifiers (device_id) stored locally in your browser (localStorage/sessionStorage) for interaction integrity and anti-fraud protection.',
        'Browser information: browser type (User-Agent), screen resolution, and server access time.',
        'Interaction metrics: active page dwell time, scroll depth, and chosen action buttons (Google reviews, WhatsApp, outlet/promo cards).',
        'Service access point: table, F&B outlet, room, or staff service point codes for attribution and internal evaluation.'
      ],
      privacy_block3_title:     'Purpose & data retention:',
      privacy_block3_items: [
        'Purpose: evaluating staff and outlet service quality, preventing metric manipulation (anti-fraud), and improving guest comfort.',
        'Retention: raw server event logs are kept for a maximum of 12 months for quality audits. Monthly performance summaries are kept for up to 24 months.',
        'Confidentiality: evaluation data is never sold or shared with third parties for advertising.'
      ],
      privacy_subtext:          'By using this service, you help us build a finer, more transparent, and more trusted five-star hospitality standard together.',
      privacy_btn_label:        'I Understand'
    },
    promotions: [
      {
        id: 'promo-pasar-malam',
        name: 'Pasar Malam Dinner Buffet',
        outlet: 'Arumanis Restaurant',
        description: 'Nikmati makan malam prasmanan dengan lebih dari 80 pilihan menu Nusantara dan internasional autentik setiap hari.',
        price: 'Rp 385.000 nett/pax',
        period: 'Setiap hari, pukul 18.00 – 22.00 WIB',
        emoji: '🌙',
        image_url: 'assets/images/outlets/arumanis.jpg',
        active: true
      },
      {
        id: 'promo-omakase',
        name: 'Omakase & Teppanyaki Experience',
        outlet: 'Kizahashi',
        description: 'Perjalanan kuliner Jepang otentik dipandu Chef di sushi bar atau ruang Tatami eksklusif.',
        price: 'Rp 650.000 nett/pax',
        period: 'Selasa – Minggu, pukul 12.00 – 14.30 & 18.30 – 21.30 WIB',
        emoji: '🍣',
        image_url: 'assets/images/outlets/kizahashi.svg',
        active: true
      },
      {
        id: 'promo-high-tea',
        name: 'Royal Heritage Afternoon High Tea',
        outlet: 'Lobby Lounge',
        description: 'Koleksi teh dunia dan artisan coffee dipadu kue tradisional Nusantara dan French patisserie di suasana lounge megah.',
        price: 'Rp 195.000 nett/set',
        period: 'Setiap hari, pukul 14.00 – 18.00 WIB',
        emoji: '🍸',
        image_url: 'assets/images/outlets/lobby-lounge.jpg',
        active: true
      },
      {
        id: 'promo-delikopi',
        name: 'Artisan Morning Brew & Viennoiserie',
        outlet: 'DeliKopi',
        description: 'Pilihan single-origin manual brew atau latte hangat dengan butter croissant segar yang dipanggang setiap pagi.',
        price: 'Rp 65.000 nett/combo',
        period: 'Pagi hari, pukul 07.00 – 11.00 WIB',
        emoji: '☕',
        image_url: 'assets/images/outlets/delikopi.svg',
        active: true
      }
    ],
    outlets: [
      {
        id: 'arumanis',
        name: 'Arumanis Restaurant',
        type: 'Authentic Indonesian & International Buffet',
        description: 'Nuansa Jawa yang anggun menghadirkan cita rasa Indonesia autentik berpadu buffet Western & Oriental, serta private room berkapasitas 30 orang.',
        emoji: '🍽️',
        image_url: 'assets/images/outlets/arumanis.jpg',
        hours: '06.00 – 22.00 WIB',
        highlight: 'Private Room 30 Pax',
        active: true
      },
      {
        id: 'kizahashi',
        name: 'Kizahashi',
        type: 'Authentic Japanese Restaurant',
        description: 'Restoran Jepang autentik dengan sushi, sashimi segar, teppanyaki live cooking, ramen, udon, dan tempura, dilengkapi 2 ruang Tatami @10 orang.',
        emoji: '🍣',
        image_url: 'assets/images/outlets/kizahashi.svg',
        hours: '11.30 – 14.30 & 18.00 – 22.00 WIB',
        highlight: '2 Ruang Tatami @10 Pax',
        active: true
      },
      {
        id: 'lobby-lounge',
        name: 'Lobby Lounge',
        type: 'All-Day Lounge & Refreshments',
        description: 'Suasana santai dan megah untuk all-day refreshments, kopi istimewa, dan aneka kue lokal — tempat sempurna untuk bertemu kolega dan teman.',
        emoji: '🍸',
        image_url: 'assets/images/outlets/lobby-lounge.jpg',
        hours: '08.00 – 23.00 WIB',
        highlight: 'Live Music & High Tea',
        active: true
      },
      {
        id: 'delikopi',
        name: 'DeliKopi',
        type: 'Specialty Coffee & Gourmet Pastry',
        description: 'Kopi istimewa serta ragam roti dan pastry segar setiap hari, menghidupkan kembali konsep Delicatessen hotel legendaris.',
        emoji: '☕',
        image_url: 'assets/images/outlets/delikopi.svg',
        hours: '07.00 – 21.00 WIB',
        highlight: 'Fresh Bakery Daily',
        active: true
      }
    ],
    fraud_thresholds: {
      velocity_limit:    3,    // max kunjungan per perangkat ke 1 sumber / 24 jam
      velocity_window_h: 24,
      burst_count:       5,    // kunjungan per sumber dalam jendela burst 10 menit
      burst_window_min:  10,
      low_dwell_ms:      5000, // < 5 detik tanpa interaksi = low quality
      hopping_sources:   4,    // 4+ sumber berbeda = hopping
      hopping_window_h:  1,
      shared_ip_devices: 5,    // 5+ device dari 1 IP ke 1 sumber / 10 mnt
      shared_ip_min:     10,
      odd_hour_start:    6,    // Jam operasional mulai WIB (06:00) (FR-P0-06)
      odd_hour_end:      23    // Jam operasional selesai WIB (23:00) (FR-P0-06)
    }
  };

  /** Versi singleton konfigurasi yang berlaku */
  var _activeConfig = null;
  var _activeSources = [];

  /**
   * Muat konfigurasi: coba dari cache sessionStorage dulu,
   * jika tidak ada panggil backend.
   */
  function loadConfig(gasUrl, onSuccess, onError) {
    var cached = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        _activeConfig  = parsed.config  || {};
        _activeSources = parsed.sources || [];
        if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
        return;
      } catch(e) { /* invalid cache, refetch */ }
    }

    if (!gasUrl) {
      // Tidak ada backend — gunakan defaults
      _activeConfig  = DEFAULTS;
      _activeSources = [];
      if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
      return;
    }

    var url = gasUrl + '?action=get_config&_=' + Date.now();
    fetch(url)
      .then(function(r) { return r.json(); })
      .then(function(resp) {
        if (resp.ok) {
          _activeConfig  = resp.config  || {};
          _activeSources = resp.sources || [];
          sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ config: _activeConfig, sources: _activeSources }));
          sessionStorage.setItem(CONFIG_VERSION_KEY, String(resp.version || Date.now()));
          if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
        } else {
          throw new Error(resp.error || 'get_config failed');
        }
      })
      .catch(function(err) {
        // Fallback ke defaults
        _activeConfig  = DEFAULTS;
        _activeSources = [];
        if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
        if (typeof onError === 'function') onError(err);
      });
  }

  /** Ambil nilai konfigurasi yang aktif (merging dengan defaults) */
  function get(section) {
    if (!_activeConfig) return DEFAULTS[section];
    var def = DEFAULTS[section];
    var act = _activeConfig[section];
    if (!act) return def;
    if (Array.isArray(def) || Array.isArray(act)) return act;
    if (typeof def === 'object' && def !== null && typeof act === 'object' && act !== null) {
      return Object.assign({}, def, act);
    }
    return act;
  }

  /** Hapus cache config (dipanggil setelah admin simpan data) */
  function clearCache() {
    sessionStorage.removeItem(CONFIG_CACHE_KEY);
    sessionStorage.removeItem(CONFIG_VERSION_KEY);
  }

  /** Ambil GAS URL (prioritas: override di localStorage -> konstanta default) */
  function getGasUrl() {
    return localStorage.getItem(GAS_URL_KEY) || GAS_URL;
  }

  /** Simpan GAS URL ke localStorage */
  function setGasUrl(url) {
    localStorage.setItem(GAS_URL_KEY, url);
  }

  /**
   * Root path aplikasi, mis. "/" atau "/hotelbumi/".
   * Menangani deploy di domain-root maupun subpath (GitHub Pages).
   */
  function appRoot() {
    var p = window.location.pathname || '/';
    var dir = p.charAt(p.length - 1) === '/' ? p : p.substring(0, p.lastIndexOf('/') + 1);
    if (/\/admin\/$/.test(dir)) dir = dir.replace(/admin\/$/, '');
    return dir;
  }

  /**
   * Resolve path aset relatif terhadap app root.
   * "assets/x.jpg" atau "/assets/x.jpg" -> "/hotelbumi/assets/x.jpg" (atau "/assets/x.jpg" di root).
   * URL absolut (http/data:) dikembalikan apa adanya.
   */
  function resolveAsset(p) {
    if (!p || /^(https?:|data:|\/\/)/i.test(p)) return p;
    return appRoot() + String(p).replace(/^\/+/, '');
  }

  // Ekspos ke global
  window.BSConfig = {
    GAS_URL:             GAS_URL,
    DEFAULTS:            DEFAULTS,
    appRoot:             appRoot,
    resolveAsset:        resolveAsset,
    GAS_URL_KEY:         GAS_URL_KEY,
    SESSION_SOURCE_KEY:  SESSION_SOURCE_KEY,
    DEVICE_ID_KEY:       DEVICE_ID_KEY,
    RETRY_QUEUE_KEY:     RETRY_QUEUE_KEY,
    SOURCE_CACHE_KEY:    SOURCE_CACHE_KEY,
    loadConfig:          loadConfig,
    get:                 get,
    clearCache:          clearCache,
    getGasUrl:           getGasUrl,
    setGasUrl:           setGasUrl,
    getSources:          function() { return _activeSources; }
  };

})(window);
