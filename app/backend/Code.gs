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
   HELPER: Enkripsi & Manajemen Pengguna (Tab Users)
══════════════════════════════════════════════════════════════ */

/**
 * Buat string acak hexadecimal sepanjang len karakter.
 * @param {number} len
 * @returns {string}
 */
function _generateRandomHex(len) {
  var chars = '0123456789abcdef';
  var res = '';
  for (var i = 0; i < len; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

/**
 * Hitung hash SHA-256 dari (salt + password) dalam format hex lowercase.
 * @param {string} salt
 * @param {string} password
 * @returns {string}
 */
function _hashPassword(salt, password) {
  var raw = String(salt) + String(password);
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < digest.length; i++) {
    var b = digest[i];
    if (b < 0) b += 256;
    var s = b.toString(16);
    if (s.length === 1) hex += '0';
    hex += s;
  }
  return hex;
}

/**
 * Dapatkan atau buat tab Users.
 * Jika kosong, lakukan auto-seed user 'widi' dengan password '946217' dan must_change=TRUE.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function _getOrCreateUsersSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var headers = ['username', 'password_hash', 'salt', 'must_change', 'created_at', 'updated_at'];
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#f0ece4');
    sheet.setFrozenRows(1);
    _seedDefaultUser(sheet);
  } else if (sheet.getLastRow() <= 1) {
    _seedDefaultUser(sheet);
  }
  return sheet;
}

/**
 * Seed pengguna default widi / 946217 ke tab Users.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 */
function _seedDefaultUser(sheet) {
  var salt = _generateRandomHex(16);
  var hash = _hashPassword(salt, '946217');
  var now = new Date();
  sheet.appendRow(['widi', hash, salt, true, now, now]);
  _log('INFO', 'seed_user', 'Auto-seed pengguna default: widi (must_change=TRUE)', '');
}

/**
 * Cari pengguna berdasarkan username (case-insensitive).
 * @param {string} username
 * @returns {object|null}
 */
function _findUser(username) {
  var sheet = _getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var rows = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var target = String(username).toLowerCase().trim();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]).toLowerCase().trim() === target) {
      return {
        rowIndex: i + 2,
        username: String(rows[i][0]),
        password_hash: String(rows[i][1]),
        salt: String(rows[i][2]),
        must_change: rows[i][3] === true || rows[i][3] === 'TRUE',
        created_at: rows[i][4],
        updated_at: rows[i][5]
      };
    }
  }
  return null;
}

/**
 * Verifikasi sesi admin via CacheService (key: sess_<token> -> username).
 * Bila must_change=TRUE dan !allowMustChange, akses ditolak sampai ganti password.
 * Fallback darurat: bila tab Users kosong dan token == READ_TOKEN di Script Properties.
 * @param {string} token
 * @param {boolean} [allowMustChange=false]
 * @returns {{valid:boolean, username?:string, must_change?:boolean, error?:string}}
 */
