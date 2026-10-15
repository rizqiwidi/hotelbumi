/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.4
 * admin-reports.js — Analitik, Filter Rentang Tanggal Kustom, MonthlyAggregates, Ekspor CSV & Cetak QR Massal (FR-P1-05, FR-V64-07)
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /**
   * Filter state.events berdasarkan rentang tanggal kustom (FR-V64-07)
   */
  function getFilteredEvents() {
    var all = Array.isArray(state.events) ? state.events : [];
    var fromStr = (state.dateFrom || '').trim();
    var toStr   = (state.dateTo   || '').trim();
    if (!fromStr && !toStr) return all;

    var fromMs = fromStr ? new Date(fromStr + 'T00:00:00').getTime() : 0;
    var toMs   = toStr   ? new Date(toStr   + 'T23:59:59.999').getTime() : Infinity;

    return all.filter(function (ev) {
      var rawTs = ev.ts_server || ev.ts_client || '';
      if (!rawTs) return false;
      var t = new Date(rawTs).getTime();
      if (isNaN(t)) return false;
      return t >= fromMs && t <= toMs;
    });
  }

  function applyDateRangeFilter() {
    var fromEl = $id('adm-date-from');
    var toEl   = $id('adm-date-to');
    var fromVal = fromEl ? (fromEl.value || '').trim() : '';
    var toVal   = toEl   ? (toEl.value   || '').trim() : '';

    if (fromVal && toVal && fromVal > toVal) {
      BSAdmin.showToast('Tanggal "Dari" tidak boleh lebih akhir dari tanggal "Sampai".', 'error');
      return;
    }

    state.dateFrom = fromVal;
    state.dateTo   = toVal;

    if (fromVal || toVal) {
      setPeriod('custom');
      BSAdmin.showToast('Filter rentang tanggal diterapkan (' + (fromVal || 'Awal') + ' s/d ' + (toVal || 'Sekarang') + ').', 'info');
    } else {
      setPeriod('7d');
    }

    if (BSAdmin.fraud && typeof BSAdmin.fraud.reEvaluateFraud === 'function') {
      BSAdmin.fraud.reEvaluateFraud();
    }
  }

  function resetDateRangeFilter() {
    state.dateFrom = '';
    state.dateTo   = '';
    if ($id('adm-date-from')) $id('adm-date-from').value = '';
    if ($id('adm-date-to'))   $id('adm-date-to').value   = '';
    setPeriod('7d');
    if (BSAdmin.fraud && typeof BSAdmin.fraud.reEvaluateFraud === 'function') {
      BSAdmin.fraud.reEvaluateFraud();
    }
    BSAdmin.showToast('Rentang tanggal dikembalikan ke default (7 Hari).', 'info');
  }

  /**
   * Render Tabel Ringkasan Historis Bulanan (MonthlyAggregates — FR-V64-07)
   */
  function renderMonthlyAggregates() {
    var tbody = $id('adm-monthly-aggregates-tbody');
    if (!tbody) return;

    var rows = Array.isArray(state.monthlyAggregates) ? state.monthlyAggregates.slice() : [];

    // Jika lembar MonthlyAggregates belum memiliki baris arsip, hitung agregasi bulanan langsung dari state.events aktif
    if (rows.length === 0 && Array.isArray(state.events) && state.events.length > 0) {
      var byMonth = {};
      state.events.forEach(function (ev) {
        var rawTs = ev.ts_server || ev.ts_client || '';
        if (!rawTs || String(rawTs).length < 7) return;
        var ym = String(rawTs).substring(0, 7);
        if (!/^\d{4}-\d{2}$/.test(ym)) return;
        if (!byMonth[ym]) {
          byMonth[ym] = { month: ym, total_events: 0, valid_events: 0, visits: 0, review_clicks: 0, wa_clicks: 0, scoreSum: 0, archived_at: 'Aktif (Berjalan)' };
        }
        var m = byMonth[ym];
        m.total_events++;
        var isValid = (ev.valid === true || String(ev.valid).toLowerCase() === 'true' || ev.valid === undefined);
        if (isValid) {
          m.valid_events++;
          var et = String(ev.event_type || '');
          if (et === 'visit')        m.visits++;
          if (et === 'review_click') m.review_clicks++;
          if (et === 'wa_click')     m.wa_clicks++;
          m.scoreSum += Number(ev.quality_score || 0);
        }
      });
      rows = Object.keys(byMonth).sort().reverse().map(function (ym) {
        var m = byMonth[ym];
        return {
          month: ym,
          total_events: m.total_events,
          valid_events: m.valid_events,
          visits: m.visits,
          review_clicks: m.review_clicks,
          wa_clicks: m.wa_clicks,
          avg_quality_score: m.valid_events > 0 ? Number((m.scoreSum / m.valid_events).toFixed(2)) : 0,
          archived_at: m.archived_at
        };
      });
    }

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="bs-empty">Belum ada data agregasi bulanan di lembar MonthlyAggregates maupun event berjalan.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(function (r) {
      var archTs = r.archived_at && r.archived_at !== 'Aktif (Berjalan)'
        ? new Date(r.archived_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
        : (r.archived_at || '—');
      return '<tr>' +
        '<td><strong>' + esc(r.month || '—') + '</strong></td>' +
        '<td class="bs-num">' + Number(r.total_events || 0).toLocaleString('id-ID') + '</td>' +
        '<td class="bs-num">' + Number(r.valid_events || 0).toLocaleString('id-ID') + '</td>' +
        '<td class="bs-num">' + Number(r.visits || 0).toLocaleString('id-ID') + '</td>' +
        '<td class="bs-num">' + Number(r.review_clicks || 0).toLocaleString('id-ID') + '</td>' +
        '<td class="bs-num">' + Number(r.wa_clicks || 0).toLocaleString('id-ID') + '</td>' +
        '<td class="bs-num">' + Number(r.avg_quality_score || 0).toFixed(2) + '</td>' +
        '<td style="font-size:0.78rem;color:var(--adm-text-muted);">' + esc(archTs) + '</td>' +
      '</tr>';
    }).join('');
  }

  function setPeriod(period) {
    state.currentPeriod = period;
    var btn7d  = $id('adm-trend-7d');
    var btn30d = $id('adm-trend-30d');
    if (btn7d)  btn7d.classList.toggle('adm-btn-primary', period === '7d');
    if (btn7d)  btn7d.classList.toggle('adm-btn-secondary', period !== '7d');
    if (btn30d) btn30d.classList.toggle('adm-btn-primary', period === '30d');
    if (btn30d) btn30d.classList.toggle('adm-btn-secondary', period !== '30d');

    if (state.evalResult && window.BSDashboard) {
      BSDashboard.renderTrendChart({ daily: state.evalResult.daily || [] }, period);
    }
  }

  function setFilter(filterType) {
    state.currentFilter = filterType;
    document.querySelectorAll('[data-filter]').forEach(function (btn) {
      var isMatch = (btn.dataset.filter === filterType);
      btn.className = isMatch
        ? 'adm-btn adm-btn-xs adm-btn-primary'
        : 'adm-btn adm-btn-xs adm-btn-secondary';
    });
    if (state.evalResult && window.BSDashboard) {
      BSDashboard.renderSourceTable(state.evalResult.sources || [], filterType);
    }
  }

  var FAVORITE_STORAGE_KEY = 'bs_admin_favorite_filter';

  function applyPreset(presetKey) {
    if (presetKey === 'staff_7d') {
      setPeriod('7d');
      setFilter('staff');
      BSAdmin.showToast('Filter diterapkan: Staf (7 Hari Terakhir).', 'info');
    } else if (presetKey === 'outlets_30d') {
      setPeriod('30d');
      setFilter('outlet');
      BSAdmin.showToast('Filter diterapkan: Gerai F&B (30 Hari Terakhir).', 'info');
    } else if (presetKey === 'all_30d') {
      setPeriod('30d');
      setFilter('');
      BSAdmin.showToast('Filter diterapkan: Semua Sumber (30 Hari).', 'info');
    } else if (presetKey === 'custom_saved') {
      loadSavedFavorite();
    }
  }

  function saveCurrentAsFavorite() {
    try {
      var fav = {
        period: state.currentPeriod || '7d',
        filter: state.currentFilter || '',
        dateFrom: state.dateFrom || '',
        dateTo: state.dateTo || '',
        savedAt: new Date().toISOString()
      };
      if (window.localStorage) {
        localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(fav));
      }
      BSAdmin.showToast('Filter saat ini (' + fav.period + ' / ' + (fav.filter || 'Semua') + ') disimpan sebagai favorit.', 'success');
      updateFavoriteBtnState();
    } catch (_) {
      BSAdmin.showToast('Gagal menyimpan filter favorit ke peramban.', 'error');
    }
  }

  function loadSavedFavorite() {
    try {
      var raw = window.localStorage && localStorage.getItem(FAVORITE_STORAGE_KEY);
      if (!raw) {
        BSAdmin.showToast('Belum ada filter favorit yang disimpan.', 'info');
        return;
      }
      var fav = JSON.parse(raw);
      if (fav.dateFrom !== undefined && $id('adm-date-from')) $id('adm-date-from').value = fav.dateFrom;
      if (fav.dateTo !== undefined && $id('adm-date-to'))     $id('adm-date-to').value   = fav.dateTo;
      state.dateFrom = fav.dateFrom || '';
      state.dateTo   = fav.dateTo   || '';
      if (fav.period) setPeriod(fav.period);
      if (typeof fav.filter !== 'undefined') setFilter(fav.filter);
      if (BSAdmin.fraud && typeof BSAdmin.fraud.reEvaluateFraud === 'function') {
        BSAdmin.fraud.reEvaluateFraud();
      }
      BSAdmin.showToast('Filter favorit dimuat: ' + fav.period + ' / ' + (fav.filter || 'Semua') + '.', 'success');
    } catch (_) {
      BSAdmin.showToast('Gagal memuat filter favorit.', 'error');
    }
  }

  function updateFavoriteBtnState() {
    var loadBtn = $id('adm-load-fav-btn');
    if (!loadBtn) return;
    var raw = window.localStorage && localStorage.getItem(FAVORITE_STORAGE_KEY);
    if (raw) {
      try {
        var fav = JSON.parse(raw);
        loadBtn.title = 'Muat favorit tersimpan: ' + fav.period + ' | ' + (fav.filter || 'Semua');
        loadBtn.style.display = 'inline-flex';
      } catch (_) {
        loadBtn.style.display = 'none';
      }
    } else {
      loadBtn.style.display = 'none';
    }
  }

  function populateMonthSelect(tabs) {
    var monthSelect = $id('adm-month-select');
    if (!monthSelect) return;
    var current = monthSelect.value;
    monthSelect.innerHTML = '';
    (tabs || []).slice().reverse().forEach(function (t) {
      var opt = document.createElement('option');
      opt.value = t; opt.textContent = t;
      monthSelect.appendChild(opt);
    });
    if (current && tabs.indexOf(current) !== -1) monthSelect.value = current;
    else if (tabs && tabs.length > 0) monthSelect.value = tabs[tabs.length - 1];
  }

  function exportEventsCsv() {
    var evs = getFilteredEvents();
    if (!evs || evs.length === 0) {
      BSAdmin.showToast('Tidak ada data event untuk diekspor.', 'error');
      return;
    }
    if (window.BSDashboard && typeof BSDashboard.exportCsv === 'function') {
      BSDashboard.exportCsv(evs, 'bumi-surabaya-events-' + (state.currentPeriod || 'all'));
      BSAdmin.showToast('Berkas CSV berhasil diunduh (' + evs.length + ' baris).', 'success');
    }
  }

  /**
   * Cetak QR Massal & Pilihan Tata Letak (FR-P1-05)
   */
  function renderBulkQr() {
    var container = $id('adm-bulk-cards-container');
    if (!container) return;

    var filterType      = ($id('adm-bulk-filter-select') ? $id('adm-bulk-filter-select').value : 'all') || 'all';
    var format          = ($id('adm-print-format-select') ? $id('adm-print-format-select').value : 'card') || 'card';
    var searchQuery     = ($id('adm-bulk-search') ? $id('adm-bulk-search').value : '').trim().toLowerCase();
    var onlyReprint     = ($id('adm-bulk-reprint-only') ? $id('adm-bulk-reprint-only').checked : false);
    var includeArchived = ($id('adm-bulk-include-archived') ? $id('adm-bulk-include-archived').checked : false);

    var allSources = [];
    if (window.BSStaffManager && typeof BSStaffManager.getSources === 'function') {
      allSources = BSStaffManager.getSources();
    }

    var sources = allSources.filter(function (s) {
      if (!includeArchived && !s.active) return false;
      if (onlyReprint && !s.needs_reprint) return false;
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (searchQuery) {
        var matchName   = (s.name || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchCode   = (s.code || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchRole   = (s.role || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchOutlet = (s.outlet || '').toLowerCase().indexOf(searchQuery) !== -1;
        if (!matchName && !matchCode && !matchRole && !matchOutlet) return false;
      }
      return true;
    });

    var countEl = $id('adm-bulk-count-info');
    if (countEl) {
      countEl.textContent = 'Menampilkan ' + sources.length + ' dari ' + allSources.length + ' sumber.';
    }

    // Pertahankan class adm-bulk-preview-grid agar grid CSS dan print.css aktif (FR-P1-05)
    container.className = 'adm-bulk-preview-grid adm-bulk-cards-grid print-layout-' + format;

    if (sources.length === 0) {
      container.innerHTML = '<p class="bs-empty" style="grid-column:1/-1;">Tidak ada sumber yang cocok dengan kriteria filter.</p>';
      return;
    }

    container.innerHTML = '';
    var appRoot = (window.BSConfig && BSConfig.appRoot) ? BSConfig.appRoot() : '/';
    var origin = (window.location.origin + appRoot).replace(/\/+$/, '') + '/';

    sources.forEach(function (s, index) {
      var fullUrl = origin + '?source=' + encodeURIComponent(s.code);
      var subText = (s.type === 'staff')
        ? ((s.role || 'Staf Hotel') + (s.outlet ? ' · ' + s.outlet : ''))
        : (s.type === 'sales'
            ? ((s.role || 'Sales Representative') + (s.outlet ? ' · ' + s.outlet : ''))
            : (s.outlet || s.role || 'Meja Tamu'));
      var instText = (s.type === 'staff')
        ? 'ID Badge Resmi Staf Bumi Surabaya City Resort'
        : 'Tap kartu NFC atau pindai QR code untuk pelayanan';
      var reprintBadge = s.needs_reprint
        ? '<div class="no-print" style="margin-top:4px;"><span class="adm-badge-err" style="font-size:0.68rem;padding:2px 6px;">Perlu Cetak Ulang</span></div>'
        : '';
      var inactiveBadge = !s.active
        ? '<div class="no-print" style="margin-top:4px;"><span class="adm-badge-warn" style="font-size:0.68rem;padding:2px 6px;">Sumber Nonaktif</span></div>'
        : '';

      var cardEl = document.createElement('div');

      if (format === 'tent') {
        cardEl.className = 'print-tent-card';
        cardEl.innerHTML =
          '<div class="print-tent-half flip">' +
            '<div class="adm-pc-title">' + esc(s.name) + '</div>' +
            '<div class="adm-pc-sub">' + esc(subText) + '</div>' +
            reprintBadge + inactiveBadge +
            '<div class="adm-pc-qr" id="bulk-qr-top-' + index + '"></div>' +
          '</div>' +
          '<div class="print-tent-half">' +
            '<div class="adm-pc-logo"><img src="../assets/images/logo-hotel.png" alt="Logo" width="90"></div>' +
            '<div class="adm-pc-title">' + esc(s.name) + '</div>' +
            reprintBadge + inactiveBadge +
            '<div class="adm-pc-qr" id="bulk-qr-bot-' + index + '"></div>' +
            '<div class="adm-pc-inst">' + esc(instText) + '</div>' +
          '</div>';
        container.appendChild(cardEl);

        if (typeof QRCode !== 'undefined') {
          var topEl = $id('bulk-qr-top-' + index);
          var botEl = $id('bulk-qr-bot-' + index);
          if (topEl) new QRCode(topEl, { text: fullUrl, width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M });
          if (botEl) new QRCode(botEl, { text: fullUrl, width: 80, height: 80, correctLevel: QRCode.CorrectLevel.M });
        }
      } else if (format === 'sticker') {
        cardEl.className = 'adm-print-sticker print-sticker';
        cardEl.innerHTML =
          '<div class="adm-pc-qr" id="bulk-qr-' + index + '"></div>' +
          '<div class="adm-pc-title" style="font-size:0.85rem;margin-top:4px;">' + esc(s.name) + '</div>' +
          '<div class="adm-pc-sub" style="font-size:0.7rem;"><code>' + esc(s.code) + '</code></div>' +
          reprintBadge + inactiveBadge;
        container.appendChild(cardEl);

        if (typeof QRCode !== 'undefined') {
          var qrElSticker = $id('bulk-qr-' + index);
          if (qrElSticker) new QRCode(qrElSticker, { text: fullUrl, width: 85, height: 85, correctLevel: QRCode.CorrectLevel.M });
        }
      } else if (format === 'a4grid') {
        cardEl.className = 'adm-print-a4-cell print-card-grid';
        cardEl.innerHTML =
          '<div class="adm-pc-logo"><img src="../assets/images/logo-hotel.png" alt="Logo" width="90"></div>' +
          '<div class="adm-pc-qr" id="bulk-qr-' + index + '"></div>' +
          '<div class="adm-pc-title">' + esc(s.name) + '</div>' +
          '<div class="adm-pc-sub">' + esc(subText) + '</div>' +
          reprintBadge + inactiveBadge +
          '<div class="adm-pc-inst">' + esc(instText) + '</div>';
        container.appendChild(cardEl);

        if (typeof QRCode !== 'undefined') {
          var qrElGrid = $id('bulk-qr-' + index);
          if (qrElGrid) new QRCode(qrElGrid, { text: fullUrl, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M });
        }
      } else {
        cardEl.className = 'adm-print-card-sample print-card';
        cardEl.innerHTML =
          '<div class="adm-pc-logo"><img src="../assets/images/logo-hotel.png" alt="Logo" width="110"></div>' +
          '<div class="adm-pc-qr" id="bulk-qr-' + index + '"></div>' +
          '<div class="adm-pc-title">' + esc(s.name) + '</div>' +
          '<div class="adm-pc-sub">' + esc(subText) + '</div>' +
          reprintBadge + inactiveBadge +
          '<div class="adm-pc-inst">' + esc(instText) + '</div>';
        container.appendChild(cardEl);

        if (typeof QRCode !== 'undefined') {
          var qrElCard = $id('bulk-qr-' + index);
          if (qrElCard) new QRCode(qrElCard, { text: fullUrl, width: 95, height: 95, correctLevel: QRCode.CorrectLevel.M });
        }
      }
    });
  }

  function init() {
    var btn7d = $id('adm-trend-7d');
    if (btn7d) btn7d.addEventListener('click', function () { setPeriod('7d'); });
    var btn30d = $id('adm-trend-30d');
    if (btn30d) btn30d.addEventListener('click', function () { setPeriod('30d'); });

    var dateApplyBtn = $id('adm-date-apply-btn');
    if (dateApplyBtn) dateApplyBtn.addEventListener('click', applyDateRangeFilter);
    var dateResetBtn = $id('adm-date-reset-btn');
    if (dateResetBtn) dateResetBtn.addEventListener('click', resetDateRangeFilter);

    document.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.dataset.filter);
      });
    });

    var btnSaveFav = $id('adm-save-fav-btn');
    if (btnSaveFav) btnSaveFav.addEventListener('click', saveCurrentAsFavorite);
    var btnLoadFav = $id('adm-load-fav-btn');
    if (btnLoadFav) btnLoadFav.addEventListener('click', loadSavedFavorite);

    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.dataset.preset);
      });
    });
    updateFavoriteBtnState();

    var monthSelect = $id('adm-month-select');
    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        BSAdmin.loadDashboard();
      });
    }

    var exportBtn = $id('adm-export-csv-btn') || $id('adm-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportEventsCsv);
    var exportBtnAlt = $id('adm-export-btn');
    if (exportBtnAlt && exportBtnAlt !== exportBtn) exportBtnAlt.addEventListener('click', exportEventsCsv);

    var filterSel = $id('adm-bulk-filter-select');
    if (filterSel) filterSel.addEventListener('change', renderBulkQr);

    var formatSel = $id('adm-print-format-select');
    if (formatSel) formatSel.addEventListener('change', renderBulkQr);

    var searchInput = $id('adm-bulk-search');
    if (searchInput) searchInput.addEventListener('input', renderBulkQr);

    var reprintCheck = $id('adm-bulk-reprint-only');
    if (reprintCheck) reprintCheck.addEventListener('change', renderBulkQr);

    var archivedCheck = $id('adm-bulk-include-archived');
    if (archivedCheck) archivedCheck.addEventListener('change', renderBulkQr);

    var printBtn = $id('adm-bulk-print-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        document.body.classList.remove('print-single-qr');
        window.print();
      });
    }
  }

  BSAdmin.reports = {
    setPeriod:               setPeriod,
    setFilter:               setFilter,
    getFilteredEvents:       getFilteredEvents,
    applyDateRangeFilter:    applyDateRangeFilter,
    resetDateRangeFilter:    resetDateRangeFilter,
    renderMonthlyAggregates: renderMonthlyAggregates,
    applyPreset:             applyPreset,
    saveFavorite:            saveCurrentAsFavorite,
    loadFavorite:            loadSavedFavorite,
    populateMonthSelect:     populateMonthSelect,
    exportCsv:               exportEventsCsv,
    renderBulkQr:            renderBulkQr,
    init:                    init
  };

  window.BSAdmin = BSAdmin;

})(window);
