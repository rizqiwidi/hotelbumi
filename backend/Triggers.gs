/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.0
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
 * Helper: Ambil ambang batas anti-fraud dari tab Config atau gunakan default spesifikasi.
 * AF-ALL-02: Memastikan konfigurasi dari panel admin dipakai pada proses cron server.
 * @returns {Object}
 */
function _getFraudThresholds() {
  var ss = getSpreadsheet();
  var cfgSheet = ss.getSheetByName('Config');
  var thresholds = {};
  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var rows = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === 'fraud_thresholds') {
        try { thresholds = JSON.parse(rows[i][1]); } catch(e) {}
        break;
      }
    }
  }
  return {
    velocity_max_events:   Number(thresholds.velocity_limit  || thresholds.velocity_max_events || 3),
    velocity_window_ms:    Number(thresholds.velocity_window_ms || 86400000), // 24 jam
    burst_max_events:      Number(thresholds.burst_count     || thresholds.burst_max_events || 5),
    burst_window_ms:       Number(thresholds.burst_window_ms || 600000),   // 10 menit
    low_dwell_ms:          Number(thresholds.low_dwell_ms    || (thresholds.low_dwell_s ? thresholds.low_dwell_s * 1000 : 5000)),
    hopping_max_sources:   Number(thresholds.hopping_sources || thresholds.hopping_max_sources || 4),
    hopping_window_ms:     Number(thresholds.hopping_window_ms || 3600000), // 1 jam
    bot_min_dwell_ms:      Number(thresholds.bot_min_dwell_ms || 500),
    shared_ip_max_devices: Number(thresholds.shared_ip_max_devices || 10),
    odd_hour_start:        Number(thresholds.odd_hour_start  || 6),
    odd_hour_end:          Number(thresholds.odd_hour_end    || 23)
  };
}

/**
 * Helper: Cek apakah IP adalah placeholder atau tidak valid.
 * AF-07: Placeholder IP dilarang memicu rule.
 * @param {string} ip
 * @returns {boolean}
 */
function _isPlaceholderIp(ip) {
  if (!ip) return true;
  var s = String(ip).trim().toLowerCase();
  return s === '' || s === 'client-ip' || s === 'unknown' || s === 'null' || s === 'undefined' || s === '-' || s === '127.0.0.1';
}

/**
 * Hitung metrik ringkasan dari array events menggunakan aturan anti-fraud terpadu (AF-01 s/d AF-08).
 * Sesuai AF-ALL-01 s/d AF-ALL-03:
 * - Membedakan aksi reject_event, reduce_score, dan flag_only
 * - Menggunakan konfigurasi threshold & window tersimpan
 * - Memeriksa StaffDevices untuk AF-03 self-tap
 * - Mengabaikan placeholder IP pada AF-07
 *
 * @param {Array<Object>} events
 * @returns {{
 *   totalEvents: number, totalVisits: number, totalReviews: number,
 *   totalWa: number, top5Staff: Array, anomalyCount: number,
 *   bySource: Object
 * }}
 */
