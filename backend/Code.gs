/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0
 * backend/Code.gs — Kode utama Google Apps Script
 *
 * Endpoint:
 *   GET  /exec?action=get_config            → Konfigurasi publik allowlist & sumber aktif (tanpa token)
 *   POST /exec { action:"login", … }        → Login admin (terproteksi rate limit per user & global)
 *   POST /exec { action:"change_password" } → Perbarui kata sandi admin (terproteksi sesi)
 *   POST /exec { action:"get_admin_data" }  → Ambil full config, seluruh sumber, & staff devices (admin)
 *   POST /exec { action:"get_events_data" } → Ambil data events & full admin data (admin)
 *   POST /exec { action:"save_all_admin_data" } → Simpan config, sources, & staff devices (admin)
 *   POST /exec { action:"log_event", … }    → Ingest event tamu (idempotent via event_id, server timestamp)
 *
 * Script Properties yang dapat diatur di Apps Script Editor:
 *   EMAIL_MANAJEMEN  → Alamat email penerima laporan mingguan
 *
 * Tab Google Sheets:
 *   Users, Config, Sources, StaffDevices, Events_YYYY_MM, MonthlyAggregates, ScriptLog
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
 * @param {string} [ip]
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
   HELPER: Audit Trail ke tab AuditLog (SEC-11, SEC-12, SRC-09)
══════════════════════════════════════════════════════════════ */

var VALID_ROLES = ['super_admin', 'manager', 'content_editor', 'analyst_readonly'];

function _sanitizeRole(role) {
  var r = String(role || '').trim().toLowerCase();
  if (VALID_ROLES.indexOf(r) !== -1) return r;
  return 'super_admin';
}

/**
 * Catat satu baris ke tab AuditLog untuk setiap mutasi sensitif.
 * Format: timestamp, actor, role, action, target_object, status, details, ip
 * PENTING: Dilarang menyimpan password, hash mentah, atau token sesi di sini!
 *
 * @param {string} actor
 * @param {string} role
 * @param {string} action
 * @param {string} targetObject
 * @param {'SUCCESS'|'FAILED'|'REJECTED'} status
 * @param {string} details
 * @param {string} [ip]
 */
function _recordAudit(actor, role, action, targetObject, status, details, ip) {
  try {
    var auditSheet = getOrCreateSheet('AuditLog', [
      'timestamp', 'actor', 'role', 'action', 'target_object', 'status', 'details', 'ip'
    ]);
    var nowStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ssXXX");
    auditSheet.appendRow([
      nowStr,
      String(actor || 'system').substring(0, 50),
      String(role || 'unknown').substring(0, 30),
      String(action || '').substring(0, 50),
      String(targetObject || '').substring(0, 100),
      String(status || 'SUCCESS').substring(0, 20),
      String(details || '').substring(0, 500),
      String(ip || '').substring(0, 50)
    ]);
  } catch (e) {
    // Fail-safe jika gagal menulis audit, tetap catat ke ScriptLog
    _log('WARN', 'audit_write_failed', e.toString(), '');
  }
}


/* ══════════════════════════════════════════════════════════════
   HELPER: Rate limiting via CacheService
══════════════════════════════════════════════════════════════ */

/**
 * Cek rate limit untuk kunci tertentu di CacheService.
 * @param {string} key
 * @param {number} [limit=60]
 * @param {number} [windowSec=60]
 * @returns {boolean}  true jika masih dalam batas
 */
function _checkRateLimit(key, limit, windowSec) {
  var max        = limit || 60;
  var ttl        = windowSec || 60;
  var cache      = CacheService.getScriptCache();
  var rateKey    = 'rate_' + String(key).substring(0, 100);
  var count      = Number(cache.get(rateKey) || 0);
  if (count >= max) return false;
  cache.put(rateKey, String(count + 1), ttl);
  return true;
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Enkripsi & Manajemen Pengguna (Tab Users)
   SEC-02, SEC-03, SEC-04
══════════════════════════════════════════════════════════════ */

/**
 * Buat string acak hexadecimal yang aman secara kriptografis sepanjang len karakter.
 * Menggunakan Utilities.getUuid() yang bersumber dari SecureRandom bawaan runtime Java Apps Script.
 * Menggantikan Math.random() yang tidak aman secara kriptografis (SEC-03).
 *
 * @param {number} len
 * @returns {string}
 */
function _generateSecureRandomHex(len) {
  var hex = '';
  while (hex.length < len) {
    var raw = Utilities.getUuid() + '-' + new Date().getTime() + '-' + Utilities.getUuid();
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
    for (var i = 0; i < digest.length && hex.length < len; i++) {
      var b = digest[i];
      if (b < 0) b += 256;
      var s = b.toString(16);
      if (s.length === 1) hex += '0';
      hex += s;
    }
  }
  return hex.substring(0, len);
}

/**
 * Hitung hash password menggunakan salted iterative SHA-256 (key stretching).
 *
 * Catatan Batasan Platform Google Apps Script (SEC-04):
 * Runtime GAS V8 tidak menyediakan modul native C-bindings seperti argon2 atau bcrypt,
 * dan WebCrypto API (crypto.subtle) tidak diekspos di lingkungan server Apps Script.
 * Untuk memitigasi risiko serangan offline dictionary & brute-force tanpa melebihi kuota waktu
 * eksekusi maksimum GAS (6 menit per trigger, timeout HTTP Web App ~30 detik),
 * diterapkan penguatan berupa 1.000 iterasi digest SHA-256 ber-salt acak unik 16-hex per akun.
 * Format tersimpan: pbkdf2_sha256$1000$<digest_hex>
 *
 * @param {string} salt
 * @param {string} password
 * @returns {string}
 */
function _hashPassword(salt, password) {
  var rounds = 1000;
  var current = String(salt) + ':' + String(password);
  for (var i = 0; i < rounds; i++) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, current, Utilities.Charset.UTF_8);
    var hex = '';
    for (var j = 0; j < digest.length; j++) {
      var b = digest[j];
      if (b < 0) b += 256;
      var s = b.toString(16);
      if (s.length === 1) hex += '0';
      hex += s;
    }
    current = hex + ':' + salt;
  }
  return 'pbkdf2_sha256$' + rounds + '$' + hex;
}

/**
 * Verifikasi kecocokan password terhadap hash yang tersimpan.
 * Mendukung format PBKDF2-stretched dan format legacy single SHA-256 (backward compatibility).
 *
 * @param {string} salt
 * @param {string} password
 * @param {string} storedHash
 * @returns {boolean}
 */
function _verifyPassword(salt, password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.indexOf('pbkdf2_sha256$') === 0) {
    return _hashPassword(salt, password) === storedHash;
  }
  // Verifikasi fallback untuk hash warisan single sha256 jika ada akun lama
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
  return hex === storedHash;
}

