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
      onStatus({ status: 'error', message: errMsg });
      return Promise.reject(new Error(errMsg));
    }

    // --- Abort any previous operation ---
    abort();
    _controller = new AbortController();
    var signal  = _controller.signal;

    onStatus({ status: 'scanning', message: 'Mendekatkan kartu NFC ke perangkat…' });

    var reader;
    try {
      reader = new window.NDEFReader();
    } catch (e) {
      onStatus({ status: 'error', message: 'Gagal inisialisasi NDEFReader: ' + e.message });
      return Promise.reject(e);
    }

    return reader.scan({ signal: signal })
      .then(function() {
        return new Promise(function(resolve, reject) {
          // Listen for the first tag to appear, then write to it
          reader.addEventListener('reading', function onReading(event) {
            reader.removeEventListener('reading', onReading);

            onStatus({ status: 'scanning', message: 'Kartu terdeteksi — menulis URL…' });

            reader.write(
              { records: [{ recordType: 'url', data: url }] },
              { signal: signal }
            )
            .then(function() {
              _controller = null;
              onStatus({
                status:  'success',
                message: 'URL berhasil ditulis ke kartu NFC: ' + url
              });
              resolve();
            })
            .catch(function(writeErr) {
              _controller = null;
              if (writeErr.name === 'AbortError') {
                onStatus({ status: 'error', message: 'Penulisan NFC dibatalkan.' });
              } else {
                onStatus({ status: 'error', message: 'Gagal menulis ke kartu NFC: ' + writeErr.message });
              }
              reject(writeErr);
            });
          }, { once: true });

          // Handle abort during scan wait
          signal.addEventListener('abort', function() {
            onStatus({ status: 'error', message: 'Operasi NFC dibatalkan.' });
            reject(new DOMException('Dibatalkan', 'AbortError'));
          }, { once: true });
        });
      })
      .catch(function(scanErr) {
        _controller = null;
        if (scanErr.name === 'AbortError') {
          onStatus({ status: 'error', message: 'Pemindaian NFC dibatalkan.' });
        } else if (scanErr.name === 'NotAllowedError') {
          onStatus({
            status:  'error',
            message: 'Izin NFC ditolak. Pastikan izin NFC diberikan di pengaturan browser.'
          });
        } else if (scanErr.name === 'NotSupportedError') {
          onStatus({
            status:  'error',
            message: 'Perangkat tidak mendukung NFC atau NFC dinonaktifkan.'
          });
        } else {
          onStatus({ status: 'error', message: 'Gagal memulai pemindaian NFC: ' + scanErr.message });
        }
        return Promise.reject(scanErr);
      });
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.BSNfc = {
    isSupported: isSupported,
    writeCard:   writeCard,
    abort:       abort
  };

})(window);
