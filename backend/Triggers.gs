/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v5.0
 * backend/Triggers.gs — Cron job terjadwal
 *
 * Dua trigger utama:
 *   1. laporanMingguan()  → Setiap Senin pukul 08:00 WIB — email ringkasan ke manajemen
 *   2. agregatBulanan()   → Tanggal 1 setiap bulan pukul 02:00 WIB — rekap ke MonthlyAggregates
 *
 * Cara memasang trigger (lakukan sekali di Apps Script Editor):
 *   Menu ⏰ "Triggers" → "Add Trigger"
 *     - laporanMingguan : Time-driven → Week timer → Every Monday → 8am to 9am (WIB)
 *     - agregatBulanan  : Time-driven → Month timer → Day 1 of month → 2am to 3am (WIB)
 *
 * Script Properties yang diperlukan:
 *   EMAIL_MANAJEMEN  → Alamat email penerima laporan (boleh dipisah koma)
 *   READ_TOKEN       → Token admin (untuk identifikasi konteks script)
 */

/* ══════════════════════════════════════════════════════════════
   LAPORAN MINGGUAN — Terkirim setiap Senin pukul 08:00 WIB
══════════════════════════════════════════════════════════════ */

/**
 * Entry point trigger laporan mingguan.
 * Dapat juga dijalankan manual di Apps Script Editor untuk pengujian.
 */
function laporanMingguan() {
  try {
    _log('INFO', 'laporanMingguan', 'Trigger laporan mingguan dimulai', '');

    var ss         = getSpreadsheet();
    var emailTarget= _getEmailTarget();
    if (!emailTarget) {
      _log('WARN', 'laporanMingguan', 'EMAIL_MANAJEMEN tidak dikonfigurasi di Script Properties.', '');
      return;
    }

    // Ambil data 7 hari terakhir dari tab Events bulan ini
    var evSheet  = _getCurrentEventsSheet(ss);
    var events   = evSheet ? _readAllEvents(evSheet) : [];
    var weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    var recent   = events.filter(function (ev) {
      try { return new Date(ev.ts_server) >= weekAgo; } catch (e) { return false; }
    });

    // Hitung ringkasan
    var summary = _summarizeEvents(recent);

    // Susun dan kirim email
    var subject = '[Bumi Surabaya] Laporan Mingguan — ' + _formatTanggal(new Date());
    var body    = _buildEmailBody(summary);
    GmailApp.sendEmail(emailTarget, subject, '', { htmlBody: body });

    _log('INFO', 'laporanMingguan', 'Laporan terkirim ke: ' + emailTarget + ' | Events: ' + recent.length, '');
  } catch (err) {
    _log('ERROR', 'laporanMingguan', err.toString(), '');
  }
}

/* ══════════════════════════════════════════════════════════════
   AGREGASI BULANAN — Berjalan tanggal 1 setiap bulan pukul 02:00 WIB
══════════════════════════════════════════════════════════════ */

/**
 * Entry point trigger agregasi bulanan.
 * Menulis ringkasan bulan LALU ke tab MonthlyAggregates.
 */
function agregatBulanan() {
  try {
    _log('INFO', 'agregatBulanan', 'Trigger agregasi bulanan dimulai', '');

    var ss      = getSpreadsheet();
    var now     = new Date();

    // Bulan lalu
    var lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var monthKey      = Utilities.formatDate(lastMonthDate, 'Asia/Jakarta', 'yyyy-MM');
    var tabName       = 'Events_' + Utilities.formatDate(lastMonthDate, 'Asia/Jakarta', 'yyyy_MM');
    var evSheet       = ss.getSheetByName(tabName);

    if (!evSheet || evSheet.getLastRow() <= 1) {
      _log('INFO', 'agregatBulanan', 'Tidak ada data untuk bulan: ' + tabName, '');
      return;
    }

    var events  = _readAllEvents(evSheet);
    var summary = _summarizeEvents(events);

    // Simpan ke tab MonthlyAggregates
    var aggSheet = getOrCreateSheet('MonthlyAggregates', [
      'month_key', 'source_code', 'source_name', 'source_type',
      'total_visits', 'total_reviews', 'total_wa', 'total_promos',
      'quality_score', 'fraud_events_flagged'
    ]);

    var rows = [];
    Object.keys(summary.bySource).forEach(function (code) {
      var s = summary.bySource[code];
      rows.push([
        monthKey,
        code,
        s.name        || code,
        s.type        || 'unknown',
        s.visits      || 0,
        s.reviews     || 0,
        s.wa          || 0,
        s.promos      || 0,
        s.score       || 0,
        s.fraudCount  || 0
      ]);
    });

    if (rows.length > 0) {
      aggSheet.getRange(aggSheet.getLastRow() + 1, 1, rows.length, 10).setValues(rows);
    }

    _log('INFO', 'agregatBulanan',
      'Agregasi selesai — bulan: ' + monthKey + ' | sumber: ' + rows.length, '');
  } catch (err) {
    _log('ERROR', 'agregatBulanan', err.toString(), '');
  }
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Baca semua events dari sheet
══════════════════════════════════════════════════════════════ */

/**
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @returns {Array<Object>}
 */
function _readAllEvents(sheet) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 17).getValues();
  return rows.map(function (r) {
    return {
      event_id:    r[0],  session_id:  r[1],  device_id:   r[2],
      ts_server:   r[3],  ts_client:   r[4],  event:       r[5],
      source:      r[6],  source_type: r[7],  ip:          r[8],
      ua:          r[9],  screen:      r[10], dwell_ms:    Number(r[11]) || 0,
      interactions:Number(r[12]) || 0,        scroll_max:  Number(r[13]) || 0,
      fp:          r[14], bot_flag:    r[15], extra_data:  r[16]
    };
  });
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Ringkasan agregat dari daftar events
══════════════════════════════════════════════════════════════ */