function _summarizeEvents(events) {
  var ss       = getSpreadsheet();
  var bySource = {};
  var t        = _getFraudThresholds();

  // Ambil daftar staff_devices untuk AF-03 (Self-tap)
  var staffDeviceSet = {};
  var devSheet = ss.getSheetByName('StaffDevices');
  if (devSheet && devSheet.getLastRow() > 1) {
    var devRows = devSheet.getRange(2, 1, devSheet.getLastRow() - 1, 2).getValues();
    for (var d = 0; d < devRows.length; d++) {
      if (devRows[d][0]) staffDeviceSet[String(devRows[d][0]).trim()] = true;
    }
  }

  // Pre-index data untuk deteksi waktu dan korelasi per perangkat / IP
  var byDevice = {};
  var byIp = {};
  var burstBuckets = {};

  events.forEach(function (ev) {
    var did = String(ev.device_id || '').trim();
    var ms = ev.ts_server ? new Date(ev.ts_server).getTime() : 0;
    ev._ms = ms;

    if (did) {
      if (!byDevice[did]) byDevice[did] = [];
      byDevice[did].push(ev);
    }

    var ip = String(ev.ip || '').trim();
    if (!_isPlaceholderIp(ip)) {
      if (!byIp[ip]) byIp[ip] = { devices: {}, events: [] };
      if (did) byIp[ip].devices[did] = true;
      byIp[ip].events.push(ev);
    }

    if (ms) {
      var buck = Math.floor(ms / t.burst_window_ms);
      if (!burstBuckets[buck]) burstBuckets[buck] = 0;
      burstBuckets[buck]++;
    }
  });

  // Identifikasi flag per event_id
  // Actions: reject_event, reduce_score, flag_only
  var flagsByEventId = {};

  function addFlag(eventId, ruleId, action) {
    if (!flagsByEventId[eventId]) flagsByEventId[eventId] = { rules: [], hasReject: false, hasReduce: false, isFlagOnly: true };
    var item = flagsByEventId[eventId];
    if (item.rules.indexOf(ruleId) === -1) item.rules.push(ruleId);
    if (action === 'reject_event') {
      item.hasReject = true;
      item.isFlagOnly = false;
    } else if (action === 'reduce_score') {
      item.hasReduce = true;
      item.isFlagOnly = false;
    }
  }

  // Evaluasi AF-01 (Velocity), AF-05 (Hopping), AF-06 (Bot timing) per device
  Object.keys(byDevice).forEach(function (did) {
    var devList = byDevice[did].slice().sort(function (a, b) { return a._ms - b._ms; });

    // AF-01: Velocity (sliding window)
    var start = 0;
    for (var i = 0; i < devList.length; i++) {
      var tNow = devList[i]._ms;
      if (!tNow) continue;
      while (start < i && devList[start]._ms < tNow - t.velocity_window_ms) {
        start++;
      }
      if ((i - start + 1) > t.velocity_max_events) {
        addFlag(devList[i].event_id, 'AF-01', 'reduce_score');
      }
    }

    // AF-05: Source hopping
    var hStart = 0;
    for (var j = 0; j < devList.length; j++) {
      var tJ = devList[j]._ms;
      if (!tJ) continue;
      while (hStart < j && devList[hStart]._ms < tJ - t.hopping_window_ms) {
        hStart++;
      }
      var uniqueSources = {};
      for (var k = hStart; k <= j; k++) {
        var srcKey = String(devList[k].source || '');
        if (srcKey) uniqueSources[srcKey] = true;
      }
      if (Object.keys(uniqueSources).length > t.hopping_max_sources) {
        addFlag(devList[j].event_id, 'AF-05', 'reduce_score');
      }
    }

    // AF-06: Bot timing (dwell < 500ms antara event berturutan)
    for (var m = 1; m < devList.length; m++) {
      var delta = devList[m]._ms - devList[m - 1]._ms;
      if (delta >= 0 && delta < t.bot_min_dwell_ms) {
        addFlag(devList[m].event_id, 'AF-06', 'reject_event');
        addFlag(devList[m - 1].event_id, 'AF-06', 'reject_event');
      }
    }
  });

  // Evaluasi AF-07 (Shared IP) — hanya untuk IP valid non-placeholder
  Object.keys(byIp).forEach(function (ip) {
    var entry = byIp[ip];
    if (Object.keys(entry.devices).length > t.shared_ip_max_devices) {
      entry.events.forEach(function (ev) {
        addFlag(ev.event_id, 'AF-07', 'flag_only');
      });
    }
  });

  var totalVisits  = 0;
  var totalReviews = 0;
  var totalWa      = 0;
  var anomalyCount = 0;

  events.forEach(function (ev) {
    var eid = String(ev.event_id || '');
    var source = String(ev.source || 'general');
    if (!bySource[source]) {
      bySource[source] = {
        name:       source,
        type:       ev.source_type || 'unknown',
        visits:     0,
        reviews:    0,
        wa:         0,
        promos:     0,
        score:      0,
        fraudCount: 0
      };
    }
    var s = bySource[source];

    // AF-03: Self-tap staff check
    if (ev.device_id && staffDeviceSet[String(ev.device_id).trim()]) {
      addFlag(eid, 'AF-03', 'reject_event');
    }

    // AF-06: Bot honeypot check
    if (ev.bot_flag === true || ev.bot_flag === 'TRUE') {
      addFlag(eid, 'AF-06', 'reject_event');
    }

    // AF-02: Burst check
    if (ev._ms) {
      var buck = Math.floor(ev._ms / t.burst_window_ms);
      if (burstBuckets[buck] > t.burst_max_events) {
        addFlag(eid, 'AF-02', 'reduce_score');
      }
    }

    // AF-04: Low quality dwell check
    var dwell = Number(ev.dwell_ms) || 0;
    var inter = Number(ev.interactions) || 0;
    if (ev.event === 'visit' && dwell > 0 && dwell < t.low_dwell_ms && inter === 0) {
      addFlag(eid, 'AF-04', 'reduce_score');
    }

    // AF-08: Odd hour check (WIB UTC+7)
    if (ev._ms) {
      var hourWib = (new Date(ev._ms).getUTCHours() + 7) % 24;
      if (hourWib < t.odd_hour_start || hourWib >= t.odd_hour_end) {
        addFlag(eid, 'AF-08', 'flag_only');
      }
    }

    // Klasifikasi aksi fraud (AF-ALL-01)
    var flagInfo = flagsByEventId[eid];
    if (flagInfo) {
      anomalyCount++;
      s.fraudCount++;
      if (flagInfo.hasReject) {
        // reject_event: Event ditolak total, tidak dicatat sebagai kunjungan valid
        return;
      }
    }

    // Jika sampai di sini, event tidak di-reject
    var scoreWeight = (flagInfo && flagInfo.hasReduce) ? 0 : 1;

    if (ev.event === 'visit') {
      s.visits++;
      totalVisits++;
      s.score += (1 * scoreWeight);
      if (Number(ev.scroll_max) > 50) s.score += (1 * scoreWeight); // bonus scroll
    } else if (ev.event === 'google_review_click') {
      s.reviews++;
      totalReviews++;
      s.score += (3 * scoreWeight);
    } else if (ev.event === 'whatsapp_click') {
      s.wa++;
      totalWa++;
      s.score += (2 * scoreWeight);
    } else if (ev.event === 'promotion_click' || ev.event === 'outlet_click') {
      s.promos++;
      s.score += (2 * scoreWeight);
    }
  });

  // Top 5 staf berdasarkan skor valid
  var top5Staff = Object.keys(bySource)
    .filter(function (k) { return (bySource[k].type || '') === 'staff'; })
    .map(function (k) { return { code: k, name: bySource[k].name, score: bySource[k].score, reviews: bySource[k].reviews }; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, 5);

  return {
    totalEvents:  events.length,
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
