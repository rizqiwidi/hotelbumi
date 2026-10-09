/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v5.0
 * config.js — Konstanta dasar & fallback defaults
 * Hanya berisi nilai publik yang aman; TIDAK ada token/rahasia.
 */

(function(window) {
  'use strict';

  /** URL backend Google Apps Script — diisi admin lewat UI, tidak di-hardcode */
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
      google_review_url: 'https://g.page/r/CbSXVEVxrNXhEB0/review',
      instagram:   'https://www.instagram.com/bumisurabaya/',
      facebook:    'https://www.facebook.com/bumisurabaya/',
      tiktok:      ''
    },
    appearance: {
      accent_color:    '#c9a96e',
      hero_text:       'Selamat Datang di Bumi Surabaya',
      hero_subtitle:   'Hotel Bintang Lima di Jantung Surabaya',
      welcome_msg_staff:  'Anda saat ini dilayani dengan sepenuh hati oleh tim kami.',
      welcome_msg_outlet: 'Nikmati pengalaman kuliner eksklusif di {outlet_name}.',
      welcome_msg_general:'Kami dengan bangga menyambut Anda di Bumi Surabaya City Resort.'
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
      review_url:    'https://g.page/r/CbSXVEVxrNXhEB0/review',
      button_text:   'Berikan Ulasan di Google ⭐',
      review_prompt: 'Pengalaman Anda berarti bagi kami. Bagikan kesan Anda dan bantu tamu lain menemukan keindahan Bumi Surabaya.'
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
        description: 'Nikmati makan malam prasmanan dengan lebih dari 80 pilihan menu Nusantara dan internasional setiap hari.',
        price: 'Rp 385.000 nett/pax',
        period: 'Setiap hari, pukul 18.00 – 22.00 WIB',
        emoji: '🌙',
        active: true
      },
      {
        id: 'promo-omakase',
        name: 'Omakase Kizahashi Experience',
        outlet: 'Kizahashi Japanese Restaurant',
        description: 'Perjalanan kuliner Jepang otentik dipandu Chef di meja sushi bar eksklusif kami.',
        price: 'Rp 750.000 nett/pax',
        period: 'Selasa – Sabtu, pukul 12.00 – 14.30 & 18.30 – 21.00 WIB',
        emoji: '🍣',
        active: true
      },
      {
        id: 'promo-high-tea',
        name: 'Champagne High Tea',
        outlet: 'Peacock Lounge',
        description: 'Rasakan tradisi afternoon tea ala hotel bintang lima dengan pilihan kue pastry premium dan teh pilihan dunia.',
        price: 'Rp 220.000 nett/pax',
        period: 'Sabtu & Minggu, pukul 14.00 – 17.00 WIB',
        emoji: '☕',
        active: true
      }
    ],
    outlets: [
      { id: 'arumanis', name: 'Arumanis Restaurant', type: 'Restaurant', description: 'Restoran all-day dining dengan masakan Nusantara & internasional', emoji: '🍽️' },
      { id: 'kizahashi', name: 'Kizahashi', type: 'Japanese Restaurant', description: 'Kuliner Jepang otentik dengan chef berpengalaman dari Tokyo', emoji: '🍣' },
      { id: 'peacock', name: 'Peacock Lounge', type: 'Lounge & Bar', description: 'Lounge bergaya art-deco untuk cocktail, mocktail, dan live music', emoji: '🎵' },
      { id: 'pool-bar', name: 'Pool Bar', type: 'Pool Bar', description: 'Bar tepi kolam renang dengan pemandangan taman tropis', emoji: '🏊' }
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

  /** Ambil GAS URL dari localStorage */
  function getGasUrl() {
    return localStorage.getItem(GAS_URL_KEY) || '';
  }

  /** Simpan GAS URL ke localStorage */
  function setGasUrl(url) {
    localStorage.setItem(GAS_URL_KEY, url);
  }

  // Ekspos ke global
  window.BSConfig = {
    DEFAULTS:            DEFAULTS,
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