function _verifySession(token, allowMustChange) {
  if (!token) return { valid: false, error: 'Token sesi diperlukan' };

  var cache = CacheService.getScriptCache();
  var username = cache.get('sess_' + token);

  if (!username) {
    // Fallback darurat bila tab Users belum ada/kosong
    var ss = getSpreadsheet();
    var uSheet = ss.getSheetByName('Users');
    var usersEmpty = !uSheet || uSheet.getLastRow() <= 1;
    var emergencyToken = PropertiesService.getScriptProperties().getProperty('READ_TOKEN');
    if (emergencyToken && token === emergencyToken && usersEmpty) {
      return { valid: true, username: 'emergency_admin', must_change: false };
    }
    return { valid: false, error: 'Unauthorized: Sesi kedaluwarsa atau tidak valid' };
  }

  var user = _findUser(username);
  if (!user) {
    return { valid: false, error: 'Pengguna sesi tidak ditemukan' };
  }

  if (user.must_change && !allowMustChange) {
    return {
      valid: false,
      must_change: true,
      error: 'Wajib mengganti kata sandi terlebih dahulu sebelum mengakses fitur ini'
    };
  }

  return { valid: true, username: user.username, must_change: user.must_change };
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
 * Kembalikan seluruh konfigurasi publik + daftar sumber.
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
    var maxCol = Math.max(srcSheet.getLastColumn(), 11);
    var sRows = srcSheet.getRange(2, 1, srcSheet.getLastRow() - 1, maxCol).getValues();
    for (var j = 0; j < sRows.length; j++) {
      activeSources.push({
        code:            String(sRows[j][0] || ''),
        name:            String(sRows[j][1] || ''),
        type:            String(sRows[j][2] || 'staff'),
        outlet:          String(sRows[j][3] || ''),
        role:            String(sRows[j][4] || ''),
        active:          sRows[j][5] === true || sRows[j][5] === 'TRUE',
        kartu_diprogram: sRows[j][6] === true || sRows[j][6] === 'TRUE',
        legacy_codes:    sRows[j][7] ? (function(){ try{ return JSON.parse(sRows[j][7]); }catch(e){ return []; } })() : [],
        whatsapp:        String(sRows[j][10] || '')
      });
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

    /* ── 1. Endpoint Publik ── */
    if (action === 'log_event') {
      return _handleLogEvent(data, clientIp);
    }

    if (action === 'login') {
      return _handleLogin(data, clientIp);
    }

    /* ── 2. Endpoint Ganti Password (khusus: allow must_change=true) ── */
    if (action === 'change_password') {
      return _handleChangePassword(data, clientIp);
    }

    /* ── 3. Endpoint Terproteksi Sesi Admin ── */
    var session = _verifySession(data.token, false);
    if (!session.valid) {
      _log('WARN', 'doPost', 'Unauthorized — aksi: ' + action + ' (' + (session.error || '') + ')', clientIp);
      return _jsonOut({ ok: false, error: session.error || 'Unauthorized', must_change: !!session.must_change });
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
   Handler: login (rate-limited maks 10x/menit per IP)
══════════════════════════════════════════════════════════════ */

function _handleLogin(data, clientIp) {
  var cache = CacheService.getScriptCache();
  var rateKey = 'login_rate_' + String(clientIp).substring(0, 50);
  var attempts = Number(cache.get(rateKey) || 0);
  if (attempts >= 10) {
    _log('WARN', 'login', 'Rate limit login terlampaui (' + attempts + 'x)', clientIp);
    return _jsonOut({ ok: false, error: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit.' });
  }
  cache.put(rateKey, String(attempts + 1), 60);

  var username = (data.username || '').toString().trim();
  var password = (data.password || '').toString();

  if (!username || !password) {
    return _jsonOut({ ok: false, error: 'Nama pengguna dan kata sandi wajib diisi.' });
  }

  var user = _findUser(username);
  if (!user) {
    _log('WARN', 'login', 'Pengguna tidak ditemukan: ' + username, clientIp);
    return _jsonOut({ ok: false, error: 'Nama pengguna atau kata sandi tidak valid.' });
  }

  var hash = _hashPassword(user.salt, password);
  if (hash !== user.password_hash) {
    _log('WARN', 'login', 'Kata sandi salah untuk: ' + username, clientIp);
    return _jsonOut({ ok: false, error: 'Nama pengguna atau kata sandi tidak valid.' });
  }

  // Generate session token 32 hex chars
  var token = _generateRandomHex(32);
  // Simpan di CacheService TTL 6 jam = 21600 detik (key: sess_<token> -> username)
  cache.put('sess_' + token, user.username, 21600);

  _log('INFO', 'login', 'Login sukses: ' + user.username + ' (must_change=' + user.must_change + ')', clientIp);

  return _jsonOut({
    ok: true,
    token: token,
    username: user.username,
    must_change: user.must_change,
    role: 'super_admin'
  });
}

/* ══════════════════════════════════════════════════════════════
   Handler: change_password (terproteksi sesi)
══════════════════════════════════════════════════════════════ */

function _handleChangePassword(data, clientIp) {
  var token = data.token;
  var session = _verifySession(token, true); // allowMustChange=true
  if (!session.valid) {
    return _jsonOut({ ok: false, error: session.error || 'Sesi tidak valid' });
  }

  var oldPassword = (data.old_password || '').toString();
  var newPassword = (data.new_password || '').toString();

  if (!oldPassword || !newPassword) {
    return _jsonOut({ ok: false, error: 'Kata sandi lama dan kata sandi baru wajib diisi.' });
  }

  if (newPassword.length < 6) {
    return _jsonOut({ ok: false, error: 'Kata sandi baru minimal 6 karakter.' });
  }

  var user = _findUser(session.username);
  if (!user) {
    return _jsonOut({ ok: false, error: 'Data pengguna tidak ditemukan.' });
  }

  var oldHash = _hashPassword(user.salt, oldPassword);
  if (oldHash !== user.password_hash) {
    _log('WARN', 'change_password', 'Kata sandi lama salah untuk: ' + user.username, clientIp);
    return _jsonOut({ ok: false, error: 'Kata sandi saat ini tidak cocok.' });
  }

  var newSalt = _generateRandomHex(16);
  var newHash = _hashPassword(newSalt, newPassword);
  var now = new Date();

  var sheet = _getOrCreateUsersSheet();
  // Kolom: 1:username, 2:password_hash, 3:salt, 4:must_change, 5:created_at, 6:updated_at
  sheet.getRange(user.rowIndex, 2).setValue(newHash);
  sheet.getRange(user.rowIndex, 3).setValue(newSalt);
  sheet.getRange(user.rowIndex, 4).setValue(false);
  sheet.getRange(user.rowIndex, 6).setValue(now);

  _log('INFO', 'change_password', 'Kata sandi berhasil diperbarui untuk: ' + user.username, clientIp);

  return _jsonOut({
    ok: true,
    message: 'Kata sandi berhasil diperbarui.'
  });
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
  if (data.config || data.fraud_settings) {
    var existingMap = {};
    if (cfgSheet.getLastRow() > 1) {
      var existingRows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
      for (var er = 0; er < existingRows.length; er++) {
        if (existingRows[er][0]) {
          existingMap[existingRows[er][0]] = existingRows[er][1];
        }
      }
    }
    var mergedConfig = data.config || {};
    var knownKeys = ['general', 'appearance', 'guest_sections', 'review_settings', 'whatsapp_settings', 'promotions', 'outlets', 'fraud_thresholds'];
    for (var k = 0; k < knownKeys.length; k++) {
      var key = knownKeys[k];
      if (key === 'fraud_thresholds' && data.fraud_settings) {
        existingMap['fraud_thresholds'] = JSON.stringify(data.fraud_settings);
      } else if (mergedConfig[key] !== undefined) {
        existingMap[key] = JSON.stringify(mergedConfig[key]);
      }
    }
    for (var ck in mergedConfig) {
      if (mergedConfig.hasOwnProperty(ck) && !existingMap[ck]) {
        existingMap[ck] = JSON.stringify(mergedConfig[ck]);
      }
    }
    var cfgRows = Object.keys(existingMap).map(function (k) {
      return [k, existingMap[k], new Date()];
    });
    if (cfgSheet.getLastRow() > 1) {
      cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 3).clearContent();
    }
    if (cfgRows.length > 0) {
      cfgSheet.getRange(2, 1, cfgRows.length, 3).setValues(cfgRows);
    }
  }

  /* ── Simpan tab Sources ── */
  var srcSheet = getOrCreateSheet('Sources', [
    'code', 'name', 'type', 'outlet', 'role', 'active', 'kartu_diprogram', 'legacy_codes', 'created_at', 'updated_at', 'whatsapp'
  ]);
  // Pastikan kolom ke-11 whatsapp memiliki header
  if (srcSheet.getLastColumn() < 11) {
    srcSheet.getRange(1, 11).setValue('whatsapp').setFontWeight('bold').setBackground('#f0ece4');
  }
  if (Array.isArray(data.sources)) {
    var lastSrc = srcSheet.getLastRow();
    if (lastSrc > 1) srcSheet.getRange(2, 1, lastSrc - 1, 11).clearContent();
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
          new Date(),
          s.whatsapp     || ''
        ];
      });
      srcSheet.getRange(2, 1, srcRows.length, 11).setValues(srcRows);
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
