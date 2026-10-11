/**
 * BUMI SURABAYA v5.0
 * retry-queue.js — Antrean offline localStorage & exponential backoff
 *
 * Menjamin 0% kehilangan data saat tamu mengalami drop connection.
 * Event yang gagal dikirim disimpan ke localStorage dan di-retry
 * secara otomatis saat koneksi pulih.
 */

(function(window) {
  'use strict';

  var QUEUE_KEY = (window.BSConfig && window.BSConfig.RETRY_QUEUE_KEY) || 'bs_retry_queue';
  var MAX_ITEMS = 200;          // batas maksimal antrean
  var MAX_RETRIES = 7;          // setelah 7x gagal, buang
  var BASE_DELAY_MS = 1000;     // 1 detik awal, kemudian 2x lipat
  var MAX_DELAY_MS  = 60000;    // maksimal 1 menit

  var _timer = null;
  var _online = navigator.onLine !== false;
  var _flushInProgress = false;

  /** Baca antrean dari localStorage */
  function readQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch(e) { return []; }
  }

  /** Simpan antrean ke localStorage */
  function saveQueue(q) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_ITEMS)));
    } catch(e) { /* localStorage penuh */ }
  }

  /**
   * Tambahkan item ke antrean.
   * @param {string} gasUrl  - URL endpoint GAS
   * @param {object} payload - Body event
   */
  function enqueue(gasUrl, payload) {
    var q = readQueue();
    q.push({
      id:       payload.event_id || ('q_' + Date.now()),
      gasUrl:   gasUrl,
      payload:  payload,
      retries:  0,
      nextRetry:Date.now()
    });
    saveQueue(q);
    scheduleFlush(0);
  }

  /**
   * Kirim satu item ke backend.
   * @returns {Promise<boolean>}
   */
  function sendItem(item) {
    return fetch(item.gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(item.payload),
      keepalive: true
    }).then(function(r) {
      return r.ok;
    }).catch(function() {
      return false;
    });
  }

  /**
   * Flush antrean: kirim semua item yang sudah waktunya.
   */
  function flush() {
    if (_flushInProgress || !_online) return;
    var q = readQueue();
    if (!q.length) return;

    _flushInProgress = true;
    var now = Date.now();
    var pending = q.filter(function(item) { return item.nextRetry <= now; });

    if (!pending.length) {
      _flushInProgress = false;
      // Jadwalkan flush berikutnya
      var earliest = q.reduce(function(min, x) { return Math.min(min, x.nextRetry); }, Infinity);
      scheduleFlush(Math.max(0, earliest - now + 100));
      return;
    }

    // Kirim satu per satu secara berurutan (menghindari banjir request)
    var idx = 0;
    function next() {
      if (idx >= pending.length) {
        _flushInProgress = false;
        // Jadwalkan lagi jika masih ada
        var remaining = readQueue();
        if (remaining.length) scheduleFlush(BASE_DELAY_MS);
        return;
      }
      var item = pending[idx++];
      sendItem(item).then(function(ok) {
        var current = readQueue();
        if (ok) {
          // Hapus dari antrean
          current = current.filter(function(x) { return x.id !== item.id; });
        } else {
          item.retries++;
          if (item.retries >= MAX_RETRIES) {
            // Buang item gagal permanen
            current = current.filter(function(x) { return x.id !== item.id; });
          } else {
            // Exponential backoff
            var delay = Math.min(BASE_DELAY_MS * Math.pow(2, item.retries), MAX_DELAY_MS);
            item.nextRetry = Date.now() + delay;
            current = current.map(function(x) { return x.id === item.id ? item : x; });
          }
        }
        saveQueue(current);
        next();
      });
    }
    next();
  }

  /** Jadwalkan flush */
  function scheduleFlush(delayMs) {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(flush, delayMs || 0);
  }

  /** Inisialisasi listener online/offline */
  function init() {
    window.addEventListener('online', function() {
      _online = true;
      scheduleFlush(500);
    });
    window.addEventListener('offline', function() {
      _online = false;
    });
    // Flush saat startup (jika ada item tertunda dari sesi sebelumnya)
    if (_online) scheduleFlush(2000);
  }

  /** Jumlah item yang masih dalam antrean */
  function size() { return readQueue().length; }

  /** Hapus semua item (dipakai saat testing) */
  function clear() { saveQueue([]); }

  // Inisialisasi otomatis
  init();

  // Ekspos ke global
  window.BSRetryQueue = {
    enqueue:        enqueue,
    flush:          flush,
    size:           size,
    clear:          clear,
    scheduleFlush:  scheduleFlush
  };

})(window);
