/**
 * BUMI SURABAYA v6.8
 * dashboard.js — Admin dashboard rendering module (Anti-Slop Edition — FR-ADM-01 s/d FR-ADM-04, FR-V64-07)
 *
 * Renders metric cards, leaderboard, trend chart (Emerald & Champagne Gold palette),
 * and source analysis table with tabular numerals and zero decorative emojis or ticket codes.
 */

(function (global) {
  'use strict';

  const _chartRegistry = new Map();

  function _el(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn('[BSDashboard] Element #' + id + ' not found in DOM');
    }
    return el;
  }

  function _fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('id-ID');
  }

  function _pct(ratio, decimals = 1) {
    if (ratio === null || ratio === undefined || isNaN(ratio)) return '—';
    return (ratio * 100).toFixed(decimals) + '%';
  }

  function _score(score) {
    if (score === null || score === undefined || isNaN(score)) return '—';
    return Number(score).toFixed(2);
  }

  function _setHtml(el, html) {
    if (el) el.innerHTML = html;
  }

  function _trend(current, previous) {
    if (!previous || previous === 0) return { arrow: '', cls: '' };
    if (current > previous) return { arrow: ' ▲', cls: 'bs-trend-up' };
    if (current < previous) return { arrow: ' ▼', cls: 'bs-trend-down' };
    return { arrow: ' —', cls: '' };
  }

  /**
   * Render the five metric summary cards with clean executive copy (FR-ADM-02, FR-ADM-03).
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
        tooltip: 'Total event kunjungan (visit) yang valid setelah evaluasi anti-fraud pada periode terpilih.',
        ...( prev.totalVisits !== undefined
            ? _trend(totalVisits, prev.totalVisits)
            : {} ),
      },
      {
        id:      'adm-metric-score',
        label:   'Skor Kualitas Interaksi',
        value:   _score(qualityScore) + ' / 5',
        sub:     'Rata-rata tertimbang (skala 0–5)',
        tooltip: 'Skor kualitas interaksi valid: Kunjungan (+1), Scroll >50% (+1), Klik WA (+2), Promo/Outlet (+2), Klik Review (+3), Direct Feedback (+3).',
        ...( prev.qualityScore !== undefined
            ? _trend(qualityScore, prev.qualityScore)
            : {} ),
      },
      {
        id:      'adm-metric-reviews',
        label:   'Klik Google Review',
        value:   _fmt(totalReviews),
        sub:     'Intensi klik tombol ulasan Google',
        tooltip: 'Total klik tombol menuju halaman ulasan Google pada periode terpilih.',
        ...( prev.totalReviews !== undefined
            ? _trend(totalReviews, prev.totalReviews)
            : {} ),
      },
      {
        id:      'adm-metric-wa',
        label:   'Interaksi WhatsApp',
        value:   _fmt(waClicks),
        sub:     'Klik reservasi & sales concierge',
        tooltip: 'Total klik kontak WhatsApp sales dan reservasi hotel.',
        ...( prev.waClicks !== undefined
            ? _trend(waClicks, prev.waClicks)
            : {} ),
      },
      {
        id:      'adm-metric-conv',
        label:   'Rasio Konversi Ulasan',
        value:   _pct(conversionRate),
        sub:     'Proporsi klik ulasan per kunjungan',
        tooltip: 'Rasio klik Google Review dibagi total kunjungan valid × 100%.',
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
          <div class="adm-metric-label">${_escHtml(label)}</div>
          <div class="adm-metric-value">${_escHtml(String(value))}<span class="bs-metric-trend ${_escHtml(cls)}">${_escHtml(arrow)}</span></div>
          <div class="adm-metric-sub">${_escHtml(sub)}</div>
        `);
      }
    });
  }

  /**
   * Render staff and outlet leaderboard tables.
   */
  function renderLeaderboard(data = {}, topN = 10) {
    const { staffRanking = [], outletRanking = [] } = data;

    const staffEl = _el('adm-leaderboard-staff');
    if (staffEl) {
      const rows = staffRanking
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topN);

      if (rows.length === 0) {
        _setHtml(staffEl, '<tr><td colspan="5" class="bs-empty">Belum ada data atribusi staf pada periode ini.</td></tr>');
      } else {
        _setHtml(staffEl, rows.map((row, i) => `
          <tr class="${i === 0 ? 'bs-rank-1' : i === 1 ? 'bs-rank-2' : i === 2 ? 'bs-rank-3' : ''}">
            <td class="bs-rank-num bs-num">${i + 1}</td>
            <td class="bs-rank-name"><strong>${_escHtml(row.name || row.code || '—')}</strong></td>
            <td class="bs-rank-outlet">${_escHtml(row.outlet || '—')}</td>
            <td class="bs-rank-score bs-num">${_score(row.score)}</td>
            <td class="bs-rank-reviews bs-num">${_fmt(row.reviews)}</td>
          </tr>
        `).join(''));
      }
    }

    const outletEl = _el('adm-leaderboard-outlets');
    if (outletEl) {
      const rows = outletRanking
        .slice()
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, topN);

      if (rows.length === 0) {
        _setHtml(outletEl, '<tr><td colspan="4" class="bs-empty">Belum ada data atribusi gerai pada periode ini.</td></tr>');
      } else {
        _setHtml(outletEl, rows.map((row, i) => `
          <tr class="${i === 0 ? 'bs-rank-1' : i === 1 ? 'bs-rank-2' : i === 2 ? 'bs-rank-3' : ''}">
            <td class="bs-rank-num bs-num">${i + 1}</td>
            <td class="bs-rank-name"><strong>${_escHtml(row.name || '—')}</strong></td>
            <td class="bs-rank-score bs-num">${_score(row.score)}</td>
            <td class="bs-rank-reviews bs-num">${_fmt(row.reviews)}</td>
          </tr>
        `).join(''));
      }
    }
  }

  /**
   * Render a multi-dataset line chart of visits/reviews over time using Deep Emerald & Champagne Gold (FR-ADM-03, FR-V64-07).
   */
  function renderTrendChart(data = {}, period = '7d') {
    const canvas = _el('adm-trend-chart');
    if (!canvas) return;

    const sortedAll = (data.daily || [])
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const daily = period === 'custom'
      ? sortedAll
      : sortedAll.slice(-(period === '30d' ? 30 : 7));

    if (typeof global.Chart === 'undefined') {
      var parent = canvas.parentElement;
      if (parent) {
        var existingFb = parent.querySelector('.adm-chart-fallback');
        if (existingFb) existingFb.remove();
        canvas.style.display = 'none';
        var fb = document.createElement('div');
        fb.className = 'adm-chart-fallback';
        fb.style.cssText = 'padding:16px;background:#fcfbf9;border:1px solid #e5e2dc;border-radius:6px;font-size:0.85rem;color:#47544d;';
        var rowsHtml = daily.map(function(d){ return '<tr><td style="padding:6px 8px;">' + _shortDate(d.date) + '</td><td class="bs-num" style="padding:6px 8px;text-align:right;"><strong>' + (d.visits||0) + '</strong></td><td class="bs-num" style="padding:6px 8px;text-align:right;"><strong>' + (d.reviews||0) + '</strong></td></tr>'; }).join('');
        fb.innerHTML = '<div style="margin-bottom:8px;font-weight:600;color:#143323;">Ringkasan Tren Harian (' + period + ')</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.8rem;"><thead><tr style="border-bottom:1px solid #ddd;text-align:left;"><th style="padding:6px 8px;">Tanggal</th><th style="padding:6px 8px;text-align:right;">Kunjungan</th><th style="padding:6px 8px;text-align:right;">Klik Review</th></tr></thead><tbody>' +
          (rowsHtml || '<tr><td colspan="3" style="padding:8px;text-align:center;">Belum ada data harian</td></tr>') +
          '</tbody></table>';
        parent.appendChild(fb);
      }
      return;
    }

    canvas.style.display = '';
    var oldFb = canvas.parentElement ? canvas.parentElement.querySelector('.adm-chart-fallback') : null;
    if (oldFb) oldFb.remove();

    if (_chartRegistry.has('trend')) {
      _chartRegistry.get('trend').destroy();
      _chartRegistry.delete('trend');
    }

    const labels  = daily.map((d) => _shortDate(d.date));
    const visits  = daily.map((d) => d.visits  || 0);
    const reviews = daily.map((d) => d.reviews || 0);

    const chart = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label:                'Kunjungan Valid',
            data:                 visits,
            borderColor:          '#1a3c2a',
            backgroundColor:      'rgba(26, 60, 42, 0.08)',
            pointBackgroundColor: '#1a3c2a',
            borderWidth:          2,
            pointRadius:          3,
            tension:              0.25,
            fill:                 true,
          },
          {
            label:                'Klik Google Review',
            data:                 reviews,
            borderColor:          '#b08f51',
            backgroundColor:      'rgba(201, 169, 110, 0.14)',
            pointBackgroundColor: '#b08f51',
            borderWidth:          2,
            pointRadius:          3,
            tension:              0.25,
            fill:                 true,
          },
        ],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: {
          mode:      'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
            align:    'end',
            labels:   { usePointStyle: true, boxWidth: 8, color: '#1c2420', font: { size: 12, weight: '600' } },
          },
          tooltip: {
            backgroundColor: '#143323',
            titleColor:      '#dfc38d',
            bodyColor:       '#ffffff',
            borderColor:     'rgba(201,169,110,0.4)',
            borderWidth:     1,
            callbacks: {
              label: (ctx) => ' ' + ctx.dataset.label + ': ' + _fmt(ctx.parsed.y),
            },
          },
        },
        scales: {
          x: {
            grid:  { display: false },
            ticks: { maxTicksLimit: daily.length <= 7 ? 7 : 12, color: '#728078' },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: (val) => _fmt(val),
              maxTicksLimit: 6,
              color: '#728078',
            },
            grid: { color: '#efede6' },
          },
        },
      },
    });

    _chartRegistry.set('trend', chart);
  }

  /**
   * Render the per-source analysis table.
   */
  function renderSourceTable(sources = [], filterType = '') {
    const tbody = document.querySelector('#adm-source-table tbody');
    if (!tbody) return;

    const visible = filterType
      ? sources.filter((s) => s.type === filterType)
      : sources;

    if (visible.length === 0) {
      _setHtml(tbody, `<tr><td colspan="8" class="bs-empty">Tidak ada data${filterType ? ' untuk kategori "' + _escHtml(filterType) + '"' : ''}.</td></tr>`);
      return;
    }

    const rows = visible
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((s) => {
        const statusBadge = s.active
          ? '<span class="adm-badge-ok">Aktif</span>'
          : '<span class="adm-badge-err">Nonaktif</span>';
        const typeBadge = `<span class="adm-role-tag">${_escHtml(s.type || '—')}</span>`;

        return `
          <tr data-source-code="${_escHtml(s.code || '')}">
            <td><strong>${_escHtml(s.name || s.code || '—')}</strong><br><code style="font-size:0.74rem;color:#728078;">${_escHtml(s.code || '')}</code></td>
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

  function exportCsv(rows = [], filename) {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const ts       = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = (filename || 'bumi-surabaya-report-' + ts) + '.csv';

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

    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

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

  function _shortDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    } catch (_) {
      return String(iso);
    }
  }

  function _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.BSDashboard = {
    renderMetrics,
    renderLeaderboard,
    renderTrendChart,
    renderSourceTable,
    exportCsv,
  };
})(window);