/**
 * Hitung metrik ringkasan dari array events.
 * Fraud detection sederhana (versi server-side ringan) menggunakan velocity check.
 *
 * @param {Array<Object>} events
 * @returns {{
 *   totalEvents: number, totalVisits: number, totalReviews: number,
 *   totalWa: number, top5Staff: Array, anomalyCount: number,
 *   bySource: Object
 * }}
 */
function _summarizeEvents(events) {
  var bySource   = {};
  // Velocity map: device_id + source → jumlah kunjungan 24 jam
  var velocityMap = {};
  var now         = Date.now();
  var H24         = 24 * 60 * 60 * 1000;

  var totalVisits  = 0;
  var totalReviews = 0;
  var totalWa      = 0;
  var anomalyCount = 0;

  events.forEach(function (ev) {
    var source = String(ev.source || 'general');
    if (!bySource[source]) {
      bySource[source] = { name: source, type: ev.source_type || 'unknown', visits: 0, reviews: 0, wa: 0, promos: 0, score: 0, fraudCount: 0 };
    }
    var s      = bySource[source];
    var isFraud = false;

    // Bot honeypot
    if (ev.bot_flag === true || ev.bot_flag === 'TRUE') isFraud = true;

    // Velocity check sederhana (server-side)
    if (ev.event === 'visit' && ev.device_id) {
      var vKey = ev.device_id + '|' + source;
      velocityMap[vKey] = (velocityMap[vKey] || 0) + 1;
      if (velocityMap[vKey] > 3) isFraud = true; // AF-01 sederhana
    }

    // Low-quality dwell check
    if (ev.event === 'visit' && ev.dwell_ms > 0 && ev.dwell_ms < 5000 && ev.interactions === 0) isFraud = true;

    if (isFraud) {
      s.fraudCount++;
      anomalyCount++;
      return; // skip dari skor
    }

    if (ev.event === 'visit') {
      s.visits++;
      totalVisits++;
      s.score += 1;
      if (Number(ev.scroll_max) > 50) s.score += 1; // bonus scroll
    }
    if (ev.event === 'google_review_click') {
      s.reviews++;
      totalReviews++;
      s.score += 3;
    }
    if (ev.event === 'whatsapp_click') {
      s.wa++;
      totalWa++;
      s.score += 2;
    }
    if (ev.event === 'promotion_click' || ev.event === 'outlet_click') {
      s.promos++;
      s.score += 2;
    }
  });

  // Top 5 staf berdasarkan skor
  var top5Staff = Object.keys(bySource)
    .filter(function (k) { return (bySource[k].type || '') === 'staff'; })
    .map(function (k) { return { code: k, name: bySource[k].name, score: bySource[k].score, reviews: bySource[k].reviews }; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 5);

  return {
    totalEvents: events.length,
    totalVisits:  totalVisits,
    totalReviews: totalReviews,
    totalWa:      totalWa,
    anomalyCount: anomalyCount,
    top5Staff:    top5Staff,
    bySource:     bySource
  };
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Ambil sheet Events bulan berjalan
══════════════════════════════════════════════════════════════ */

function _getCurrentEventsSheet(ss) {
  var monthStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy_MM');
  return ss.getSheetByName('Events_' + monthStr) || null;
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Bangun HTML email laporan mingguan
══════════════════════════════════════════════════════════════ */

/**
 * @param {{totalEvents, totalVisits, totalReviews, totalWa, anomalyCount, top5Staff}} summary
 * @returns {string} HTML email
 */
function _buildEmailBody(summary) {
  var now = _formatTanggal(new Date());
  var topRows = (summary.top5Staff || []).map(function (s, i) {
    return '<tr>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;">' + (i + 1) + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;">' + _escHtmlGs(s.name) + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">' + s.score + '</td>' +
      '<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">' + s.reviews + '</td>' +
    '</tr>';
  }).join('');

  if (!topRows) topRows = '<tr><td colspan="4" style="padding:8px 12px;color:#999;">Belum ada data staf minggu ini.</td></tr>';

  var anomalyHtml = summary.anomalyCount > 0
    ? '<p style="color:#c0392b;margin-top:12px;">⚠️ <strong>' + summary.anomalyCount + ' event anomali</strong> terdeteksi. Silakan periksa tab Audit Anti-Fraud di portal admin.</p>'
    : '<p style="color:#27ae60;margin-top:12px;">✅ Tidak ada anomali kecurangan signifikan terdeteksi minggu ini.</p>';

  return [
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;">',
    '<div style="background:#1a3c2a;padding:24px;text-align:center;">',
      '<h1 style="color:#c9a96e;margin:0;font-size:22px;">🏨 Bumi Surabaya City Resort</h1>',
      '<p style="color:#fff;margin:8px 0 0;font-size:13px;">Laporan Mingguan Digital Guest Experience</p>',
    '</div>',
    '<div style="padding:24px;background:#faf8f5;">',
      '<p style="color:#555;">Per: <strong>' + now + '</strong></p>',
      '<h2 style="color:#1a3c2a;border-bottom:2px solid #c9a96e;padding-bottom:8px;">📊 Ringkasan Minggu Ini</h2>',
      '<table style="width:100%;border-collapse:collapse;margin-top:12px;">',
        '<tr><td style="padding:8px 0;color:#555;">Total Kunjungan Tervalidasi</td>',
            '<td style="padding:8px 0;text-align:right;font-weight:bold;color:#1a3c2a;">' + summary.totalVisits + '</td></tr>',
        '<tr><td style="padding:8px 0;color:#555;">Total Klik Google Review</td>',
            '<td style="padding:8px 0;text-align:right;font-weight:bold;color:#c9a96e;">' + summary.totalReviews + '</td></tr>',
        '<tr><td style="padding:8px 0;color:#555;">Total Klik WhatsApp</td>',
            '<td style="padding:8px 0;text-align:right;font-weight:bold;color:#27ae60;">' + summary.totalWa + '</td></tr>',
      '</table>',
      '<h2 style="color:#1a3c2a;border-bottom:2px solid #c9a96e;padding-bottom:8px;margin-top:24px;">🏆 Top 5 Staf Minggu Ini</h2>',
      '<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;">',
        '<thead>',
          '<tr style="background:#1a3c2a;color:#c9a96e;">',
            '<th style="padding:10px 12px;text-align:left;">#</th>',
            '<th style="padding:10px 12px;text-align:left;">Nama Staf</th>',
            '<th style="padding:10px 12px;text-align:right;">Skor</th>',
            '<th style="padding:10px 12px;text-align:right;">Ulasan</th>',
          '</tr>',
        '</thead>',
        '<tbody>',
          topRows,
        '</tbody>',
      '</table>',
      anomalyHtml,
      '<div style="margin-top:24px;padding:16px;background:#f0ece4;border-radius:8px;">',
        '<p style="margin:0;font-size:13px;color:#888;">',
          'Email ini dikirim otomatis oleh sistem Digital Guest Experience v5.0. ',
          'Untuk detail lengkap, buka portal admin di: ',
          '<a href="https://guest.bumisurabaya.com/admin/" style="color:#c9a96e;">',
            'guest.bumisurabaya.com/admin',
          '</a>',
        '</p>',
      '</div>',
    '</div>',
    '</div>'
  ].join('');
}

/* ══════════════════════════════════════════════════════════════
   HELPER: Utilitas kecil
══════════════════════════════════════════════════════════════ */

/**
 * Ambil email target dari Script Properties.
 * Mendukung beberapa alamat dipisah koma.
 * @returns {string}
 */
function _getEmailTarget() {
  return (PropertiesService.getScriptProperties().getProperty('EMAIL_MANAJEMEN') || '').trim();
}

/**
 * Format tanggal ke format Indonesia.
 * @param {Date} d
 * @returns {string}
 */
function _formatTanggal(d) {
  return Utilities.formatDate(d, 'Asia/Jakarta', 'dd MMMM yyyy HH:mm') + ' WIB';
}

/**
 * Escape HTML minimal untuk konten dinamis di email.
 * @param {string} str
 * @returns {string}
 */
function _escHtmlGs(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
