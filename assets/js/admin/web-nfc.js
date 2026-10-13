/**
 * BUMI SURABAYA v5.0
 * web-nfc.js — Web NFC Writer Module
 *
 * Wraps the Web NFC API (NDEFReader) with a clean async interface.
 * Gracefully falls back on iOS / desktop with manual NFC Tools instructions.
 *
 * Usage:
 *   BSNfc.isSupported()                   → boolean
 *   BSNfc.writeCard(url, onStatus)        → Promise<void>
 *   BSNfc.abort()                         → void
 *
 * onStatus callback signature:
 *   function onStatus({ status: 'scanning'|'success'|'error', message: string })
 */

(function(window) {
  'use strict';

  /** @type {AbortController|null} */
  var _controller = null;

  /**
   * Check if the Web NFC API is available in this browser.
   * Chrome 89+ on Android with a flag or OEM support.
   * @returns {boolean}
   */
  function isSupported() {
    return typeof window !== 'undefined' && 'NDEFReader' in window;
  }

  /**
   * Abort any in-progress NFC scan / write operation.
   */
  function abort() {
    if (_controller) {
      try { _controller.abort(); } catch (_) { /* ignore */ }
      _controller = null;
    }
  }

  /**
   * Write a URL NDEF record to an NFC card.
   *
   * @param {string}   url      - The URL to encode on the NFC card
   * @param {function} onStatus - Callback: function({ status, message })
   * @returns {Promise<void>}
   */
  function writeCard(url, onStatus) {
    onStatus = typeof onStatus === 'function' ? onStatus : function() {};

    // --- Fallback for unsupported environments ---
    if (!isSupported()) {
      var ua = (navigator.userAgent || '').toLowerCase();
      var isIos = /iphone|ipad|ipod/.test(ua);
      var msg = isIos
        ? 'Web NFC tidak didukung di iOS. Gunakan aplikasi "NFC Tools" (App Store):\n' +
          '1. Buka NFC Tools → Write → Add a record → URL\n' +
          '2. Masukkan URL: ' + url + '\n' +
          '3. Tap "Write" dan tempelkan kartu NFC.'
        : 'Web NFC tidak didukung di browser ini. Gunakan Chrome di Android, atau ' +
          'aplikasi "NFC Tools" (Play Store / App Store):\n' +
          '1. Write → Add a record → URL\n' +
          '2. URL: ' + url + '\n' +
          '3. Tap "Write" dan tempelkan kartu NFC.';
      onStatus({ status: 'error', message: msg });
      return Promise.reject(new Error('Web NFC not supported'));
    }

    // --- Validate URL ---
    if (!url || typeof url !== 'string' || url.trim() === '') {
      var errMsg = 'URL tidak boleh kosong.';
      onStatus({ status: 'error', stage: 'validation', message: errMsg });
      return Promise.reject(new Error(errMsg));
    }

    // --- Abort any previous operation ---
    abort();
    _controller = new AbortController();
    var signal  = _controller.signal;

    // Stage 1: Requesting permission
    onStatus({
      status:  'permission',
      stage:   'permission',
      message: 'Meminta izin akses NFC dari browser… Harap izinkan jika muncul dialog izin.'
    });

    var reader;
    try {
      reader = new window.NDEFReader();
    } catch (e) {
      _controller = null;
      var initErr = 'Gagal inisialisasi NDEFReader: ' + (e.message || e);
      onStatus({ status: 'error', stage: 'permission', message: initErr });
      return Promise.reject(e);
    }

    return reader.scan({ signal: signal })
      .then(function() {
        // Stage 2: Permission granted, waiting for card tap
        onStatus({
          status:  'waiting',
          stage:   'waiting',
          message: 'Izin aktif. Menunggu kartu NFC… Tempelkan kartu fisik ke bagian belakang perangkat.'
        });

        return new Promise(function(resolve, reject) {
          // Listen for the first tag to appear, then write to it
          reader.addEventListener('reading', function onReading(event) {
            reader.removeEventListener('reading', onReading);

            // Stage 3: Writing NDEF record
            onStatus({
              status:  'writing',
              stage:   'writing',
              message: 'Kartu NFC terdeteksi — sedang memprogram URL ke kartu fisik…'
            });

            reader.write(
              { records: [{ recordType: 'url', data: url }] },
              { signal: signal }
            )
            .then(function() {
              _controller = null;
              // Stage 4: Success
              onStatus({
                status:  'success',
                stage:   'success',
                message: 'URL berhasil ditulis ke kartu NFC: ' + url
              });
              resolve();
            })
            .catch(function(writeErr) {
              _controller = null;
              var wMsg = writeErr.name === 'AbortError'
                ? 'Penulisan NFC dibatalkan.'
                : 'Gagal menulis ke kartu NFC: ' + (writeErr.message || 'error tidak dikenal');
              onStatus({ status: 'error', stage: 'writing', message: wMsg });
              reject(writeErr);
            });
          }, { once: true });

          // Handle abort during scan wait
          signal.addEventListener('abort', function() {
            onStatus({ status: 'error', stage: 'waiting', message: 'Operasi NFC dibatalkan.' });
            reject(new DOMException('Dibatalkan', 'AbortError'));
          }, { once: true });
        });
      })
      .catch(function(scanErr) {
        _controller = null;
        var sMsg;
        if (scanErr.name === 'AbortError') {
          sMsg = 'Pemindaian NFC dibatalkan.';
        } else if (scanErr.name === 'NotAllowedError') {
          sMsg = 'Izin NFC ditolak oleh pengguna atau sistem. Pastikan NFC aktif di pengaturan perangkat.';
        } else if (scanErr.name === 'NotSupportedError') {
          sMsg = 'Perangkat tidak memiliki hardware NFC atau NFC sedang dimatikan di perangkat.';
        } else {
          sMsg = 'Gagal memulai pemindaian NFC: ' + (scanErr.message || scanErr);
        }
        onStatus({ status: 'error', stage: 'permission', message: sMsg });
        return Promise.reject(scanErr);
      });
  }

  /**
   * Adapter for writeUrl callback signature: callback(isSuccess, message, stage)
   */
  function writeUrl(url, callback) {
    if (typeof callback !== 'function') callback = function() {};
    return writeCard(url, function(ev) {
      if (ev.status === 'success') {
        callback(true, ev.message, ev.stage);
      } else if (ev.status === 'error') {
        callback(false, ev.message, ev.stage);
      } else {
        // intermediate progress stages (permission, waiting, writing)
        callback(null, ev.message, ev.stage);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  var BSNfcExport = {
    isSupported: isSupported,
    writeCard:   writeCard,
    writeUrl:    writeUrl,
    abort:       abort
  };

  window.BSNfc    = BSNfcExport;
  window.BSWebNfc = BSNfcExport;

})(window);