/**
 * Dapatkan atau buat tab Users.
 * PENTING (SEC-02, SEC-11): Tab Users mencakup kolom role (super_admin, manager, content_editor, analyst_readonly).
 * Akun admin pertama kali diinisialisasi melalui fungsi setupInitialAdmin()
 * yang dijalankan manual di Apps Script Editor oleh pemilik spreadsheet.
 *
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function _getOrCreateUsersSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Users');
  var headers = ['username', 'password_hash', 'salt', 'must_change', 'created_at', 'updated_at', 'role'];
  if (!sheet) {
    sheet = ss.insertSheet('Users');
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#f0ece4');
    sheet.setFrozenRows(1);
    _log('INFO', 'create_sheet', 'Tab Users dibuat dengan kolom role (SEC-02, SEC-11)', '');
  } else if (sheet.getLastColumn() < 7) {
    sheet.getRange(1, 7).setValue('role').setFontWeight('bold').setBackground('#f0ece4');
  }
  return sheet;
}

/**
 * Inisialisasi akun admin pertama kali (dijalankan MANUAL oleh pemilik di Apps Script Editor).
 * Contoh pemanggilan di Apps Script:
 *   setupInitialAdmin('admin_bumi', 'KataSandiKuat2026!#', 'super_admin');
 *
 * @param {string} username
 * @param {string} password
 * @param {'super_admin'|'manager'|'content_editor'|'analyst_readonly'} [role='super_admin']
 */
function setupInitialAdmin(username, password, role) {
  var u = String(username || '').trim().toLowerCase();
  var p = String(password || '').trim();
  var r = _sanitizeRole(role || 'super_admin');
  if (!u || !p || p.length < 8) {
    throw new Error('Username wajib diisi dan password minimal 8 karakter.');
  }
  var sheet = _getOrCreateUsersSheet();
  var existing = _findUser(u);
  var salt = _generateSecureRandomHex(16);
  var hash = _hashPassword(salt, p);
  var now = new Date();

  if (existing) {
    sheet.getRange(existing.rowIndex, 2).setValue(hash);
    sheet.getRange(existing.rowIndex, 3).setValue(salt);
    sheet.getRange(existing.rowIndex, 4).setValue(false);
    sheet.getRange(existing.rowIndex, 6).setValue(now);
    sheet.getRange(existing.rowIndex, 7).setValue(r);
    Logger.log('Admin ' + u + ' (role: ' + r + ') berhasil diperbarui.');
    _recordAudit('system', 'super_admin', 'SETUP_ADMIN', 'user:' + u, 'SUCCESS', 'Admin diinisialisasi/diperbarui dengan role: ' + r, '');
  } else {
    sheet.appendRow([u, hash, salt, false, now, now, r]);
    Logger.log('Admin baru ' + u + ' (role: ' + r + ') berhasil dibuat.');
    _recordAudit('system', 'super_admin', 'CREATE_ADMIN', 'user:' + u, 'SUCCESS', 'Admin baru dibuat dengan role: ' + r, '');
  }
}

/**
 * Buat atau perbarui akun pengguna operasional dengan peran tertentu (SEC-11).
 * Dijalankan di Apps Script Editor oleh super_admin.
 * Akun diset must_change=true agar user wajib mengganti password saat login pertama.
 *
 * @param {string} username
 * @param {string} password
 * @param {'super_admin'|'manager'|'content_editor'|'analyst_readonly'} role
 */
function setupUser(username, password, role) {
  var u = String(username || '').trim().toLowerCase();
  var p = String(password || '').trim();
  var r = _sanitizeRole(role);
  if (!u || !p || p.length < 8) {
    throw new Error('Username wajib diisi dan password minimal 8 karakter.');
  }
  var sheet = _getOrCreateUsersSheet();
  var existing = _findUser(u);
  var salt = _generateSecureRandomHex(16);
  var hash = _hashPassword(salt, p);
  var now = new Date();

  if (existing) {
    sheet.getRange(existing.rowIndex, 2).setValue(hash);
    sheet.getRange(existing.rowIndex, 3).setValue(salt);
    sheet.getRange(existing.rowIndex, 4).setValue(true);
    sheet.getRange(existing.rowIndex, 6).setValue(now);
    sheet.getRange(existing.rowIndex, 7).setValue(r);
    _recordAudit('system', 'super_admin', 'UPDATE_USER', 'user:' + u, 'SUCCESS', 'Pengguna ' + u + ' diperbarui ke role ' + r + ' (must_change=true)', '');
    Logger.log('Pengguna ' + u + ' (' + r + ') diperbarui.');
  } else {
    sheet.appendRow([u, hash, salt, true, now, now, r]);
    _recordAudit('system', 'super_admin', 'CREATE_USER', 'user:' + u, 'SUCCESS', 'Pengguna baru ' + u + ' dibuat dengan role ' + r + ' (must_change=true)', '');
    Logger.log('Pengguna baru ' + u + ' (' + r + ') dibuat.');
  }
}

/**
 * Prosedur Pemulihan Darurat (Break-Glass Recovery) (SEC-12).
 * Dijalankan MANUAL di Apps Script Editor saat akun admin terkunci total.
 * - TIDAK mengembalikan password publik atau token statis.
 * - Menghasilkan kata sandi baru dengan salt unik & 1.000 iterasi SHA-256.
 * - Mewajibkan penggantian kata sandi pada login pertama (must_change = true).
 * - Mencatat jejak audit lengkap ke tab AuditLog.
 *
 * @param {string} targetUsername - username admin (default 'admin')
 * @param {string} temporaryPassword - password sementara baru (minimal 10 karakter)
 */
function breakGlassRecovery(targetUsername, temporaryPassword) {
  var u = String(targetUsername || 'admin').trim().toLowerCase();
  var p = String(temporaryPassword || '').trim();
  if (!p || p.length < 10) {
    throw new Error('Password sementara break-glass wajib diisi dan minimal 10 karakter.');
  }
  var sheet = _getOrCreateUsersSheet();
  var existing = _findUser(u);
  var salt = _generateSecureRandomHex(16);
  var hash = _hashPassword(salt, p);
  var now = new Date();

  if (existing) {
    sheet.getRange(existing.rowIndex, 2).setValue(hash);
    sheet.getRange(existing.rowIndex, 3).setValue(salt);
    sheet.getRange(existing.rowIndex, 4).setValue(true);
    sheet.getRange(existing.rowIndex, 6).setValue(now);
    sheet.getRange(existing.rowIndex, 7).setValue('super_admin');
  } else {
    sheet.appendRow([u, hash, salt, true, now, now, 'super_admin']);
  }

  _recordAudit(
    'BREAK_GLASS_SYSTEM',
    'super_admin',
    'BREAK_GLASS_RESET',
    'user:' + u,
    'SUCCESS',
    'Break-glass recovery dieksekusi via Apps Script Editor. Akun diwajibkan ganti password.',
    ''
  );
  Logger.log('BREAK-GLASS SUKSES untuk akun: ' + u + '. Akun wajib ganti password pada login pertama.');
}

