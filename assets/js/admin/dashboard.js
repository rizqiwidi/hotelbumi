/**
 * BUMI SURABAYA v5.0
 * dashboard.js — Admin dashboard rendering module
 *
 * Renders metric cards, leaderboard, trend chart, and source analysis table.
 * Expects data shaped by BSAntiFraud.getLeaderboard().
 *
 * Dependencies (globals expected):
 *   - Chart  : Chart.js v3+ loaded in admin HTML
 *
 * Target DOM element IDs:
 *   #adm-metric-visits   #adm-metric-score  #adm-metric-reviews
 *   #adm-metric-wa       #adm-metric-conv
 *   #adm-leaderboard-staff  #adm-leaderboard-outlets
 *   #adm-trend-chart  (canvas)
 *   #adm-source-table tbody
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
   * Internal chart registry
   * Chart.js requires destroying a previous chart instance before re-rendering
   * into the same canvas.
   * ───────────────────────────────────────────── */

  /** @type {Map<string, import('chart.js').Chart>} */
  const _chartRegistry = new Map();

  /* ─────────────────────────────────────────────
   * Utility helpers
   * ───────────────────────────────────────────── */

  /**
   * Safely retrieve a DOM element; warn if missing.
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  function _el(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn('[BSDashboard] Element #' + id + ' not found in DOM');
    }
    return el;
  }

  /**
   * Format a number with thousands separator.
   * @param {number} n
   * @returns {string}
   */
  function _fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('id-ID');
  }

  /**
   * Format a decimal as a percentage string.
   * @param {number} ratio  0–1
   * @param {number} [decimals=1]
   * @returns {string}
   */
  function _pct(ratio, decimals = 1) {
    if (ratio === null || ratio === undefined || isNaN(ratio)) return '—';
    return (ratio * 100).toFixed(decimals) + '%';
  }

  /**
   * Format a quality score (0–5 or 0–100).
   * @param {number} score
   * @returns {string}
   */
  function _score(score) {
    if (score === null || score === undefined || isNaN(score)) return '—';
    return Number(score).toFixed(2);
  }

  /**
   * Create or replace the innerHTML of an element.
   * @param {HTMLElement} el
   * @param {string} html
   */
  function _setHtml(el, html) {
    if (el) el.innerHTML = html;
  }

  /**
   * Compute trend arrow indicator.
   * @param {number} current
   * @param {number} previous
   * @returns {{ arrow: string, cls: string }}
   */
  function _trend(current, previous) {
    if (!previous || previous === 0) return { arrow: '', cls: '' };
    if (current > previous) return { arrow: ' ▲', cls: 'bs-trend-up' };
    if (current < previous) return { arrow: ' ▼', cls: 'bs-trend-down' };
    return { arrow: ' —', cls: '' };
  }

  /* ─────────────────────────────────────────────
   * 1. Metric cards
   * ───────────────────────────────────────────── */

  /**
   * Render the five metric summary cards.
   *
   * @param {Object} data - Evaluated events / leaderboard data
   * @param {number}  data.totalVisits      - total scan / page-load events
   * @param {number}  data.qualityScore     - weighted avg quality score (0–5)
   * @param {number}  data.totalReviews     - confirmed review submissions
   * @param {number}  data.waClicks         - WhatsApp button clicks
   * @param {number}  data.conversionRate   - reviews / visits (0–1)
   * @param {Object}  [data.prev]           - same shape for previous period (optional)
   */
  /**
   * Render the five metric summary cards with strict definitions (ANA-01, ANA-02, ANA-03).
   *
   * @param {Object} data - Evaluated events / leaderboard data
   * @param {number}  data.totalVisits      - total scan / page-load events
   * @param {number}  data.qualityScore     - weighted avg quality score (0–5)
   * @param {number}  data.totalReviews     - clicks on Google Review link (ANA-02)
   * @param {number}  data.waClicks         - WhatsApp button clicks
   * @param {number}  data.conversionRate   - review clicks / visits (0–1) (ANA-03)
   * @param {Object}  [data.prev]           - same shape for previous period (optional)
   */
  function renderMetrics(data = {}) {
    const {
      totalVisits    = 0,
      qualityScore   = 0,
      totalReviews   = 0,
      waClicks       = 0,
      conversionRate = 0,
      prev           = {},
    } = data;

    const metrics = [
      {
        id:      'adm-metric-visits',
        label:   'Total Kunjungan',
        value:   _fmt(totalVisits),
        sub:     'Kunjungan halaman tamu valid',
        tooltip: 'Total event kunjungan (visit) yang valid setelah evaluasi anti-fraud. Formula: COUNT(event == "visit"). Window: Bulan terpilih (WIB). Satuan: kunjungan.',
        ...( prev.totalVisits !== undefined
            ? _trend(totalVisits, prev.totalVisits)
            : {} ),
      },
      {
        id:      'adm-metric-score',
        label:   'Quality Score',
        value:   _score(qualityScore) + ' / 5',
        sub:     'Skor interaksi rata-rata (0–5)',
        tooltip: 'Skor kualitas interaksi valid: Visit (+1), Scroll >50% (+1), Klik WA (+2), Promo/Outlet (+2), Klik Review (+3), Kirim Direct Feedback (+3). Event ditolak/dikurangi anti-fraud = 0 poin. Satuan: poin skala 0–5.',
        ...( prev.qualityScore !== undefined
            ? _trend(qualityScore, prev.qualityScore)
            : {} ),
      },
      {
        id:      'adm-metric-reviews',
        label:   'Klik Google Review',
        value:   _fmt(totalReviews),
        sub:     'Klik tombol ulasan (bukan ulasan terkirim)',
        tooltip: 'Total klik tombol menuju Google Review (ANA-02). Data mengukur intensi klik tamu, bukan konfirmasi ulasan terkirim di Google Maps. Formula: COUNT(event == "google_review_click"). Satuan: klik.',
        ...( prev.totalReviews !== undefined
            ? _trend(totalReviews, prev.totalReviews)
            : {} ),
      },
      {
        id:      'adm-metric-wa',
        label:   'Klik WhatsApp',
        value:   _fmt(waClicks),
        sub:     'Klik chat & reservasi WhatsApp',
        tooltip: 'Total klik tombol WhatsApp (staf / concierge hotel). Formula: COUNT(event == "whatsapp_click"). Satuan: klik.',
        ...( prev.waClicks !== undefined
            ? _trend(waClicks, prev.waClicks)
            : {} ),
      },
      {
        id:      'adm-metric-conv',
        label:   'Rasio Klik Review / Kunjungan',
        value:   _pct(conversionRate),
        sub:     'Formula: (Klik Review / Kunjungan) × 100%',
        tooltip: 'Rasio klik review terhadap kunjungan (ANA-03). Formula: (Total Klik Google Review / Total Kunjungan) × 100%. Denominator: Total Kunjungan.',
        ...( prev.conversionRate !== undefined
            ? _trend(conversionRate, prev.conversionRate)
            : {} ),
      },
    ];

    metrics.forEach(({ id, label, value, sub, tooltip, arrow = '', cls = '' }) => {
      const cardEl = _el(id);
      if (!cardEl) return;
      cardEl.setAttribute('title', tooltip);

      const labelEl = cardEl.querySelector('.adm-metric-label');
      const valEl   = cardEl.querySelector('.adm-metric-value');
      const subEl   = cardEl.querySelector('.adm-metric-sub');

      if (labelEl) labelEl.textContent = label;
      if (subEl)   subEl.textContent   = sub;
      if (valEl) {
        valEl.innerHTML = `${_escHtml(String(value))}<span class="bs-metric-trend ${_escHtml(cls)}">${_escHtml(arrow)}</span>`;
      } else {
        _setHtml(cardEl, `
          <div class="bs-metric-label">${_escHtml(label)}</div>
          <div class="bs-metric-value">${_escHtml(String(value))}<span class="bs-metric-trend ${_escHtml(cls)}">${_escHtml(arrow)}</span></div>
          <div class="bs-metric-sub">${_escHtml(sub)}</div>
        `);
      }
    });
  }

  /* ─────────────────────────────────────────────
   * 2. Leaderboard
   * ───────────────────────────────────────────── */

  /**
   * Render staff and outlet leaderboard tables.
   *
   * @param {Object} data
   * @param {Array}  data.staffRanking   - [{ name, code, score, reviews, outlet }, …]
   * @param {Array}  data.outletRanking  - [{ name, score, reviews, visits }, …]
   * @param {number} [topN=10]           - how many rows to show
   */
  function renderLeaderboard(data = {}, topN = 10) {
    const { staffRanking = [], outletRanking = [] } = data;

    /* --- Staff --- */
    const staffEl = _el('adm-leaderboard-staff');
    if (staffEl) {
      const rows = staffRanking
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topN);

      if (rows.length === 0) {
        _setHtml(staffEl, '<tr><td colspan="5" class="bs-empty">Belum ada data staf</td></tr>');
      } else {
        _setHtml(staffEl, rows.map((row, i) => `
          <tr class="${i === 0 ? 'bs-rank-1' : i === 1 ? 'bs-rank-2' : i === 2 ? 'bs-rank-3' : ''}">
            <td class="bs-rank-num">${i + 1}</td>
            <td class="bs-rank-name">${_escHtml(row.name || row.code || '—')}</td>
            <td class="bs-rank-outlet">${_escHtml(row.outlet || '—')}</td>
            <td class="bs-rank-score">${_score(row.score)}</td>
            <td class="bs-rank-reviews">${_fmt(row.reviews)}</td>
          </tr>
        `).join(''));
      }
    }

    /* --- Outlets --- */
    const outletEl = _el('adm-leaderboard-outlets');
    if (outletEl) {
      const rows = outletRanking
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topN);

      if (rows.length === 0) {
        _setHtml(outletEl, '<tr><td colspan="4" class="bs-empty">Belum ada data outlet</td></tr>');
      } else {
        _setHtml(outletEl, rows.map((row, i) => `
          <tr class="${i === 0 ? 'bs-rank-1' : i === 1 ? 'bs-rank-2' : i === 2 ? 'bs-rank-3' : ''}">
            <td class="bs-rank-num">${i + 1}</td>
            <td class="bs-rank-name">${_escHtml(row.name || '—')}</td>
            <td class="bs-rank-score">${_score(row.score)}</td>
            <td class="bs-rank-reviews">${_fmt(row.reviews)}</td>
          </tr>
        `).join(''));
      }
    }
  }

  /* ─────────────────────────────────────────────
   * 3. Trend chart
   * ───────────────────────────────────────────── */

  /**
   * Render a multi-dataset line chart of visits/reviews over time.
   *
   * @param {Object} data
   * @param {Array<{date: string, visits: number, reviews: number}>} data.daily
   *   Array of daily buckets (most recent first or chronological — will be sorted).
   * @param {'7d'|'30d'} [period='7d'] - which window to display
   */
  function renderTrendChart(data = {}, period = '7d') {
    const canvas = _el('adm-trend-chart');
    if (!canvas) return;

    if (typeof global.Chart === 'undefined') {
      console.warn('[BSDashboard] Chart.js tidak tersedia. Menampilkan fallback ringkasan data (GUE-14).');
      var parent = canvas.parentElement;
      if (parent) {
        var existingFb = parent.querySelector('.adm-chart-fallback');
        if (existingFb) existingFb.remove();
        canvas.style.display = 'none';
        var fb = document.createElement('div');
        fb.className = 'adm-chart-fallback';
        fb.style.cssText = 'padding:16px;background:#fcfbf9;border:1px dashed #d1c7b7;border-radius:6px;font-size:0.85rem;color:#555;';
        var daysCount = period === '30d' ? 30 : 7;
        var dailyList = (data.daily || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date)).slice(-daysCount);
        var rowsHtml = dailyList.map(function(d){ return '<tr><td style="padding:4px 8px;">' + _shortDate(d.date) + '</td><td style="padding:4px 8px;text-align:right;"><strong>' + (d.visits||0) + '</strong></td><td style="padding:4px 8px;text-align:right;"><strong>' + (d.reviews||0) + '</strong></td></tr>'; }).join('');
        fb.innerHTML = '<div style="margin-bottom:8px;font-weight:600;color:var(--deep-green,#1a3c2a);">📊 Ringkasan Tren Harian (' + period + ') — Tampilan Teks Fallback (GUE-14)</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr style="border-bottom:1px solid #ddd;text-align:left;"><th style="padding:4px 8px;">Tanggal</th><th style="padding:4px 8px;text-align:right;">Kunjungan</th><th style="padding:4px 8px;text-align:right;">Ulasan</th></tr></thead><tbody>' +
          (rowsHtml || '<tr><td colspan="3" style="padding:8px;text-align:center;">Belum ada data harian</td></tr>') +
          '</tbody></table>';
        parent.appendChild(fb);
      }
      return;
    }

    /* Kembalikan tampilan canvas jika Chart.js tersedia */
    canvas.style.display = '';
    var oldFb = canvas.parentElement ? canvas.parentElement.querySelector('.adm-chart-fallback') : null;
    if (oldFb) oldFb.remove();

    /* Destroy any existing chart instance to avoid canvas re-use errors */
    if (_chartRegistry.has('trend')) {
      _chartRegistry.get('trend').destroy();
      _chartRegistry.delete('trend');
    }

    const days  = period === '30d' ? 30 : 7;
    const daily = (data.daily || [])
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-days);

    const labels   = daily.map((d) => _shortDate(d.date));
    const visits   = daily.map((d) => d.visits   || 0);
    const reviews  = daily.map((d) => d.reviews  || 0);

    const chart = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:           'Kunjungan',
            data:            visits,
            borderColor:     '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.08)',
            borderWidth:     2,
            pointRadius:     3,
            tension:         0.3,
            fill:            true,
          },
          {
            label:           'Ulasan',
            data:            reviews,
            borderColor:     '#16A34A',
            backgroundColor: 'rgba(22,163,74,0.08)',
            borderWidth:     2,
            pointRadius:     3,
            tension:         0.3,
            fill:            true,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        interaction: {
          mode:      'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            labels:   { usePointStyle: true, boxWidth: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + _fmt(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid:  { display: false },
            ticks: { maxTicksLimit: days <= 7 ? 7 : 10 },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => _fmt(val),
              maxTicksLimit: 6,
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });

    _chartRegistry.set('trend', chart);
  }

  /* ─────────────────────────────────────────────
   * 4. Source analysis table
   * ───────────────────────────────────────────── */

  /**
   * Render the per-source analysis table.
   *
   * @param {Array<{
   *   code: string, name: string, type: string, outlet: string,
   *   visits: number, reviews: number, score: number, waClicks: number,
   *   conversionRate: number, active: boolean
   * }>} sources  - Array of source records enriched with analytics
   * @param {string} [filterType='']  - if non-empty, show only sources of this type
   */
  function renderSourceTable(sources = [], filterType = '') {
    const tbody = document.querySelector('#adm-source-table tbody');
    if (!tbody) {
      console.warn('[BSDashboard] #adm-source-table tbody not found');
      return;
    }

    const visible = filterType
      ? sources.filter((s) => s.type === filterType)
      : sources;

    if (visible.length === 0) {
      _setHtml(tbody, `<tr><td colspan="8" class="bs-empty">Tidak ada data${filterType ? ' untuk tipe "' + _escHtml(filterType) + '"' : ''}</td></tr>`);
      return;
    }

    const rows = visible
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((s) => {
        const statusBadge = s.active
          ? '<span class="bs-badge bs-badge-active">Aktif</span>'
          : '<span class="bs-badge bs-badge-inactive">Nonaktif</span>';
        const typeBadge = `<span class="bs-badge bs-badge-type-${_escHtml(s.type || 'unknown')}">${_escHtml(s.type || '—')}</span>`;

        return `
          <tr data-source-code="${_escHtml(s.code || '')}">
            <td>${_escHtml(s.name || s.code || '—')}</td>
            <td>${typeBadge}</td>
            <td>${_escHtml(s.outlet || '—')}</td>
            <td class="bs-num">${_fmt(s.visits)}</td>
            <td class="bs-num">${_fmt(s.reviews)}</td>
            <td class="bs-num">${_score(s.score)}</td>
            <td class="bs-num">${_pct(s.conversionRate)}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      });

    _setHtml(tbody, rows.join(''));
  }

  /* ─────────────────────────────────────────────
   * 5. CSV export
   * ───────────────────────────────────────────── */

  /**
   * Generate and trigger download of a CSV report from the current data.
   *
   * @param {Array<Object>} rows         - array of plain objects (any shape)
   * @param {string}        [filename]   - downloaded file name
   */
  function exportCsv(rows = [], filename) {
    if (!Array.isArray(rows) || rows.length === 0) {
      console.warn('[BSDashboard] exportCsv: no data to export');
      return;
    }

    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = (filename || 'bumi-surabaya-report-' + ts) + '.csv';

    // Derive headers from all keys present across all rows
    const headers = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((k) => set.add(k));
        return set;
      }, new Set())
    );

    const csvLines = [
      headers.map(_csvCell).join(','),
      ...rows.map((row) =>
        headers.map((h) => _csvCell(row[h] !== undefined ? row[h] : '')).join(',')
      ),
    ];

    const blob = new Blob(['\uFEFF' + csvLines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', safeName);
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release object URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /* ─────────────────────────────────────────────
   * Private helpers
   * ───────────────────────────────────────────── */

  /**
   * Escape a value for safe CSV cell output.
   * Mitigasi Formula Injection (ANA-07):
   * Sel yang diawali '=', '+', '-', '@', tab (\t), atau carriage return (\r)
   * diberi prefix tanda kutip satu (') agar dianggap sebagai string teks murni di Excel/Sheets.
   * @param {*} val
   * @returns {string}
   */
  function _csvCell(val) {
    let str = (val === null || val === undefined) ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * Format an ISO date string to short locale display e.g. "8 Okt".
   * @param {string} iso
   * @returns {string}
   */
  function _shortDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch (_) {
      return String(iso);
    }
  }

  /**
   * Minimal HTML escaping to prevent XSS when inserting dynamic values via innerHTML.
   * @param {string} str
   * @returns {string}
   */
  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ─────────────────────────────────────────────
   * Public API
   * ───────────────────────────────────────────── */

  global.BSDashboard = {
    renderMetrics,
    renderLeaderboard,
    renderTrendChart,
    renderSourceTable,
    exportCsv,
  };
})(window);
