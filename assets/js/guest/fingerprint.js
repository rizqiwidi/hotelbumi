/**
 * BUMI SURABAYA v5.0
 * fingerprint.js — Generator device_id persisten & hash cyrb53
 *
 * cyrb53: https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js
 * Algorithm: fast non-cryptographic 53-bit hash, minimal collision rate.
 * device_id disimpan di localStorage (persisten lintas sesi).
 */

(function(window) {
  'use strict';

  /**
   * cyrb53 hash — deterministik, 53-bit
   * @param {string} str
   * @param {number} [seed=0]
   * @returns {number}
   */
  function cyrb53(str, seed) {
    seed = seed || 0;
    var h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1  = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2  = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  /**
   * Buat string fingerprint dari sinyal browser pasif (tanpa izin tamu).
   * Dipakai sebagai INPUT cyrb53, bukan sebagai identitas final.
   */
  function collectSignals() {
    var nav = navigator;
    var scr = screen;
    var parts = [
      nav.userAgent || '',
      nav.language  || '',
      scr.width  + 'x' + scr.height + '@' + (scr.colorDepth || 24),
      nav.hardwareConcurrency || 0,
      Intl ? Intl.DateTimeFormat().resolvedOptions().timeZone || '' : '',
      nav.platform || '',
      (nav.plugins ? nav.plugins.length : 0)
    ];
    return parts.join('|');
  }

  /**
   * Hasilkan fingerprint cyrb53 dalam format hex 13-karakter.
   */
  function generateFingerprint() {
    var sig = collectSignals();
    var num = cyrb53(sig);
    return 'fp_' + num.toString(16).padStart(13, '0');
  }

  /**
   * Ambil atau buat device_id persisten di localStorage.
   * Format: dev_xxxxxxxxxxxxxxxx (16 hex chars random)
   */
  function getOrCreateDeviceId() {
    var key = (window.BSConfig && window.BSConfig.DEVICE_ID_KEY) || 'bs_device_id';
    var existing = null;
    try {
      existing = (window.BSConfig && BSConfig.safeLocal)
        ? BSConfig.safeLocal.get(key)
        : localStorage.getItem(key);
    } catch (_) {}
    if (existing && /^dev_[a-f0-9]{16}$/.test(existing)) {
      return existing;
    }
    // Generate baru
    var arr = new Uint8Array(8);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    } else {
      for (var i = 0; i < 8; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    var hex = Array.from(arr).map(function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
    var id = 'dev_' + hex;
    try {
      if (window.BSConfig && BSConfig.safeLocal) BSConfig.safeLocal.set(key, id);
      else localStorage.setItem(key, id);
    } catch (_) {}
    return id;
  }

  /**
   * Buat UUID v4 standar (dipakai untuk event_id & session_id)
   */
  function uuid4() {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    // Polyfill sederhana
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Ekspos ke global
  window.BSFingerprint = {
    cyrb53:             cyrb53,
    generateFingerprint:generateFingerprint,
    getOrCreateDeviceId:getOrCreateDeviceId,
    uuid4:              uuid4
  };

})(window);
