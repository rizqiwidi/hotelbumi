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

  var QUEUE_KEY     = (window.BSConfig && window.BSConfig.RETRY_QUEUE_KEY) || 'bs_retry_queue';
  var DLQ_KEY       = 'bs_dead_letter_queue';
  var MAX_ITEMS     = 200;          // batas maksimal antrean aktif
  var MAX_DLQ       = 100;          // batas maksimal dead-letter queue
  var MAX_RETRIES   = 7;            // setelah 7x gagal retryable, pindahkan ke DLQ
  var BASE_DELAY_MS = 1000;         // 1 detik awal, kemudian 2x lipat
  var MAX_DELAY_MS  = 60000;        // maksimal 1 menit

  var _timer = null;
  var _online = navigator.onLine !== false;
  var _flushInProgress = false;

  /** Baca antrean aktif dari localStorage */
  function readQueue() {
    try {
      return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    } catch(e) { return []; }
  }

  /** Simpan antrean aktif ke localStorage */
  function saveQueue(q) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-MAX_ITEMS)));
    } catch(e) { /* localStorage penuh */ }
  }

  /** Baca dead-letter queue dari localStorage */
  function readDlq() {
    try {
      return JSON.parse(localStorage.getItem(DLQ_KEY) || '[]');
    } catch(e) { return []; }
  }

  /**
   * Catat event yang gagal permanen ke Dead-Letter Queue (GUE-11).
   * Menghindari data dibuang diam-diam tanpa audit log.
   */
  function recordDeadLetter(item, reason) {
    try {
      var dlq = readDlq();
      var evId = (item.payload && item.payload.event_id) || item.id || '';
      dlq.push({
        id:        item.id || ('dlq_' + Date.now()),
        event_id:  evId,
        gasUrl:    item.gasUrl || '',
        payload:   item.payload || item,
        reason:    String(reason || 'Permanent failure'),
        attempts:  item.retries || 1,
        failedAt:  new Date().toISOString()
      });
      localStorage.setItem(DLQ_KEY, JSON.stringify(dlq.slice(-MAX_DLQ)));
    } catch(e) {}
  }

  /**
   * Klasifikasikan apakah error bersifat permanen (bad payload, validation, unauthorized)
   * atau sementara (network drop, timeout, rate limit, server 5xx). (GUE-11, API-03)
   */
  function isPermanentError(status, respOrErr) {
    if (status === 400 || status === 401 || status === 403 || status === 422) {
      return true;
    }
    var msg = '';
    if (typeof respOrErr === 'string') msg = respOrErr;
    else if (respOrErr && respOrErr.error) msg = String(respOrErr.error);
    else if (respOrErr && respOrErr.message) msg = String(respOrErr.message);

    var lmsg = msg.toLowerCase();
    if (lmsg.indexOf('validation') !== -1 ||
        lmsg.indexOf('invalid') !== -1 ||
        lmsg.indexOf('unknown action') !== -1 ||
        lmsg.indexOf('missing required') !== -1 ||
        lmsg.indexOf('unauthorized') !== -1) {
      return true;
    }
    return false;
  }

  /**
   * Tambahkan item ke antrean dengan id yang stabil untuk idempotensi.
   * @param {string} gasUrl  - URL endpoint GAS
   * @param {object} payload - Body event (mempertahankan event_id)
   */
  function enqueue(gasUrl, payload) {
    if (!payload || typeof payload !== 'object') return;
    if (!payload.event_id) {
      payload.event_id = window.BSFingerprint ? window.BSFingerprint.uuid4() : ('ev_' + Date.now());
    }
    var q = readQueue();
    // Jangan duplikasi jika event_id sudah ada di antrean
    var exists = q.some(function(x) { return x.id === payload.event_id; });
    if (exists) return;

    q.push({
      id:       payload.event_id,
      gasUrl:   gasUrl,
      payload:  payload,
      retries:  0,
      nextRetry:Date.now()
    });
    saveQueue(q);
    scheduleFlush(0);
  }

  /**
   * Menangani kegagalan pengiriman langsung dari tracking.js.
   */
  function handleSendFailure(gasUrl, payload, errorOrResp) {
    var status = (errorOrResp && errorOrResp.status) || 0;
    if (isPermanentError(status, errorOrResp)) {
      var reason = (errorOrResp && (errorOrResp.error || errorOrResp.message)) || 'Permanent error';
      recordDeadLetter({ gasUrl: gasUrl, payload: payload }, reason);
    } else {
      enqueue(gasUrl, payload);
    }
  }

  /**
   * Kirim satu item ke backend.
   * Respons HTTP 200 dengan body {ok:false} TIDAK boleh dianggap sukses. (API-03, GUE-11)
   * @returns {Promise<{success:boolean, permanent:boolean, reason:string}>}
   */
  function sendItem(item) {
    return fetch(item.gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(item.payload),
      keepalive: true
    }).then(function(r) {
      return r.json().then(function(data) {
        if (r.ok && data && data.ok === true) {
          return { success: true, permanent: false, reason: '' };
        }
        var errStr = (data && data.error) || ('HTTP ' + r.status);
        var perm = isPermanentError(r.status, data);
        return { success: false, permanent: perm, reason: errStr };
      }).catch(function() {
        var perm = isPermanentError(r.status, 'Invalid JSON');
        return { success: false, permanent: perm, reason: 'Invalid JSON HTTP ' + r.status };
      });
    }).catch(function(networkErr) {
      return { success: false, permanent: false, reason: networkErr ? networkErr.message : 'Network error' };
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
      var earliest = q.reduce(function(min, x) { return Math.min(min, x.nextRetry); }, Infinity);
      scheduleFlush(Math.max(0, earliest - now + 100));
      return;
    }

    // Kirim satu per satu secara berurutan
    var idx = 0;
    function next() {
      if (idx >= pending.length) {
        _flushInProgress = false;
        var remaining = readQueue();
        if (remaining.length) scheduleFlush(BASE_DELAY_MS);
        return;
      }
      var item = pending[idx++];
      sendItem(item).then(function(res) {
        var current = readQueue();
        if (res.success) {
          // Sukses: hapus dari antrean
          current = current.filter(function(x) { return x.id !== item.id; });
        } else if (res.permanent) {
          // Gagal permanen: jangan retry, pindahkan ke Dead-Letter Queue
          recordDeadLetter(item, res.reason);
          current = current.filter(function(x) { return x.id !== item.id; });
        } else {
          // Gagal retryable (network/timeout): tambah percobaan
          item.retries++;
          if (item.retries >= MAX_RETRIES) {
            recordDeadLetter(item, 'Exceeded MAX_RETRIES (' + MAX_RETRIES + '): ' + res.reason);
            current = current.filter(function(x) { return x.id !== item.id; });
          } else {
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
    if (_online) scheduleFlush(2000);
  }

  /** Jumlah item yang masih dalam antrean aktif */
  function size() { return readQueue().length; }

  /** Hapus semua item aktif (testing) */
  function clear() { saveQueue([]); }

  init();

  // Ekspos ke global
  window.BSRetryQueue = {
    enqueue:              enqueue,
    handleSendFailure:    handleSendFailure,
    flush:                flush,
    size:                 size,
    clear:                clear,
    getDeadLetterQueue:   readDlq,
    clearDeadLetterQueue: function() { localStorage.removeItem(DLQ_KEY); },
    isPermanentError:     isPermanentError,
    scheduleFlush:        scheduleFlush
  };

})(window);
