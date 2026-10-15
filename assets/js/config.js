/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.4
 * config.js — Konstanta dasar, fallback defaults, skema penuh Guest CMS & Kamus Dwibahasa ID/EN (FR-CMS-01 s/d FR-CMS-08, FR-V64-06)
 * Hanya berisi nilai publik yang aman; TIDAK ada token/rahasia.
 */

(function(window) {
  'use strict';

  /** URL backend Google Apps Script produksi v6.4 */
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbwrx5XUk37A3uhIpqNjKR9u87Z5hfg6LcBBVkUKFfgKi16YZPrde37ks7r4IsHu__cL/exec';

  var GAS_URL_KEY        = 'bs_gas_url';
  var CONFIG_CACHE_KEY   = 'bs_remote_config';
  var CONFIG_VERSION_KEY = 'bs_config_version';
  var SOURCE_CACHE_KEY   = 'bs_sources_cache';
  var SESSION_SOURCE_KEY = 'bs_session_source';
  var DEVICE_ID_KEY      = 'bs_device_id';
  var RETRY_QUEUE_KEY    = 'bs_retry_queue';

  /** Kamus Preset Bahasa Indonesia untuk Halaman Tamu (FR-V64-06) */
  var PRESET_ID = {
    appearance: {
      hero_text:           'Bumi Surabaya City Resort',
      hero_subtitle:       'Resor Kota Bintang Lima di Jantung Surabaya',
      welcome_msg_general: 'Kami dengan bangga menyambut kehadiran Anda di Bumi Surabaya City Resort.',
      welcome_msg_staff:   'Halo! Anda saat ini dilayani dengan sepenuh hati oleh {staff_name} ({role}) dari {outlet}.',
      welcome_msg_sales:   'Halo! Anda saat ini dibantu oleh {staff_name} ({role}) dari {outlet}.',
      welcome_msg_outlet:  'Nikmati pengalaman kuliner istimewa di {outlet_name}.',
      welcome_msg_nfc:     'Selamat datang di {outlet_name}! Nikmati pengalaman tak terlupakan bersama kami.'
    },
    guest_content: {
      loading_title:            'Bumi Surabaya City Resort',
      loading_subtitle:         'Menyiapkan pengalaman Anda…',
      hero_review_btn_label:    'Bagikan Pengalaman Anda',
      hero_wa_btn_label:        'Chat via WhatsApp',
      hero_scroll_hint:         'Gulir untuk menjelajahi',
      staff_badge_prefix:       'Dilayani oleh ',

      review_section_title:     'Kesan Anda Sangat Berarti Bagi Kami',
      review_section_subtitle:  'Masukan Anda membantu tim kami terus memberikan layanan terbaik setiap hari.',
      review_card_title:        'Bagikan Pengalaman Anda',
      review_card_prompt:       'Memiliki momen berkesan bersama kami? Ulasan Anda membantu tamu lain menemukan kehangatan Bumi Surabaya.',
      review_card_btn_label:    'Tulis Ulasan di Google',
      feedback_toggle_label:    'Masukan Langsung (Direct Feedback)',
      feedback_rating_label:    'Bagaimana penilaian Anda terhadap layanan kami?',
      feedback_msg_placeholder: 'Ceritakan pengalaman atau masukan Anda...',
      feedback_name_placeholder:'Nama Anda (opsional)',
      feedback_wa_placeholder:  'Nomor WhatsApp (opsional)',
      feedback_submit_label:    'Kirim Masukan',
      feedback_thanks_text:     'Terima kasih! Masukan Anda sangat berharga bagi peningkatan layanan kami.',

      outlets_section_title:    'Destinasi Kuliner',
      outlets_section_subtitle: 'Jelajahi ragam restoran dan lounge ikonik kami dengan cita rasa autentik.',
      outlets_card_cta_label:   'Lihat & Reservasi →',
      outlets_wa_template:      'Halo Bumi Surabaya, saya ingin informasi menu dan reservasi meja di {outlet_name}.',
      promos_section_title:     'Penawaran Eksklusif',
      promos_section_subtitle:  'Sajian kuliner pilihan dan momen spesial yang dirancang khusus untuk Anda.',
      promos_card_cta_label:    'Selengkapnya →',
      promos_wa_template:       'Halo Bumi Surabaya, saya tertarik dengan promo: {promo_name} di {outlet_name}. Mohon informasi reservasinya.',

      wa_status_pill:           'Concierge Online',
      wa_section_title:         'Reservasi & Informasi Layanan',
      wa_section_subtitle:      'Tim kami siap membantu Anda — reservasi meja, acara privat, maupun permintaan khusus.',
      wa_btn_label:             'Chat di WhatsApp',
      wa_picker_badge:          'HUBUNGI KAMI',
      wa_picker_title:          'Pilih Kontak Layanan WhatsApp',
      wa_picker_subtitle:       'Tim sales dan reservasi kami siap melayani Anda melalui WhatsApp. Silakan pilih kontak di bawah ini:',
      wa_picker_row_cta:        'Chat',
      wa_picker_empty_text:     'Daftar kontak sales sedang diperbarui. Anda dapat langsung menghubungi jalur reservasi utama kami di bawah ini:',
      wa_picker_fallback_btn:   'Chat Reservasi Utama',

      social_section_title:     'Tetap Terhubung',
      social_section_subtitle:  'Ikuti kami untuk cerita terbaru dan penawaran eksklusif.',
      social_label_instagram:   '📸 Instagram',
      social_label_facebook:    '👍 Facebook',
      social_label_tiktok:      '🎵 TikTok',
      social_label_youtube:     '▶️ YouTube',
      social_label_website:     '🌐 Situs Resmi',
      final_cta_title:          'Kami Menantikan Kehadiran Anda Kembali',
      final_cta_subtitle:       'Sampai jumpa pada pengalaman berkesan berikutnya di Bumi Surabaya City Resort.',
      final_review_btn_label:   'Bagikan Pengalaman Anda',
      final_wa_btn_label:       'Hubungi Kami',
      mobile_bar_review_label:  'Ulasan',
      mobile_bar_wa_label:      'WhatsApp',
      footer_privacy_label:     'Kebijakan Privasi & Penggunaan Data',
      footer_admin_label:       'Management Portal',
      footer_show_admin_link:   true,
      footer_copyright:         '© 2026 Bumi Surabaya City Resort. Seluruh hak cipta dilindungi.',
      footer_version_tag:       'Digital Guest Experience v6.4',

      privacy_badge:            'STANDAR PRIVASI RESOR KELAS DUNIA',
      privacy_title:            'Kebijakan Privasi & Penggunaan Data Tamu',
      privacy_lead_bold:        'Bumi Surabaya City Resort berkomitmen terhadap privasi yang transparan, aman, dan etis.',
      privacy_lead_sub:         'Kenyamanan dan ketenangan Anda adalah prioritas utama kami. Berikut rincian data yang diproses saat Anda menggunakan portal layanan digital ini.',
      privacy_block1_title:     'Data pribadi yang TIDAK PERNAH kami kumpulkan secara otomatis:',
      privacy_block1_items: [
        'Nama lengkap atau nomor identitas KTP/Paspor tamu',
        'Nomor telepon pribadi tamu (kecuali Anda menghubungi concierge via WhatsApp atau mengisi form secara sukarela)',
        'Alamat email pribadi tamu',
        'Nomor kartu kredit, PIN, atau rincian perbankan'
      ],
      privacy_block2_title:     'Data pseudonim & teknis yang kami proses:',
      privacy_block2_items: [
        'Penanda pseudonim: ID sesi acak (session_id) dan ID perangkat (device_id) di peramban untuk menjaga integritas interaksi dan perlindungan anti-fraud.',
        'Informasi teknis peramban: jenis peramban (User-Agent), resolusi layar, dan waktu akses server.',
        'Metrik interaksi: durasi kunjungan aktif, kedalaman gulir halaman, dan tombol aksi yang dipilih.',
        'Titik layanan: kode meja, gerai F&B, atau staf pelayan untuk evaluasi kualitas layanan internal.'
      ],
      privacy_block3_title:     'Tujuan pemrosesan & masa retensi data:',
      privacy_block3_items: [
        'Tujuan: mengevaluasi kualitas layanan staf dan gerai, mencegah manipulasi metrik, serta meningkatkan kenyamanan tamu.',
        'Retensi: log event disimpan maksimal 12 bulan untuk audit kualitas, dan ringkasan bulanan disimpan hingga 24 bulan.',
        'Kerahasiaan: data evaluasi tidak pernah dijual atau dibagikan kepada pihak ketiga untuk iklan.'
      ],
      privacy_subtext:          'Dengan menggunakan layanan ini, Anda membantu kami membangun standar perhotelan bintang lima yang lebih transparan dan tepercaya.',
      privacy_btn_label:        'Saya Mengerti'
    }
  };

  /** Default konfigurasi hotel (dipakai saat backend belum terhubung) */
  var DEFAULTS = {
    general: {
      hotel_name:          'Bumi Surabaya City Resort',
      description:         'Welcome to Bumi Surabaya City Resort — a five-star city resort in the heart of Surabaya with lush tropical gardens and legendary culinary destinations.',
      address:             'Jl. Jenderal Basuki Rachmat No.106-128, Surabaya 60271, East Java, Indonesia',
      phone:               '+62313545888',
      whatsapp:            '628113388523',
      google_review_url:   'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      instagram:           'https://www.instagram.com/bumisurabaya/',
      facebook:            'https://www.facebook.com/bumisurabaya/',
      tiktok:              '',
      youtube:             '',
      website:             '',
      logo_url:            'assets/images/logo-hotel.png',
      language_mode:       'en', // 'en' | 'id' | 'auto' (FR-V64-06)
      alert_email:         '',   // Email penerima notifikasi instan feedback <= 3 bintang (FR-V64-02)
      alert_webhook_url:   ''    // Webhook URL opsional untuk notifikasi instan feedback <= 3 bintang
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
    guest_content: {
      loading_title:            'Bumi Surabaya City Resort',
      loading_subtitle:         'Preparing your experience…',
      hero_review_btn_label:    'Share Your Experience',
      hero_wa_btn_label:        'Chat with Us',
      hero_scroll_hint:         'Scroll to explore',
      staff_badge_prefix:       'Served by ',

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

      outlets_section_title:    'Discover Dining',
      outlets_section_subtitle: 'Explore our iconic F&B outlets, each with its own culinary story.',
      outlets_card_cta_label:   'Explore & Reserve →',
      outlets_wa_template:      'Hello Bumi Surabaya, I would like the menu and table reservation info at {outlet_name}.',
      promos_section_title:     'Exclusive Offers',
      promos_section_subtitle:  'Handpicked culinary experiences and special moments, just for you.',
      promos_card_cta_label:    'Discover More →',
      promos_wa_template:       'Hello Bumi Surabaya, I am interested in the promotion: {promo_name} at {outlet_name}. Please share reservation details.',

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
      footer_version_tag:       'Digital Guest Experience v6.4',

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
      velocity_limit:    3,
      velocity_window_h: 24,
      burst_count:       5,
      burst_window_min:  10,
      low_dwell_ms:      5000,
      hopping_sources:   4,
      hopping_window_h:  1,
      shared_ip_devices: 5,
      shared_ip_min:     10,
      odd_hour_start:    6,
      odd_hour_end:      23
    }
  };

  var _activeConfig = null;
  var _activeSources = [];

  function loadConfig(gasUrl, onSuccess, onError) {
    var cached = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        _activeConfig  = parsed.config  || {};
        _activeSources = parsed.sources || [];
        if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
        return;
      } catch(e) {}
    }

    if (!gasUrl) {
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
        _activeConfig  = DEFAULTS;
        _activeSources = [];
        if (typeof onSuccess === 'function') onSuccess(_activeConfig, _activeSources);
        if (typeof onError === 'function') onError(err);
      });
  }

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

  function clearCache() {
    sessionStorage.removeItem(CONFIG_CACHE_KEY);
    sessionStorage.removeItem(CONFIG_VERSION_KEY);
  }

  function getGasUrl() {
    return localStorage.getItem(GAS_URL_KEY) || GAS_URL;
  }

  function setGasUrl(url) {
    localStorage.setItem(GAS_URL_KEY, url);
  }

  function appRoot() {
    var p = window.location.pathname || '/';
    var dir = p.charAt(p.length - 1) === '/' ? p : p.substring(0, p.lastIndexOf('/') + 1);
    if (/\/admin\/$/.test(dir)) dir = dir.replace(/admin\/$/, '');
    return dir;
  }

  function resolveAsset(p) {
    if (!p || /^(https?:|data:|\/\/)/i.test(p)) return p;
    return appRoot() + String(p).replace(/^\/+/, '');
  }

  window.BSConfig = {
    GAS_URL:             GAS_URL,
    DEFAULTS:            DEFAULTS,
    PRESET_ID:           PRESET_ID,
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
