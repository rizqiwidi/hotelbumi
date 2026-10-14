/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v5.0
 * config.js — Konstanta dasar & fallback defaults
 * Hanya berisi nilai publik yang aman; TIDAK ada token/rahasia.
 */

(function(window) {
  'use strict';

  /** URL backend Google Apps Script produksi v6.0 */
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
      hotel_name:  'Bumi Surabaya City Resort',
      description: 'Hotel bintang lima di jantung Kota Surabaya',
      address:     'Jl. Jenderal Basuki Rachmat No.106-128, Surabaya 60271',
      phone:       '+62313545888',
      whatsapp:    '628113388523',
      google_review_url: 'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      instagram:   'https://www.instagram.com/bumisurabaya/',
      facebook:    'https://www.facebook.com/bumisurabaya/',
      tiktok:      ''
    },
    appearance: {
      accent_color:    '#c9a96e',
      hero_text:       'Welcome to Bumi Surabaya',
      hero_subtitle:   'Five-Star City Resort in the Heart of Surabaya',
      welcome_msg_staff:  'You are currently being served wholeheartedly by our team.',
      welcome_msg_outlet: 'Enjoy an exclusive culinary experience at {outlet_name}.',
      welcome_msg_general:'We are delighted to welcome you to Bumi Surabaya City Resort.'
    },
    guest_sections: {
      show_review:    true,
      show_wa:        true,
      show_promotions:true,
      show_outlets:   true,
      show_social:    true,
      show_final_cta: true
    },
    review_settings: {
      review_url:    'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      button_text:   'Share Your Experience',
      review_prompt: 'Your experience means a lot to us. Share your impression and help other guests discover the beauty of Bumi Surabaya.'
    },
    whatsapp_settings: {
      number: '628113388523',
      template_staff:   'Halo, saya tamu Bumi Surabaya. Saya baru saja dilayani oleh {staff_name} dan ingin melakukan reservasi.',
      template_general: 'Halo Bumi Surabaya, saya ingin informasi mengenai reservasi dan layanan hotel.'
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
        highlight: 'Private Room 30 Pax'
      },
      {
        id: 'kizahashi',
        name: 'Kizahashi',
        type: 'Authentic Japanese Restaurant',
        description: 'Restoran Jepang autentik dengan sushi, sashimi segar, teppanyaki live cooking, ramen, udon, dan tempura, dilengkapi 2 ruang Tatami @10 orang.',
        emoji: '🍣',
        image_url: 'assets/images/outlets/kizahashi.svg',
        hours: '11.30 – 14.30 & 18.00 – 22.00 WIB',
        highlight: '2 Ruang Tatami @10 Pax'
      },
      {
        id: 'lobby-lounge',
        name: 'Lobby Lounge',
        type: 'All-Day Lounge & Refreshments',
        description: 'Suasana santai dan megah untuk all-day refreshments, kopi istimewa, dan aneka kue lokal — tempat sempurna untuk bertemu kolega dan teman.',
        emoji: '🍸',
        image_url: 'assets/images/outlets/lobby-lounge.jpg',
        hours: '08.00 – 23.00 WIB',
        highlight: 'Live Music & High Tea'
      },
      {
        id: 'delikopi',
        name: 'DeliKopi',
        type: 'Specialty Coffee & Gourmet Pastry',
        description: 'Kopi istimewa serta ragam roti dan pastry segar setiap hari, menghidupkan kembali konsep Delicatessen hotel legendaris.',
        emoji: '☕',
        image_url: 'assets/images/outlets/delikopi.svg',
        hours: '07.00 – 21.00 WIB',
        highlight: 'Fresh Bakery Daily'
      }
    ],
    fraud_thresholds: {
      velocity_limit:    3,    // max kunjungan per perangkat ke 1 sumber / 24 jam
      velocity_window_h: 24,
      burst_count:       5,    // kunjungan dalam jendela burst
      burst_window_min:  10,
      low_dwell_ms:      5000, // < 5 detik = low quality
      hopping_sources:   4,    // 4+ sumber berbeda = hopping
      hopping_window_h:  1,
      shared_ip_devices: 5,    // 5+ device dari 1 IP ke 1 sumber / 10 mnt
      shared_ip_min:     10,
      odd_hour_start:    0,    // WIB
      odd_hour_end:      5    // WIB (05:30)
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
    return _activeConfig[section] || DEFAULTS[section];
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
