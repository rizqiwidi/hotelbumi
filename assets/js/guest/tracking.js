/**
 * BUMI SURABAYA v5.0
 * tracking.js — Event tracker, session storage, beacon unload
 *
 * Menangani:
 * - Deduplikasi kunjungan per sesi (FR-TRK-01)
 * - Atribusi sumber persisten via sessionStorage (FR-TRK-02)
 * - Retry queue untuk ketahanan offline (FR-TRK-03)
 * - sendBeacon dwell_update saat pagehide (FR-TRK-04)
 *
 * Perbaikan bug v4:
 * - event dwell_update dikirim sebagai PEMBARUAN baris session (bukan baris baru)
 * - dwell_ms dihitung dari visibilitychange & PageVisibility API
 */

(function(window) {
  'use strict';

  // ── State sesi ──────────────────────────────────────────────
  var _sessionId  = null;
  var _deviceId   = null;
  var _fp         = null;
  var _source     = null;
  var _sourceType = 'general';
  var _gasUrl     = '';
  var _visitSent  = false;   // Deduplikasi: satu visit per session
  var _dwellStart = 0;       // Timestamp mulai dwell aktif
  var _dwellAccum = 0;       // Akumulasi dwell (ms)
  var _interactions = 0;
  var _scrollMax  = 0;

  // Kunci sessionStorage untuk deduplikasi
  var VISIT_SENT_KEY = 'bs_visit_sent';

  /** Buat session ID baru */
  function makeSessionId() {
    if (window.BSFingerprint) return 'ses_' + window.BSFingerprint.uuid4().replace(/-/g, '').substring(0, 12);
    return 'ses_' + Date.now().toString(36);
  }

  /** Ambil atau buat session ID (persisten dalam tab) */
  function getSessionId() {
    if (_sessionId) return _sessionId;
    var key = 'bs_session_id';
    var existing = sessionStorage.getItem(key);
    if (existing) { _sessionId = existing; return _sessionId; }
    _sessionId = makeSessionId();
    sessionStorage.setItem(key, _sessionId);
    return _sessionId;
  }

  /** Masa berlaku atribusi sesi jika tidak ada query parameter baru (30 menit inaktivitas, GUE-12) */
  var SOURCE_ATTRIBUTION_TTL_MS = 30 * 60 * 1000;

  /**
   * Resolusi source dengan prioritas terdokumentasi (GUE-02, GUE-12):
   * 1. Query param ?source= di URL (prioritas tertinggi — langsung menimpa sesi lama).
   * 2. Sesi aktif tersimpan di sessionStorage (selama belum kedaluwarsa 30 menit).
   * 3. Fallback default ('general').
   */
  function resolveSource() {
    var cfgKey = (window.BSConfig && window.BSConfig.SESSION_SOURCE_KEY) || 'bs_session_source';
    var params = new URLSearchParams(window.location.search);
    var rawQuery = (params.get('source') || '').trim();

    // 1. Prioritas Utama: Query param eksplisit dari URL
    if (rawQuery) {
      _source = rawQuery;
      if (/^staff-/i.test(_source))        _sourceType = 'staff';
      else if (/^nfc-/i.test(_source))    _sourceType = 'nfc';
      else if (/^sales-/i.test(_source))  _sourceType = 'sales';
      else if (_source !== 'general')     _sourceType = 'outlet';
      else                                _sourceType = 'general';

      // Simpan ke sessionStorage dengan timestamp pembaruan
      try {
        sessionStorage.setItem(cfgKey, JSON.stringify({
          code: _source,
          type: _sourceType,
          ts: Date.now()
        }));
      } catch(e) {}
      return;
    }

    // 2. Prioritas Kedua: Sesi aktif tersimpan (jika dalam batas TTL 30 menit)
    try {
      var saved = sessionStorage.getItem(cfgKey);
      if (saved) {
        var p = JSON.parse(saved);
        var age = Date.now() - (Number(p.ts) || 0);
        if (p.code && age >= 0 && age < SOURCE_ATTRIBUTION_TTL_MS) {
          _source     = p.code;
          _sourceType = p.type || 'general';
          // Perbarui timestamp interaksi sesi (sliding inactivity window)
          p.ts = Date.now();
          sessionStorage.setItem(cfgKey, JSON.stringify(p));
          return;
        } else {
          // Kedaluwarsa: hapus atribusi sesi yang sudah kadaluarsa
          sessionStorage.removeItem(cfgKey);
        }
      }
    } catch(e) {}

    // 3. Fallback Default
    _source     = 'general';
    _sourceType = 'general';
  }

  /** Buat payload event standar */
  function buildPayload(eventName, extra) {
    var ua = navigator.userAgent.substring(0, 150);
    var scr= screen.width + 'x' + screen.height + '@' + (screen.devicePixelRatio || 1).toFixed(1);
    var evId = window.BSFingerprint ? window.BSFingerprint.uuid4() : ('ev_' + Date.now());
    var hpValue = (window._bsHpValue || (document.getElementById('bs-hp-website') ? document.getElementById('bs-hp-website').value : '') || '').substring(0, 100);
    return {
      action:      'log_event',
      event_id:    evId,
      session_id:  getSessionId(),
      device_id:   _deviceId  || '',
      event:       eventName,
      source:      _source     || 'general',
      source_type: _sourceType || 'general',
      ts_client:   new Date().toISOString(),
      screen:      scr,
      ua:          ua,
      fp:          _fp || '',
      dwell_ms:    _dwellAccum,
      interactions:_interactions,
      scroll_max:  _scrollMax,
      hp:          hpValue,   // honeypot terhubung ke field dan window._bsHpValue (AF-06)
      extra:       extra || {}
    };
  }

  /**
   * Kirim event ke backend.
   * Jika respons bukan {ok:true} atau gagal jaringan → masukkan ke retry queue atau DLQ (GUE-11, API-03).
   */
  function sendEvent(payload) {
    if (!_gasUrl) return;
    fetch(_gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(payload)
    }).then(function(r) {
      return r.json().then(function(data) {
        if (!r.ok || !data || data.ok !== true) {
          var err = new Error((data && data.error) || ('HTTP ' + r.status));
          err.status = r.status;
          err.response = data;
          throw err;
        }
      }).catch(function(jsonErr) {
        if (!r.ok) {
          var err = new Error('HTTP ' + r.status);
          err.status = r.status;
          throw err;
        }
        throw jsonErr;
      });
    }).catch(function(err) {
      if (window.BSRetryQueue) {
        if (typeof window.BSRetryQueue.handleSendFailure === 'function') {
          window.BSRetryQueue.handleSendFailure(_gasUrl, payload, err);
        } else {
          window.BSRetryQueue.enqueue(_gasUrl, payload);
        }
      }
    });
  }

  /**
   * Kirim dwell_update via sendBeacon (fire-and-forget saat tab ditutup).
   */
  function sendDwellBeacon() {
    if (!_gasUrl || !_visitSent) return;
    var payload = {
      action:      'log_event',
      event_id:    window.BSFingerprint ? window.BSFingerprint.uuid4() : ('ev_' + Date.now()),
      session_id:  getSessionId(),
      device_id:   _deviceId || '',
      event:       'dwell_update',
      source:      _source || 'general',
      source_type: _sourceType || 'general',
      ts_client:   new Date().toISOString(),
      dwell_ms:    getCurrentDwell(),
      interactions:_interactions,
      scroll_max:  _scrollMax,
      hp:          (window._bsHpValue || (document.getElementById('bs-hp-website') ? document.getElementById('bs-hp-website').value : '') || '').substring(0, 100),
      extra:       {}
    };
    try {
      navigator.sendBeacon(_gasUrl, JSON.stringify(payload));
    } catch(e) {
      // sendBeacon tidak tersedia — coba fetch sync-ish
      if (window.BSRetryQueue) window.BSRetryQueue.enqueue(_gasUrl, payload);
    }
  }

  /** Hitung dwell aktual termasuk segmen yang sedang berjalan */
  function getCurrentDwell() {
    if (_dwellStart > 0) {
      return _dwellAccum + (Date.now() - _dwellStart);
    }
    return _dwellAccum;
  }

  /** Mulai/lanjut akumulasi dwell */
  function startDwellTimer() {
    if (_dwellStart === 0) _dwellStart = Date.now();
  }

  /** Jeda akumulasi dwell (saat halaman tidak visible) */
  function pauseDwellTimer() {
    if (_dwellStart > 0) {
      _dwellAccum += Date.now() - _dwellStart;
      _dwellStart  = 0;
    }
  }

  // ── Scroll tracking ───────────────────────────────────────
  function trackScroll() {
    var el   = document.documentElement;
    var pct  = Math.round((el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)) * 100);
    if (pct > _scrollMax) _scrollMax = pct;
  }

  // ── Interaction counter ───────────────────────────────────
  function trackInteraction() {
    _interactions++;
  }

  /**
   * Inisialisasi tracker.
   * @param {object} opts
   * @param {string} opts.gasUrl
   */
  function init(opts) {
    opts     = opts || {};
    _gasUrl  = opts.gasUrl || (window.BSConfig ? window.BSConfig.getGasUrl() : '');
    _deviceId= window.BSFingerprint ? window.BSFingerprint.getOrCreateDeviceId() : '';
    _fp      = window.BSFingerprint ? window.BSFingerprint.generateFingerprint() : '';

    resolveSource();

    // Cek apakah visit sudah terkirim dalam sesi ini (deduplikasi)
    _visitSent = sessionStorage.getItem(VISIT_SENT_KEY) === '1';

    // Mulai dwell timer
    startDwellTimer();

    // PageVisibility API: pause/resume dwell saat tab hidden
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        pauseDwellTimer();
      } else {
        startDwellTimer();
      }
    });

    // Scroll tracking
    window.addEventListener('scroll', trackScroll, { passive: true });

    // Klik global sebagai sinyal interaksi
    document.addEventListener('click', trackInteraction);

    // Beacon saat halaman ditutup
    window.addEventListener('pagehide', sendDwellBeacon);
    // Fallback (tidak semua browser support pagehide)
    window.addEventListener('beforeunload', sendDwellBeacon);

    // Kirim visit event (deduplikasi: hanya sekali per sesi)
    if (!_visitSent && _gasUrl) {
      sessionStorage.setItem(VISIT_SENT_KEY, '1');
      _visitSent = true;
      var payload = buildPayload('visit');
      sendEvent(payload);
    }
  }

  /**
   * Track event kustom (klik tombol, dll.)
   * @param {string} eventName
   * @param {object} extra
   */
  function track(eventName, extra) {
    trackInteraction();
    var payload = buildPayload(eventName, extra);
    // Jika ada retry queue items, flush dulu
    if (window.BSRetryQueue) window.BSRetryQueue.scheduleFlush(0);
    sendEvent(payload);
  }

  /** Akses ke source aktif sesi */
  function getSource()     { return _source; }
  function getSourceType() { return _sourceType; }
  function getDeviceId()   { return _deviceId || ''; }

  // Ekspos ke global
  window.BSTracker = {
    init:          init,
    track:         track,
    getSource:     getSource,
    getSourceType: getSourceType,
    getSessionId:  getSessionId,
    getDeviceId:   getDeviceId,
    getCurrentDwell:getCurrentDwell
  };

})(window);
