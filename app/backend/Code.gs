/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v5.0
 * backend/Code.gs — Kode utama Google Apps Script
 *
 * Endpoint:
 *   GET  /exec?action=get_config            → Konfigurasi publik (tanpa token)
 *   POST /exec { action:"log_event", … }    → Ingest event tamu (publik)
 *   POST /exec { action:"save_all_admin_data", token, … } → Simpan config+sources (admin)
 *   POST /exec { action:"get_events_data",  token, … }    → Ambil data events (admin)
 *
 * Script Properties yang wajib diatur:
 *   READ_TOKEN  → Token rahasia; set via Apps Script → Project Settings → Script Properties
 *
 * Tab Google Sheets yang wajib ada (dibuat otomatis bila belum ada):
 *   Config, Sources, StaffDevices, Events_YYYY_MM, MonthlyAggregates, ScriptLog
 */

/* ══════════════════════════════════════════════════════════════
   HELPER: Spreadsheet & sheet
══════════════════════════════════════════════════════════════ */

function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Ambil (atau buat) tab bulanan Events_YYYY_MM berdasarkan zona waktu WIB.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateMonthlyEventsSheet() {
  var ss        = getSpreadsheet();
  var now       = new Date();
  var monthStr  = Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy_MM');
  var sheetName = 'Events_' + monthStr;
  var sheet     = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      'event_id', 'session_id', 'device_id', 'ts_server', 'ts_client',
      'event', 'source', 'source_type', 'ip', 'ua', 'screen',
      'dwell_ms', 'interactions', 'scroll_max', 'fp', 'bot_flag', 'extra_data'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#f0ece4');
    sheet.setFrozenRows(1);
    _log('INFO', 'getOrCreateMonthlyEventsSheet', 'Tab baru dibuat: ' + sheetName, '');
  }
  return sheet;
}

/**
 * Ambil (atau buat) tab generik dengan header baris pertama.
 * @param {string} name  Nama tab
 * @param {string[]} headers  Header kolom
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getOrCreateSheet(name, headers) {
  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
           .setFontWeight('bold')
           .setBackground('#f0ece4');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Logging ke tab ScriptLog
══════════════════════════════════════════════════════════════ */

/**
 * Catat satu baris log ke tab ScriptLog.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} action
 * @param {string} message
 * @param {string} ip
 */
function _log(level, action, message, ip) {
  try {
    var logSheet = getOrCreateSheet('ScriptLog', ['timestamp', 'level', 'action', 'message', 'ip']);
    logSheet.appendRow([new Date(), level, action, String(message).substring(0, 500), ip || '']);
  } catch (e) {
    // Jangan melempar error dari dalam log — silent fail
  }
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Rate limiting via CacheService
══════════════════════════════════════════════════════════════ */

/**
 * Cek rate limit untuk kunci tertentu.
 * Maks 60 request / menit per device_id / IP.
 * @param {string} key
 * @returns {boolean}  true jika masih dalam batas
 */
function _checkRateLimit(key) {
  var cache      = CacheService.getScriptCache();
  var rateKey    = 'rate_' + String(key).substring(0, 100);
  var count      = Number(cache.get(rateKey) || 0);
  if (count >= 60) return false;
  cache.put(rateKey, String(count + 1), 60); // TTL 60 detik
  return true;
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Verifikasi token admin
══════════════════════════════════════════════════════════════ */

function _verifyToken(token) {
  if (!token) return false;
  var expected = PropertiesService.getScriptProperties().getProperty('READ_TOKEN');
  return expected && token === expected;
}

/* ══════════════════════════════════════════════════════════════
   doGet — Endpoint publik GET
══════════════════════════════════════════════════════════════ */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'get_config';

    if (action === 'get_config') {
      return _handleGetConfig();
    }

    return _jsonOut({ ok: false, error: 'Aksi GET tidak dikenali: ' + action });
  } catch (err) {
    _log('ERROR', 'doGet', err.toString(), '');
    return _jsonOut({ ok: false, error: err.toString() });
  }
}

/**
 * Kembalikan seluruh konfigurasi publik + daftar sumber aktif.
 * Tidak memerlukan token.
 */
function _handleGetConfig() {
  var ss        = getSpreadsheet();
  var cfgSheet  = ss.getSheetByName('Config');
  var srcSheet  = ss.getSheetByName('Sources');
  var configObj = {};

  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var rows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      try { configObj[rows[i][0]] = JSON.parse(rows[i][1]); } catch (e) {}
    }
  }

  var activeSources = [];
  if (srcSheet && srcSheet.getLastRow() > 1) {
    var sRows = srcSheet.getRange(2, 1, srcSheet.getLastRow() - 1, 8).getValues();
    for (var j = 0; j < sRows.length; j++) {
      if (sRows[j][5] === true || sRows[j][5] === 'TRUE') {
        activeSources.push({
          code:   String(sRows[j][0]),
          name:   String(sRows[j][1]),
          type:   String(sRows[j][2]),
          outlet: String(sRows[j][3]),
          role:   String(sRows[j][4])
        });
      }
    }
  }

  return _jsonOut({
    ok:      true,
    version: Date.now(),
    config:  configObj,
    sources: activeSources
  });
}