/**
 * Cari pengguna berdasarkan username (case-insensitive).
 * Membaca hingga kolom ke-7 (role) dengan fallback ke 'super_admin'.
 * @param {string} username
 * @returns {object|null}
 */
function _findUser(username) {
  var sheet = _getOrCreateUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return null;
  var maxCol = Math.max(sheet.getLastColumn(), 7);
  var rows = sheet.getRange(2, 1, lastRow - 1, maxCol).getValues();
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
        updated_at: rows[i][5],
        role: _sanitizeRole(rows[i][6])
      };
    }
  }
  return null;
}

/**
 * Verifikasi sesi admin via CacheService (key: sess_<token> -> JSON {username, role} atau string username).
 * Bila must_change=TRUE dan !allowMustChange, akses ditolak sampai ganti password.
 * PENTING (SEC-01, SEC-07, SEC-11): Izin diverifikasi di level backend per request.
 *
 * @param {string} token
 * @param {boolean} [allowMustChange=false]
 * @returns {{valid:boolean, username?:string, role?:string, must_change?:boolean, error?:string}}
 */
function _verifySession(token, allowMustChange) {
  if (!token) return { valid: false, error: 'Token sesi diperlukan' };

  var cache = CacheService.getScriptCache();
  var cachedRaw = cache.get('sess_' + token);

  if (!cachedRaw) {
    return { valid: false, error: 'Unauthorized: Sesi kedaluwarsa atau tidak valid' };
  }

  var sessionUser = '';
  var sessionRole = 'super_admin';
  try {
    var parsed = JSON.parse(cachedRaw);
    if (parsed && parsed.username) {
      sessionUser = parsed.username;
      sessionRole = _sanitizeRole(parsed.role);
    } else {
      sessionUser = String(cachedRaw);
    }
  } catch (_) {
    sessionUser = String(cachedRaw);
  }

  var user = _findUser(sessionUser);
  if (!user) {
    return { valid: false, error: 'Pengguna sesi tidak ditemukan' };
  }

  // Gunakan role terkini dari database lembar Users
  var currentRole = user.role || sessionRole;

  if (user.must_change && !allowMustChange) {
    return {
      valid: false,
      username: user.username,
      role: currentRole,
      must_change: true,
      error: 'Wajib mengganti kata sandi terlebih dahulu sebelum mengakses fitur ini'
    };
  }

  return {
    valid: true,
    username: user.username,
    role: currentRole,
    must_change: user.must_change
  };
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
 * Kembalikan konfigurasi publik (allowlist) + daftar sumber yang AKTIF saja.
 * Sesuai SEC-01, SEC-08, API-04:
 * - Hanya field publik allowlist yang dikembalikan.
 * - Tab Config sensitif seperti fraud_thresholds, user, session TIDAK dibocorkan.
 * - Hanya sources yang berstatus active === true yang dikembalikan.
 * - Field internal/kartu/legacy_codes tidak dikirim ke publik.
 */
function _handleGetConfig() {
  var ss        = getSpreadsheet();
  var cfgSheet  = ss.getSheetByName('Config');
  var srcSheet  = ss.getSheetByName('Sources');
  var rawConfig = {};

  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var rows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      try { rawConfig[rows[i][0]] = JSON.parse(rows[i][1]); } catch (e) {}
    }
  }

  // Allowlist sections & fields publik (API-04, SEC-08, FR-CMS-01 s/d FR-CMS-07)
  var publicConfig = {
    general: {
      hotel_name:        (rawConfig.general && rawConfig.general.hotel_name) || 'Bumi Surabaya City Resort',
      description:       (rawConfig.general && rawConfig.general.description) || '',
      address:           (rawConfig.general && rawConfig.general.address) || '',
      phone:             (rawConfig.general && rawConfig.general.phone) || '',
      whatsapp:          (rawConfig.general && rawConfig.general.whatsapp) || '628113388523',
      google_review_url: (rawConfig.general && rawConfig.general.google_review_url) || '',
      instagram:         (rawConfig.general && rawConfig.general.instagram) || '',
      facebook:          (rawConfig.general && rawConfig.general.facebook) || '',
      tiktok:            (rawConfig.general && rawConfig.general.tiktok) || '',
      youtube:           (rawConfig.general && rawConfig.general.youtube) || '',
      website:           (rawConfig.general && rawConfig.general.website) || '',
      logo_url:          (rawConfig.general && rawConfig.general.logo_url) || ''
    },
    appearance: {
      accent_color:        (rawConfig.appearance && rawConfig.appearance.accent_color) || '#c9a96e',
      hero_text:           (rawConfig.appearance && rawConfig.appearance.hero_text) || '',
      hero_subtitle:       (rawConfig.appearance && rawConfig.appearance.hero_subtitle) || '',
      welcome_msg_staff:   (rawConfig.appearance && rawConfig.appearance.welcome_msg_staff) || '',
      welcome_msg_sales:   (rawConfig.appearance && rawConfig.appearance.welcome_msg_sales) || '',
      welcome_msg_outlet:  (rawConfig.appearance && rawConfig.appearance.welcome_msg_outlet) || '',
      welcome_msg_nfc:     (rawConfig.appearance && rawConfig.appearance.welcome_msg_nfc) || '',
      welcome_msg_general: (rawConfig.appearance && rawConfig.appearance.welcome_msg_general) || '',
      hero_bg_url:         (rawConfig.appearance && rawConfig.appearance.hero_bg_url) || ''
    },
    guest_sections: rawConfig.guest_sections || {
      show_review: true, show_direct_feedback: true, show_wa: true, show_promotions: true,
      show_outlets: true, show_social: true, show_final_cta: true, show_mobile_bar: true
    },
    review_settings: rawConfig.review_settings || {
      review_url: 'https://search.google.com/local/writereview?placeid=ChIJl9S7eN771y0Rpp7V9x6GXoU',
      button_text: 'Share Your Experience',
      review_prompt: ''
    },
    whatsapp_settings: rawConfig.whatsapp_settings || {
      number: '628113388523', template_staff: '', template_general: ''
    },
    guest_content: (rawConfig.guest_content && typeof rawConfig.guest_content === 'object') ? rawConfig.guest_content : {},
    promotions: Array.isArray(rawConfig.promotions) ? rawConfig.promotions.filter(function(p) {
      if (!p || p.active === false) return false;
      // Filter periode tanggal Asia/Jakarta (CNT-03, GUE-08)
      var nowWib = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss");
      var todayWib = nowWib.substring(0, 10);
      if (p.starts_at && String(p.starts_at) > todayWib && String(p.starts_at) > nowWib) return false;
      if (p.ends_at && (String(p.ends_at) < todayWib || (p.ends_at.length > 10 && String(p.ends_at) < nowWib))) return false;
      return true;
    }).map(function(p) {
      return {
        id:          String(p.id || ''),
        name:        String(p.name || ''),
        outlet:      String(p.outlet || ''),
        description: String(p.description || ''),
        price:       String(p.price || ''),
        period:      String(p.period || ''),
        emoji:       String(p.emoji || '🍽️'),
        image_url:   String(p.image_url || ''),
        starts_at:   String(p.starts_at || ''),
        ends_at:     String(p.ends_at || ''),
        cta_label:   String(p.cta_label || ''),
        cta_url:     String(p.cta_url || ''),
        active:      true
      };
    }) : [],
    outlets: Array.isArray(rawConfig.outlets) ? rawConfig.outlets.filter(function(o) {
      return o && o.active !== false;
    }).map(function(o) {
      return {
        id:              String(o.id || ''),
        name:            String(o.name || ''),
        type:            String(o.type || ''),
        description:     String(o.description || ''),
        hours:           String(o.hours || ''),
        emoji:           String(o.emoji || '🍽️'),
        highlight:       String(o.highlight || ''),
        image_url:       String(o.image_url || ''),
        whatsapp:        String(o.whatsapp || ''),
        reservation_url: String(o.reservation_url || ''),
        review_url:      String(o.review_url || ''),
        active:          true
      };
    }) : []
  };

  // Hanya sumber AKTIF dengan field publik + masa tenggang migrasi jika aktif (API-04, SRC-02, FR-P0-05)
  var activeSources = [];
  if (srcSheet && srcSheet.getLastRow() > 1) {
    var maxCol = Math.max(srcSheet.getLastColumn(), 17);
    var sRows = srcSheet.getRange(2, 1, srcSheet.getLastRow() - 1, maxCol).getValues();
    for (var j = 0; j < sRows.length; j++) {
      var isActive = sRows[j][5] === true || sRows[j][5] === 'TRUE';
      if (!isActive) continue;
      var sType = String(sRows[j][2] || 'staff');
      var migMode = sRows[j][12] === true || sRows[j][12] === 'TRUE';
      var migUntil = String(sRows[j][13] || '');
      var pubSrc = {
        code:             String(sRows[j][0] || ''),
        name:             String(sRows[j][1] || ''),
        type:             sType,
        outlet:           String(sRows[j][3] || ''),
        role:             String(sRows[j][4] || ''),
        active:           true,
        whatsapp:         sType === 'sales' ? String(sRows[j][10] || '') : '',
        service_hours:    sType === 'sales' ? String(sRows[j][15] || '') : '',
        welcome_template: sType === 'sales' ? String(sRows[j][16] || '') : ''
      };
      if (migMode && migUntil) {
        pubSrc.migration_mode  = true;
        pubSrc.migration_until = migUntil;
        pubSrc.legacy_codes    = sRows[j][7] ? (function(){ try{ return JSON.parse(sRows[j][7]); }catch(e){ return []; } })() : [];
      }
      activeSources.push(pubSrc);
    }
  }

  return _jsonOut({
    ok:      true,
    version: Date.now(),
    system_health: {
      backend_version: 'v6.3.0-phase3',
      server_time:     Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      timezone:        'Asia/Jakarta'
    },
    config:  publicConfig,
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

    /* ── 1. Endpoint Publik ── */
    if (action === 'log_event') {
      return _handleLogEvent(data);
    }

    if (action === 'submit_feedback') {
      return _handleSubmitFeedback(data);
    }

    if (action === 'login') {
      return _handleLogin(data);
    }

    /* ── 2. Endpoint Ganti Password (khusus: izinkan saat must_change=true) ── */
    if (action === 'change_password') {
      return _handleChangePassword(data);
    }

    /* ── 3. Endpoint Terproteksi Sesi Admin (SEC-01, SEC-11) ── */
    var session = _verifySession(data.token, false);
    if (!session.valid) {
      _log('WARN', 'doPost', 'Unauthorized — aksi: ' + action + ' (' + (session.error || '') + ')', '');
      return _jsonOut({ ok: false, error: session.error || 'Unauthorized', must_change: !!session.must_change });
    }

    if (action === 'get_admin_data') {
      return _handleGetAdminData(data, session);
    }

    if (action === 'save_all_admin_data') {
      return _handleSaveAllAdminData(data, session);
    }

    if (action === 'get_events_data') {
      return _handleGetEventsData(data, session);
    }

    if (action === 'get_audit_logs') {
      return _handleGetAuditLogs(data, session);
    }

    if (action === 'get_feedback_data') {
      return _handleGetFeedbackData(data, session);
    }

    if (action === 'mark_feedback_handled') {
      return _handleMarkFeedbackHandled(data, session);
    }

    _log('WARN', 'doPost', 'Aksi tidak dikenali: ' + action, '');
    return _jsonOut({ ok: false, error: 'Aksi tidak dikenali: ' + action });

  } catch (err) {
    _log('ERROR', 'doPost', err.toString(), '');
    return _jsonOut({ ok: false, error: err.toString() });
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: submit_feedback (publik, REV-02)
   - Validasi rating 1–5, pesan 1–500 karakter, sanitasi tag HTML
   - Rate limit 3 kiriman per device per 24 jam (anti-spam)
   - Honeypot anti-bot (pola sama dengan log_event)
   - Simpan ke tab Feedback (dibuat otomatis bila belum ada)
══════════════════════════════════════════════════════════════ */

function _stripFeedbackHtml(s) {
  return String(s == null ? '' : s).replace(/<[^>]*>/g, '');
}

function _handleSubmitFeedback(data) {
  if (!data) return _jsonOut({ ok: false, error: 'Data kosong' });

  var rating = parseInt(data.rating, 10);
  if (!(rating >= 1 && rating <= 5)) {
    return _jsonOut({ ok: false, error: 'Rating harus antara 1 dan 5' });
  }

  var message = _stripFeedbackHtml(data.message).trim();
  if (!message) {
    return _jsonOut({ ok: false, error: 'Pesan feedback wajib diisi' });
  }
  if (message.length > 500) {
    return _jsonOut({ ok: false, error: 'Pesan maksimal 500 karakter' });
  }

  var guestName = _stripFeedbackHtml(data.guest_name).trim().substring(0, 80);
  var guestWa   = String(data.guest_wa || '').replace(/[^0-9+]/g, '').substring(0, 20);

  var devId = String(data.device_id || '').trim().substring(0, 100);
  if (!devId) {
    return _jsonOut({ ok: false, error: 'device_id diperlukan' });
  }

  // Honeypot anti-bot (AF-06): field hp yang terisi = bot
  if (data.hp && String(data.hp).trim() !== '') {
    _log('WARN', 'submit_feedback', 'Honeypot terisi — kemungkinan bot, device: ' + devId.substring(0, 30), '');
    return _jsonOut({ ok: false, error: 'Pengiriman ditolak' });
  }

  // Anti-spam: maksimal 3 feedback per perangkat per 24 jam
  if (!_checkRateLimit('feedback_dev_' + devId, 3, 86400)) {
    _log('WARN', 'submit_feedback', 'Batas harian tercapai — device: ' + devId.substring(0, 30), '');
    return _jsonOut({ ok: false, error: 'Batas pengiriman harian tercapai. Coba lagi besok.' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var tsServer = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    var sheet = getOrCreateSheet('Feedback', [
      'timestamp', 'source', 'source_name', 'outlet',
      'guest_name', 'guest_wa', 'rating', 'message', 'status', 'device_hash'
    ]);

    var devHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, devId)
      .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); }).join('');

    sheet.appendRow([
      tsServer,
      String(data.source || 'general').substring(0, 60),
      _stripFeedbackHtml(data.source_name).substring(0, 80),
      _stripFeedbackHtml(data.outlet).substring(0, 80),
      guestName,
      guestWa,
      rating,
      message,
      'unread',
      devHash
    ]);

    return _jsonOut({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: get_feedback_data (terproteksi, REV-02)
   Hanya super_admin & manager (berisi data tamu/PII).
   Mendukung filter status/rating/outlet + paginasi sederhana.
══════════════════════════════════════════════════════════════ */

function _handleGetFeedbackData(data, session) {
  var role = session ? session.role : '';
  if (role !== 'super_admin' && role !== 'manager') {
    _recordAudit(session.username, role, 'FEEDBACK_DENIED', 'feedback', 'REJECTED',
      'Ditolak: role ' + role + ' tidak berhak membaca data feedback tamu', '');
    return _jsonOut({ ok: false, error: 'Akses ditolak: hanya Super Admin & Manager.' });
  }

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('Feedback');
  if (!sheet || sheet.getLastRow() < 2) {
    return _jsonOut({ ok: true, items: [], total: 0, unread: 0 });
  }

  var fStatus = String(data.status || '').trim();       // unread | handled | ''
  var fRating = parseInt(data.rating, 10) || 0;         // 1-5 | 0 = semua
  var fOutlet = String(data.outlet || '').trim();
  var limit   = Math.min(Math.max(parseInt(data.limit, 10) || 50, 1), 200);
  var offset  = Math.max(parseInt(data.offset, 10) || 0, 0);

  var lastRow = sheet.getLastRow();
  var rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();

  var items = [];
  var unread = 0;
  for (var i = rows.length - 1; i >= 0; i--) {   // terbaru dulu
    var r = rows[i];
    var st = String(r[8] || 'unread');
    if (st === 'unread') unread++;
    if (fStatus && st !== fStatus) continue;
    if (fRating && Number(r[6]) !== fRating) continue;
    if (fOutlet && String(r[3] || '') !== fOutlet) continue;
    items.push({
      row:       i + 2,
      timestamp: String(r[0] || ''),
      source:    String(r[1] || ''),
      source_name: String(r[2] || ''),
      outlet:    String(r[3] || ''),
      guest_name: String(r[4] || ''),
      guest_wa:  _maskWa(String(r[5] || '')),
      rating:    Number(r[6]) || 0,
      message:   String(r[7] || ''),
      status:    st
    });
  }

  return _jsonOut({ ok: true, items: items.slice(offset, offset + limit), total: items.length, unread: unread });
}

function _maskWa(wa) {
  if (!wa) return '';
  if (wa.length <= 4) return '****';
  return wa.substring(0, 4) + '****' + wa.substring(wa.length - 2);
}

/* ══════════════════════════════════════════════════════════════
   Handler: mark_feedback_handled (terproteksi, REV-02)
══════════════════════════════════════════════════════════════ */

function _handleMarkFeedbackHandled(data, session) {
  var role = session ? session.role : '';
  if (role !== 'super_admin' && role !== 'manager') {
    return _jsonOut({ ok: false, error: 'Akses ditolak: hanya Super Admin & Manager.' });
  }
  var row = parseInt(data.row, 10);
  if (!row || row < 2) return _jsonOut({ ok: false, error: 'Baris tidak valid' });

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Feedback');
    if (!sheet || row > sheet.getLastRow()) {
      return _jsonOut({ ok: false, error: 'Data tidak ditemukan' });
    }
    sheet.getRange(row, 9).setValue('handled');
    _recordAudit(session.username, role, 'FEEDBACK_HANDLED', 'feedback:row' + row, 'SUCCESS', '', '');
    return _jsonOut({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: login (SEC-04, SEC-05, SEC-06, SEC-11, SEC-12)
   - Rate limit per user dan global (TIDAK percaya IP klien)
   - Respon generik seragam tanpa bocor keberadaan akun
   - Sesi 6 jam (21600 detik) via CacheService
   - Catat audit trail login berhasil dan gagal
══════════════════════════════════════════════════════════════ */

function _handleLogin(data) {
  var username = (data.username || '').toString().trim().toLowerCase();
  var password = (data.password || '').toString();

  if (!username || !password) {
    return _jsonOut({ ok: false, error: 'Nama pengguna dan kata sandi wajib diisi.' });
  }

  // Rate limiting (SEC-05): Mengabaikan parameter IP klien
  var userRateKey = 'login_user_' + username;
  if (!_checkRateLimit(userRateKey, 5, 60)) {
    _log('WARN', 'login', 'Rate limit login terlampaui untuk user: ' + username, '');
    return _jsonOut({ ok: false, error: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit.' });
  }
  if (!_checkRateLimit('login_global', 25, 60)) {
    _log('WARN', 'login', 'Global rate limit login terlampaui', '');
    return _jsonOut({ ok: false, error: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit.' });
  }

  var user = _findUser(username);
  // SEC-04: Mitigasi timing attack & cegah username enumeration
  var saltToUse = user ? user.salt : 'dummy_salt_123456';
  var expectedHash = user ? user.password_hash : 'pbkdf2_sha256$1000$dummyhash';
  var isValid = _verifyPassword(saltToUse, password, expectedHash) && (user !== null);

  if (!isValid) {
    _log('WARN', 'login', 'Percobaan login gagal untuk: ' + username, '');
    _recordAudit(username || 'unknown', 'unknown', 'LOGIN', 'session', 'FAILED', 'Percobaan kata sandi tidak cocok', '');
    // Pesan kesalahan generik (SEC-04)
    return _jsonOut({ ok: false, error: 'Nama pengguna atau kata sandi tidak valid.' });
  }

  // Generate cryptographically secure session token (32 hex, SEC-03)
  var token = _generateSecureRandomHex(32);
  // Simpan di CacheService TTL 6 jam = 21600 detik (SEC-06) dengan payload JSON { username, role }
  var cache = CacheService.getScriptCache();
  var sessionPayload = JSON.stringify({
    username: user.username,
    role:     user.role
  });
  cache.put('sess_' + token, sessionPayload, 21600);

  _recordAudit(user.username, user.role, 'LOGIN', 'session', 'SUCCESS', 'Login berhasil (must_change=' + user.must_change + ')', '');
  _log('INFO', 'login', 'Login sukses: ' + user.username + ' (role=' + user.role + ', must_change=' + user.must_change + ')', '');

  return _jsonOut({
    ok:          true,
    token:       token,
    username:    user.username,
    must_change: user.must_change,
    role:        user.role
  });
}

/* ══════════════════════════════════════════════════════════════
   Handler: change_password (terproteksi sesi)
══════════════════════════════════════════════════════════════ */

function _handleChangePassword(data) {
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

  if (newPassword.length < 8) {
    return _jsonOut({ ok: false, error: 'Kata sandi baru minimal 8 karakter.' });
  }

  var user = _findUser(session.username);
  if (!user) {
    return _jsonOut({ ok: false, error: 'Data pengguna tidak ditemukan.' });
  }

  if (!_verifyPassword(user.salt, oldPassword, user.password_hash)) {
    _log('WARN', 'change_password', 'Kata sandi lama salah untuk: ' + user.username, '');
    _recordAudit(user.username, session.role || 'user', 'CHANGE_PASSWORD', 'user:' + user.username, 'FAILED', 'Kata sandi lama salah', '');
    return _jsonOut({ ok: false, error: 'Kata sandi saat ini tidak cocok.' });
  }

  var newSalt = _generateSecureRandomHex(16);
  var newHash = _hashPassword(newSalt, newPassword);
  var now = new Date();

  var sheet = _getOrCreateUsersSheet();
  sheet.getRange(user.rowIndex, 2).setValue(newHash);
  sheet.getRange(user.rowIndex, 3).setValue(newSalt);
  sheet.getRange(user.rowIndex, 4).setValue(false);
  sheet.getRange(user.rowIndex, 6).setValue(now);

  _recordAudit(user.username, session.role || 'user', 'CHANGE_PASSWORD', 'user:' + user.username, 'SUCCESS', 'Kata sandi berhasil diperbarui', '');
  _log('INFO', 'change_password', 'Kata sandi berhasil diperbarui untuk: ' + user.username, '');

  return _jsonOut({
    ok:      true,
    message: 'Kata sandi berhasil diperbarui.'
  });
}

/* ══════════════════════════════════════════════════════════════
   Handler: log_event (publik)
   API-01 (schema allowlist), API-02 (server timestamp),
   API-03 (idempotensi via event_id), SEC-05 (abaikan IP klien)
══════════════════════════════════════════════════════════════ */

function _readSourcesSheetAll(srcSheet) {
  var allSources = [];
  if (srcSheet && srcSheet.getLastRow() > 1) {
    var maxCol = Math.max(srcSheet.getLastColumn(), 17);
    var sRows = srcSheet.getRange(2, 1, srcSheet.getLastRow() - 1, maxCol).getValues();
    for (var j = 0; j < sRows.length; j++) {
      if (!sRows[j][0]) continue;
      allSources.push({
        code:             String(sRows[j][0] || ''),
        name:             String(sRows[j][1] || ''),
        type:             String(sRows[j][2] || 'staff'),
        outlet:           String(sRows[j][3] || ''),
        role:             String(sRows[j][4] || ''),
        active:           sRows[j][5] === true || sRows[j][5] === 'TRUE',
        kartu_diprogram:  sRows[j][6] === true || sRows[j][6] === 'TRUE',
        legacy_codes:     sRows[j][7] ? (function(){ try{ return JSON.parse(sRows[j][7]); }catch(e){ return []; } })() : [],
        created_at:       sRows[j][8] || '',
        updated_at:       sRows[j][9] || '',
        whatsapp:         String(sRows[j][10] || ''),
        revoked_codes:    sRows[j][11] ? (function(){ try{ return JSON.parse(sRows[j][11]); }catch(e){ return []; } })() : [],
        migration_mode:   sRows[j][12] === true || sRows[j][12] === 'TRUE',
        migration_until:  String(sRows[j][13] || ''),
        needs_reprint:    sRows[j][14] === true || sRows[j][14] === 'TRUE',
        service_hours:    String(sRows[j][15] || ''),
        welcome_template: String(sRows[j][16] || '')
      });
    }
  }
  return allSources;
}

function _handleLogEvent(data) {
  if (!data || !data.event || !data.device_id) {
    return _jsonOut({ ok: false, error: 'Field wajib tidak ada: event dan device_id diperlukan' });
  }

  var devId = String(data.device_id).trim();
  if (devId.length > 100) {
    return _jsonOut({ ok: false, error: 'Format device_id tidak valid' });
  }

  if (!_checkRateLimit('event_dev_' + devId, 60, 60)) {
    _log('WARN', 'log_event', 'Rate limit exceeded — device: ' + devId.substring(0, 30), '');
    return _jsonOut({ ok: false, error: 'Rate limit exceeded' });
  }

  var botFlag = (data.hp && String(data.hp).trim() !== '') ? true : false;
  if (botFlag) {
    _log('WARN', 'log_event', 'Honeypot terisi (AF-06 reject_event) — device: ' + devId.substring(0, 30), '');
    return _jsonOut({ ok: false, error: 'Event rejected (AF-06)' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet    = getOrCreateMonthlyEventsSheet();
    var tsServer = Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
    var eventId  = String(data.event_id || '').trim() || Utilities.getUuid();

    // Rekonsiliasi dwell_update khusus pada baris event === 'visit' (FR-P1-02)
    if (data.event === 'dwell_update' && data.session_id) {
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        var scanData = sheet.getRange(2, 1, lastRow - 1, 14).getValues();
        for (var i = scanData.length - 1; i >= 0; i--) {
          if (String(scanData[i][1]) === String(data.session_id) && String(scanData[i][5]) === 'visit') {
            var targetRow = i + 2;
            var newDwell  = Math.max(Number(scanData[i][11]) || 0, Number(data.dwell_ms)     || 0);
            var newInter  = Math.max(Number(scanData[i][12]) || 0, Number(data.interactions) || 0);
            var newScroll = Math.max(Number(scanData[i][13]) || 0, Number(data.scroll_max)   || 0);
            sheet.getRange(targetRow, 12, 1, 3).setValues([[newDwell, newInter, newScroll]]);
            var matchedEventId = scanData[i][0];
            return _jsonOut({ ok: true, action: 'reconciled', event_id: matchedEventId });
          }
        }
      }
      return _jsonOut({ ok: true, action: 'no_matching_visit' });
    }

    // Idempotensi (API-03, GUE-11)
    var curLastRow = sheet.getLastRow();
    if (curLastRow > 1) {
      var checkRows = Math.min(200, curLastRow - 1);
      var existingIds = sheet.getRange(curLastRow - checkRows + 1, 1, checkRows, 1).getValues();
      for (var r = existingIds.length - 1; r >= 0; r--) {
        if (String(existingIds[r][0]) === eventId) {
          return _jsonOut({ ok: true, event_id: eventId, duplicate: true });
        }
      }
    }

    var row = [
      eventId,
      String(data.session_id  || '').substring(0, 100),
      devId,
      tsServer,
      String(data.ts_client   || tsServer).substring(0, 50),
      String(data.event       || 'unknown').substring(0, 50),
      String(data.source      || 'general').substring(0, 100),
      String(data.source_type || 'general').substring(0, 50),
      '',
      String(data.ua          || '').substring(0, 150),
      String(data.screen      || '').substring(0, 30),
      Number(data.dwell_ms)     || 0,
      Number(data.interactions) || 0,
      Number(data.scroll_max)   || 0,
      String(data.fp          || '').substring(0, 64),
      false,
      JSON.stringify(data.extra || {})
    ];
    sheet.appendRow(row);

    return _jsonOut({ ok: true, event_id: eventId });
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: get_admin_data (token-protected)
   SEC-01, SEC-08, FR-P0-05, FR-P1-04
══════════════════════════════════════════════════════════════ */

function _handleGetAdminData(data, session) {
  var ss       = getSpreadsheet();
  var cfgSheet = ss.getSheetByName('Config');
  var srcSheet = ss.getSheetByName('Sources');
  var devSheet = ss.getSheetByName('StaffDevices');
  var role     = session ? session.role : 'super_admin';

  var fullConfig = {};
  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var rows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (!rows[i][0]) continue;
      try { fullConfig[rows[i][0]] = JSON.parse(rows[i][1]); } catch (e) {}
    }
  }

  if (role === 'content_editor') {
    delete fullConfig.fraud_thresholds;
  }

  var allSources = (role === 'content_editor') ? [] : _readSourcesSheetAll(srcSheet);

  var staffDevices = [];
  if (role !== 'content_editor' && devSheet && devSheet.getLastRow() > 1) {
    var dRows = devSheet.getRange(2, 1, devSheet.getLastRow() - 1, 4).getValues();
    staffDevices = dRows.map(function(r) {
      return {
        device_id:     String(r[0] || ''),
        staff_code:    String(r[1] || ''),
        label:         String(r[2] || ''),
        registered_at: r[3] || ''
      };
    });
  }

  return _jsonOut({
    ok:            true,
    config:        fullConfig,
    sources:       allSources,
    staff_devices: staffDevices,
    timestamp:     new Date().toISOString(),
    system_health: {
      backend_version: 'v6.3.0-phase3',
      server_time:     Utilities.formatDate(new Date(), 'Asia/Jakarta', "yyyy-MM-dd'T'HH:mm:ssXXX"),
      timezone:        'Asia/Jakarta',
      current_user:    session ? session.username : '',
      current_role:    role
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   Handler: save_all_admin_data (token-protected)
   SRC-08, SEC-11, SEC-12, FR-P0-05, FR-P1-04, FR-CMS-01
══════════════════════════════════════════════════════════════ */

function _handleSaveAllAdminData(data, session) {
  var actor = session ? session.username : 'system';
  var role  = session ? session.role : 'super_admin';

  if (role === 'analyst_readonly') {
    _recordAudit(actor, role, 'MUTATION_DENIED', 'all', 'REJECTED', 'Ditolak: analyst_readonly tidak boleh menyimpan data', '');
    return _jsonOut({ ok: false, error: 'Akses ditolak: Peran analyst_readonly bersifat baca-saja dan tidak diizinkan melakukan mutasi data.' });
  }

  if (role === 'content_editor') {
    if (data.sources || data.staff_devices || data.fraud_settings || (data.config && data.config.fraud_thresholds)) {
      _recordAudit(actor, role, 'MUTATION_DENIED', 'sources/fraud/config', 'REJECTED', 'Ditolak: content_editor tidak berhak mengubah sumber, perangkat staf, atau konfigurasi anti-fraud', '');
      return _jsonOut({ ok: false, error: 'Akses ditolak: Peran content_editor hanya berhak mengubah promosi, outlet, dan konten halaman tamu.' });
    }
  }

  if (role === 'manager') {
    if (data.fraud_settings || (data.config && data.config.fraud_thresholds)) {
      _recordAudit(actor, role, 'MUTATION_DENIED', 'fraud_settings', 'REJECTED', 'Ditolak: manager tidak berhak mengubah parameter anti-fraud', '');
      return _jsonOut({ ok: false, error: 'Akses ditolak: Peran manager tidak diizinkan mengubah konfigurasi anti-fraud sistem.' });
    }
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var auditParts = [];

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
      var knownKeys = [
        'general', 'appearance', 'guest_sections', 'review_settings',
        'whatsapp_settings', 'guest_content', 'promotions', 'outlets', 'fraud_thresholds'
      ];
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
      if (data.config) auditParts.push('config: ' + Object.keys(data.config).join(','));
      if (data.fraud_settings) auditParts.push('fraud_thresholds updated');
    }

    /* ── Simpan tab Sources (17 kolom termasuk metadata rotasi & sales — FR-P0-05) ── */
    var srcHeaders = [
      'code', 'name', 'type', 'outlet', 'role', 'active', 'kartu_diprogram',
      'legacy_codes', 'created_at', 'updated_at', 'whatsapp',
      'revoked_codes', 'migration_mode', 'migration_until', 'needs_reprint',
      'service_hours', 'welcome_template'
    ];
    var srcSheet = getOrCreateSheet('Sources', srcHeaders);
    if (srcSheet.getLastColumn() < 17) {
      srcSheet.getRange(1, 1, 1, srcHeaders.length).setValues([srcHeaders]).setFontWeight('bold').setBackground('#f0ece4');
    }
    if (Array.isArray(data.sources)) {
      var lastSrc = srcSheet.getLastRow();
      if (lastSrc > 1) srcSheet.getRange(2, 1, lastSrc - 1, 17).clearContent();
      if (data.sources.length > 0) {
        var srcRows = data.sources.map(function (s) {
          return [
            s.code             || '',
            s.name             || '',
            s.type             || 'staff',
            s.outlet           || '',
            s.role             || '',
            s.active !== false,
            !!s.kartu_diprogram,
            JSON.stringify(s.legacy_codes  || []),
            s.created_at       || new Date(),
            new Date(),
            s.whatsapp         || '',
            JSON.stringify(s.revoked_codes || []),
            !!s.migration_mode,
            s.migration_until  || '',
            !!s.needs_reprint,
            s.service_hours    || '',
            s.welcome_template || ''
          ];
        });
        srcSheet.getRange(2, 1, srcRows.length, 17).setValues(srcRows);
      }
      auditParts.push('sources count: ' + data.sources.length);
    }

    /* ── Simpan tab StaffDevices (SRC-08) ── */
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
      auditParts.push('staff_devices count: ' + data.staff_devices.length);
    }

    var details = auditParts.join('; ') || 'Penyimpanan data admin';
    _recordAudit(actor, role, 'MUTATION_SAVE', 'admin_data', 'SUCCESS', details, '');
    _log('INFO', 'save_all_admin_data', 'Data admin disimpan oleh ' + actor + ' (' + role + '). ' + details, '');
    return _jsonOut({ ok: true, updated_at: new Date().toISOString() });
  } finally {
    lock.releaseLock();
  }
}

/* ══════════════════════════════════════════════════════════════
   Handler: get_audit_logs (token-protected)
   SEC-11, SEC-12, SRC-09, FR-P0-02
══════════════════════════════════════════════════════════════ */

function _handleGetAuditLogs(data, session) {
  if (session && session.role === 'content_editor') {
    return _jsonOut({ ok: false, error: 'Akses ditolak: content_editor tidak memiliki izin melihat jejak audit.' });
  }

  var ss       = getSpreadsheet();
  var sheet    = ss.getSheetByName('AuditLog');
  var logsList = [];
  var limit    = Math.min(Number(data.limit) || 200, 500);

  if (sheet && sheet.getLastRow() > 1) {
    var totalRows = sheet.getLastRow() - 1;
    var readRows  = Math.min(totalRows, limit);
    var startRow  = totalRows - readRows + 2;
    var rows      = sheet.getRange(startRow, 1, readRows, 8).getValues();

    for (var i = rows.length - 1; i >= 0; i--) {
      logsList.push({
        timestamp:     rows[i][0],
        ts_server:     rows[i][0],
        actor:         rows[i][1],
        role:          rows[i][2],
        action:        rows[i][3],
        target_object: rows[i][4],
        status:        rows[i][5],
        details:       rows[i][6],
        ip:            rows[i][7]
      });
    }
  }

  return _jsonOut({
    ok:         true,
    logs:       logsList,
    audit_logs: logsList,
    total:      logsList.length
  });
}

/* ══════════════════════════════════════════════════════════════
   Handler: get_events_data (token-protected)
   FR-P1-04 (RBAC), FR-P0-05 (17 kolom Sources), FR-P2-03 (Lintas Bulan)
══════════════════════════════════════════════════════════════ */

function _handleGetEventsData(data, session) {
  if (session && session.role === 'content_editor') {
    return _jsonOut({ ok: false, error: 'Akses ditolak: content_editor tidak memiliki izin melihat data analitik event.' });
  }

  var ss          = getSpreadsheet();
  var now         = new Date();
  var curMonthTab = 'Events_' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyyy_MM');
  var targetMonth = data.month || curMonthTab;
  var evSheet     = ss.getSheetByName(targetMonth);
  var eventsList  = [];
  var limit       = Math.min(Number(data.limit) || 10000, 50000);

  function readSheetEvents(sh, maxItems) {
    if (!sh || sh.getLastRow() <= 1) return [];
    var totalRows = sh.getLastRow() - 1;
    var readRows  = Math.min(totalRows, maxItems);
    var startRow  = totalRows - readRows + 2;
    var rawRows   = sh.getRange(startRow, 1, readRows, 17).getValues();
    return rawRows.map(function (r) {
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

  // Jika membaca bulan berjalan, sertakan juga tab bulan sebelumnya agar tren 30 hari utuh (FR-P2-03)
  if (targetMonth === curMonthTab && data.include_prev_month !== false) {
    var prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var prevTab  = 'Events_' + Utilities.formatDate(prevDate, 'Asia/Jakarta', 'yyyy_MM');
    if (prevTab !== targetMonth) {
      var prevSheet = ss.getSheetByName(prevTab);
      if (prevSheet) {
        eventsList = eventsList.concat(readSheetEvents(prevSheet, Math.floor(limit / 2)));
      }
    }
  }

  if (evSheet) {
    eventsList = eventsList.concat(readSheetEvents(evSheet, limit));
  }

  var allSheets   = ss.getSheets();
  var archiveTabs = [];
  for (var s = 0; s < allSheets.length; s++) {
    if (allSheets[s].getName().indexOf('Events_') === 0) {
      archiveTabs.push(allSheets[s].getName());
    }
  }

  var staffDevices = [];
  var devSheet     = ss.getSheetByName('StaffDevices');
  if (devSheet && devSheet.getLastRow() > 1) {
    var dRows = devSheet.getRange(2, 1, devSheet.getLastRow() - 1, 4).getValues();
    staffDevices = dRows.map(function (r) {
      return {
        device_id:     String(r[0] || ''),
        staff_code:    String(r[1] || ''),
        label:         String(r[2] || ''),
        registered_at: r[3] || ''
      };
    });
  }

  var cfgSheet = ss.getSheetByName('Config');
  var srcSheet = ss.getSheetByName('Sources');
  var fullConfig = {};
  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var cRows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
    for (var ci = 0; ci < cRows.length; ci++) {
      if (cRows[ci][0]) {
        try { fullConfig[cRows[ci][0]] = JSON.parse(cRows[ci][1]); } catch (e) {}
      }
    }
  }

  var allSources = _readSourcesSheetAll(srcSheet);

  _log('INFO', 'get_events_data', 'Kirim ' + eventsList.length + ' events dari ' + targetMonth, '');
  return _jsonOut({
    ok:            true,
    month:         targetMonth,
    events:        eventsList,
    staff_devices: staffDevices,
    config:        fullConfig,
    sources:       allSources,
    archive_tabs:  archiveTabs,
    total:         eventsList.length,
    total_rows:    (evSheet && evSheet.getLastRow() > 1) ? (evSheet.getLastRow() - 1) : 0,
    limit:         limit
  });
}

/* ══════════════════════════════════════════════════════════════
   Utility: JSON output dengan MIME type JSON
══════════════════════════════════════════════════════════════ */

function _jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