/* ══════════════════════════════════════════════════════════════
   doPost — Endpoint utama POST
══════════════════════════════════════════════════════════════ */

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _jsonOut({ ok: false, error: 'Tidak ada data POST' });
    }

    var data   = JSON.parse(e.postData.contents);
    var action = data.action || 'log_event';
    var clientIp = (e && e.parameter && e.parameter.ip) ? e.parameter.ip : 'client-ip';

    /* ── 1. Ingest Event Publik ── */
    if (action === 'log_event') {
      return _handleLogEvent(data, clientIp);
    }

    /* ── 2. Endpoint Terproteksi Token ── */
    if (!_verifyToken(data.token)) {
      _log('WARN', 'doPost', 'Unauthorized — aksi: ' + action, clientIp);
      return _jsonOut({ ok: false, error: 'Unauthorized' });
    }

    if (action === 'save_all_admin_data') {
      return _handleSaveAllAdminData(data, clientIp);
    }

    if (action === 'get_events_data') {
      return _handleGetEventsData(data, clientIp);
    }

    _log('WARN', 'doPost', 'Aksi tidak dikenali: ' + action, clientIp);
    return _jsonOut({ ok: false, error: 'Aksi tidak dikenali: ' + action });

  } catch (err) {
    _log('ERROR', 'doPost', err.toString(), '');
    return _jsonOut({ ok: false, error: err.toString() });
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: log_event (publik)
══════════════════════════════════════════════════════════════ */

function _handleLogEvent(data, clientIp) {
  // Validasi field wajib
  var missing = ['action', 'event', 'device_id'].filter(function (f) { return !data[f]; });
  if (missing.length > 0) {
    return _jsonOut({ ok: false, error: 'Field wajib tidak ada: ' + missing.join(', ') });
  }

  // Rate limiting per device_id
  var rateKey = data.device_id || clientIp;
  if (!_checkRateLimit(rateKey)) {
    _log('WARN', 'log_event', 'Rate limit exceeded — device: ' + String(rateKey).substring(0, 30), clientIp);
    return _jsonOut({ ok: false, error: 'Rate limit exceeded' });
  }

  var sheet    = getOrCreateMonthlyEventsSheet();
  var tsServer = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  var botFlag  = (data.hp && String(data.hp).trim() !== '') ? true : false;

  // Rekonsiliasi dwell_update: cari baris sesi yang cocok dan perbarui kolom dwell
  if (data.event === 'dwell_update' && data.session_id) {
    var lastRow  = sheet.getLastRow();
    if (lastRow > 1) {
      var scanRows = Math.min(200, lastRow - 1);
      var range    = sheet.getRange(lastRow - scanRows + 1, 1, scanRows, 14);
      var values   = range.getValues();
      for (var i = values.length - 1; i >= 0; i--) {
        if (String(values[i][1]) === String(data.session_id)) {
          var targetRow = (lastRow - scanRows + 1) + i;
          sheet.getRange(targetRow, 12).setValue(Number(data.dwell_ms)    || 0);
          sheet.getRange(targetRow, 13).setValue(Number(data.interactions) || 0);
          sheet.getRange(targetRow, 14).setValue(Number(data.scroll_max)  || 0);
          return _jsonOut({ ok: true, action: 'reconciled', event_id: values[i][0] });
        }
      }
    }
    // Session tidak ditemukan dalam 200 baris terakhir — tulis sebagai baris baru
  }

  // Append baris event baru
  var eventId = data.event_id || Utilities.getUuid();
  var row = [
    eventId,
    data.session_id  || '',
    data.device_id   || '',
    tsServer,
    data.ts_client   || tsServer,
    data.event       || 'unknown',
    data.source      || 'general',
    data.source_type || 'general',
    clientIp,
    String(data.ua   || '').substring(0, 150),
    data.screen      || '',
    Number(data.dwell_ms)    || 0,
    Number(data.interactions)|| 0,
    Number(data.scroll_max)  || 0,
    data.fp          || '',
    botFlag,
    JSON.stringify(data.extra || {})
  ];
  sheet.appendRow(row);

  return _jsonOut({ ok: true, event_id: eventId });
}

/* ══════════════════════════════════════════════════════════════
   Handler: save_all_admin_data (token-protected)
══════════════════════════════════════════════════════════════ */

function _handleSaveAllAdminData(data, clientIp) {
  var ss = getSpreadsheet();

  /* ── Simpan tab Config ── */
  var cfgSheet = getOrCreateSheet('Config', ['key', 'value_json', 'updated_at']);
  if (data.config) {
    var cfgData = [
      ['general',            JSON.stringify(data.config.general          || {}), new Date()],
      ['appearance',         JSON.stringify(data.config.appearance        || {}), new Date()],
      ['guest_sections',     JSON.stringify(data.config.guest_sections    || {}), new Date()],
      ['review_settings',    JSON.stringify(data.config.review_settings   || {}), new Date()],
      ['whatsapp_settings',  JSON.stringify(data.config.whatsapp_settings || {}), new Date()],
      ['promotions',         JSON.stringify(data.config.promotions        || []), new Date()],
      ['outlets',            JSON.stringify(data.config.outlets           || []), new Date()],
      ['fraud_thresholds',   JSON.stringify(data.fraud_settings           || {}), new Date()]
    ];
    // Bersihkan baris lama (kecuali header) dan tulis ulang
    var lastCfg = cfgSheet.getLastRow();
    if (lastCfg > 1) cfgSheet.getRange(2, 1, lastCfg - 1, 3).clearContent();
    cfgSheet.getRange(2, 1, cfgData.length, 3).setValues(cfgData);
  }

  /* ── Simpan tab Sources ── */
  var srcSheet = getOrCreateSheet('Sources', [
    'code', 'name', 'type', 'outlet', 'role', 'active', 'kartu_diprogram', 'legacy_codes', 'created_at', 'updated_at'
  ]);
  if (Array.isArray(data.sources)) {
    var lastSrc = srcSheet.getLastRow();
    if (lastSrc > 1) srcSheet.getRange(2, 1, lastSrc - 1, 10).clearContent();
    if (data.sources.length > 0) {
      var srcRows = data.sources.map(function (s) {
        return [
          s.code,
          s.name,
          s.type,
          s.outlet       || '',
          s.role         || '',
          s.active !== false,
          !!s.kartu_diprogram,
          JSON.stringify(s.legacy_codes || []),
          s.created_at   || new Date(),
          new Date()
        ];
      });
      srcSheet.getRange(2, 1, srcRows.length, 10).setValues(srcRows);
    }
  }

  /* ── Simpan tab StaffDevices ── */
  var devSheet = getOrCreateSheet('StaffDevices', ['device_id', 'staff_code', 'label', 'registered_at']);
  if (Array.isArray(data.staff_devices)) {
    var lastDev = devSheet.getLastRow();
    if (lastDev > 1) devSheet.getRange(2, 1, lastDev - 1, 4).clearContent();
    if (data.staff_devices.length > 0) {
      var devRows = data.staff_devices.map(function (d) {
        return [d.device_id, d.staff_code, d.label || '', d.registered_at || new Date()];
      });
      devSheet.getRange(2, 1, devRows.length, 4).setValues(devRows);
    }
  }

  _log('INFO', 'save_all_admin_data', 'Data admin disimpan. Sources: ' + (data.sources || []).length, clientIp);
  return _jsonOut({ ok: true, updated_at: new Date().toISOString() });
}

/* ══════════════════════════════════════════════════════════════
   Handler: get_events_data (token-protected)
══════════════════════════════════════════════════════════════ */

function _handleGetEventsData(data, clientIp) {
  var ss          = getSpreadsheet();
  var targetMonth = data.month || ('Events_' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy_MM'));
  var evSheet     = ss.getSheetByName(targetMonth);
  var eventsList  = [];
  var limit       = Math.min(Number(data.limit) || 10000, 50000);

  if (evSheet && evSheet.getLastRow() > 1) {
    var totalRows = evSheet.getLastRow() - 1;
    var readRows  = Math.min(totalRows, limit);
    // Baca dari baris terbaru ke belakang (offset dari bawah)
    var startRow  = totalRows - readRows + 2; // +2 karena header di baris 1
    var rawRows   = evSheet.getRange(startRow, 1, readRows, 17).getValues();
    eventsList = rawRows.map(function (r) {
      return {
        event_id:    r[0],  session_id: r[1],  device_id:   r[2],
        ts_server:   r[3],  ts_client:  r[4],  event:       r[5],
        source:      r[6],  source_type:r[7],  ip:          r[8],
        ua:          r[9],  screen:     r[10], dwell_ms:    r[11],
        interactions:r[12], scroll_max: r[13], fp:          r[14],
        bot_flag:    r[15], extra_data: r[16]
      };
    });
  }

  // Daftar seluruh tab Events_*
  var allSheets   = ss.getSheets();
  var archiveTabs = [];
  for (var s = 0; s < allSheets.length; s++) {
    if (allSheets[s].getName().indexOf('Events_') === 0) {
      archiveTabs.push(allSheets[s].getName());
    }
  }

  // Ambil staff_devices untuk anti-fraud self-tap
  var staffDevices = [];
  var devSheet     = ss.getSheetByName('StaffDevices');
  if (devSheet && devSheet.getLastRow() > 1) {
    var dRows = devSheet.getRange(2, 1, devSheet.getLastRow() - 1, 3).getValues();
    staffDevices = dRows.map(function (r) {
      return { device_id: r[0], staff_code: r[1], label: r[2] };
    });
  }

  _log('INFO', 'get_events_data', 'Kirim ' + eventsList.length + ' events dari ' + targetMonth, clientIp);
  return _jsonOut({
    ok:            true,
    month:         targetMonth,
    events:        eventsList,
    staff_devices: staffDevices,
    archive_tabs:  archiveTabs,
    total:         eventsList.length
  });
}

/* ══════════════════════════════════════════════════════════════
   Utility: JSON output dengan CORS headers yang benar
══════════════════════════════════════════════════════════════ */

function _jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
