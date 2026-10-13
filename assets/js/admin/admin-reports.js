/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-reports.js — Analitik, Filter Favorit (ANA-10), Ekspor CSV & Cetak QR Massal (QRN-06)
 *
 * Mengelola tab dashboard (filter periode, tren, preset favorit),
 * ekspor CSV laporan, dan generator cetak QR batch dengan aneka tata letak.
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* ─────────────────────────────────────────────────────────────
   * 1. Navigasi & Filter Dashboard (Periode & Kategori)
   * ───────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────
   * 2. Filter Favorit & Preset Analitik Cepat (ANA-10)
   * ───────────────────────────────────────────────────────────── */
  var FAVORITE_STORAGE_KEY = 'bs_admin_favorite_filter';

  function applyPreset(presetKey) {
    if (presetKey === 'staff_7d') {
      setPeriod('7d');
      setFilter('staff');
      BSAdmin.showToast('Filter diterapkan: Staf (7 Hari Terakhir)', 'info');
    } else if (presetKey === 'outlets_30d') {
      setPeriod('30d');
      setFilter('outlet');
      BSAdmin.showToast('Filter diterapkan: Gerai F&B (30 Hari Terakhir)', 'info');
    } else if (presetKey === 'all_30d') {
      setPeriod('30d');
      setFilter('');
      BSAdmin.showToast('Filter diterapkan: Semua Sumber (30 Hari)', 'info');
    } else if (presetKey === 'custom_saved') {
      loadSavedFavorite();
    }
  }

  function saveCurrentAsFavorite() {
    try {
      var fav = {
        period: state.currentPeriod || '7d',
        filter: state.currentFilter || '',
        savedAt: new Date().toISOString()
      };
      if (window.localStorage) {
        localStorage.setItem(FAVORITE_STORAGE_KEY, JSON.stringify(fav));
      }
      BSAdmin.showToast('⭐ Filter saat ini (' + fav.period + ' / ' + (fav.filter || 'Semua') + ') disimpan sebagai favorit!', 'success');
      updateFavoriteBtnState();
    } catch (_) {
      BSAdmin.showToast('Gagal menyimpan filter favorit ke peramban.', 'error');
    }
  }

  function loadSavedFavorite() {
    try {
      var raw = window.localStorage && localStorage.getItem(FAVORITE_STORAGE_KEY);
      if (!raw) {
        BSAdmin.showToast('Belum ada filter favorit yang disimpan. Gunakan tombol "⭐ Simpan Favorit".', 'info');
        return;
      }
      var fav = JSON.parse(raw);
      if (fav.period) setPeriod(fav.period);
      if (typeof fav.filter !== 'undefined') setFilter(fav.filter);
      BSAdmin.showToast('⭐ Filter favorit dimuat: ' + fav.period + ' / ' + (fav.filter || 'Semua'), 'success');
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
        loadBtn.style.display = 'inline-block';
      } catch (_) {
        loadBtn.style.display = 'none';
      }
    } else {
      loadBtn.style.display = 'none';
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Pemilihan Bulan Arsip
   * ───────────────────────────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────────────────────
   * 4. Ekspor CSV dengan Perlindungan Formula Injection (ANA-10)
   * ───────────────────────────────────────────────────────────── */
  function exportEventsCsv() {
    if (!state.events || state.events.length === 0) {
      BSAdmin.showToast('Tidak ada data event untuk diekspor.', 'error');
      return;
    }
    if (window.BSDashboard && typeof BSDashboard.exportCsv === 'function') {
      BSDashboard.exportCsv(state.events, 'bumi-surabaya-events-' + (state.currentPeriod || 'all'));
      BSAdmin.showToast('File CSV berhasil diunduh.', 'success');
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 5. Cetak QR Massal & Pilihan Tata Letak (QRN-06)
   *    Layouts:
   *    - card: Kartu Nama Staf (85x55mm)
   *    - tent: Tent Card Lipat Dua Meja Tamu (A6 Lipat)
   *    - sticker: Stiker Meja Compact (50x50mm)
   *    - a4grid: Lembar A4 Grid (8 kartu per halaman)
   * ───────────────────────────────────────────────────────────── */
  function renderBulkQr() {
    var container = $id('adm-bulk-cards-container');
    if (!container) return;

    var filterType = ($id('adm-bulk-filter-select') ? $id('adm-bulk-filter-select').value : 'all') || 'all';
    var format = ($id('adm-print-format-select') ? $id('adm-print-format-select').value : 'card') || 'card';
    var searchQuery = ($id('adm-bulk-search') ? $id('adm-bulk-search').value : '').trim().toLowerCase();
    var onlyReprint = ($id('adm-bulk-reprint-only') ? $id('adm-bulk-reprint-only').checked : false);
    var includeArchived = ($id('adm-bulk-include-archived') ? $id('adm-bulk-include-archived').checked : false);

    // Ambil sumber data
    var allSources = [];
    if (window.BSStaffManager && typeof BSStaffManager.getSources === 'function') {
      allSources = BSStaffManager.getSources();
    }

    var sources = allSources.filter(function (s) {
      if (!includeArchived && !s.active) return false;
      if (onlyReprint && !s.needs_reprint) return false;
      if (filterType !== 'all' && s.type !== filterType) return false;
      if (searchQuery) {
        var matchName = (s.name || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchCode = (s.code || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchRole = (s.role || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchOutlet = (s.outlet || '').toLowerCase().indexOf(searchQuery) !== -1;
        if (!matchName && !matchCode && !matchRole && !matchOutlet) return false;
      }
      return true;
    });

    // Update info hitungan sumber
    var countEl = $id('adm-bulk-count-info');
    if (countEl) {
      countEl.textContent = 'Menampilkan ' + sources.length + ' dari ' + allSources.length + ' sumber.';
    }

    if (sources.length === 0) {
      container.innerHTML = '<p class="bs-empty" style="grid-column:1/-1;">Tidak ada sumber yang cocok dengan kriteria filter.</p>';
      return;
    }

    container.innerHTML = '';
    var appRoot = (window.BSConfig && BSConfig.appRoot) ? BSConfig.appRoot() : '/';
    var origin = (window.location.origin + appRoot).replace(/\/+$/, '') + '/';

    // Set class container sesuai tata letak cetak
    container.className = 'adm-bulk-cards-grid print-layout-' + format;

    sources.forEach(function (s, index) {
      var fullUrl = origin + '?source=' + encodeURIComponent(s.code);
      var subText = (s.type === 'staff')
        ? ((s.role || 'Staf Hotel') + (s.outlet ? ' · ' + s.outlet : ''))
        : (s.type === 'sales'
            ? ((s.role || 'Sales Representative') + (s.outlet ? ' · ' + s.outlet : ''))
            : (s.outlet || s.role || 'Meja Tamu'));
      var instText = (s.type === 'staff')
        ? 'ID Badge Resmi Staf Bumi Surabaya City Resort'
        : 'Tap kartu NFC atau scan QR code untuk pelayanan';
      var reprintBadge = s.needs_reprint
        ? '<div style="margin-top:4px;"><span class="adm-badge-err" style="font-size:0.68rem;padding:2px 6px;">⚠️ Perlu Dicetak Ulang</span></div>'
        : '';
      var inactiveBadge = !s.active
        ? '<div style="margin-top:4px;"><span class="adm-badge-warn" style="font-size:0.68rem;padding:2px 6px;">🚫 Sumber Nonaktif</span></div>'
        : '';

      var cardEl = document.createElement('div');

      if (format === 'tent') {
        // A6 Tent Card Lipat Dua
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
        // Stiker Meja 50x50mm Compact
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
        // A4 Grid 8 Kartu
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
        // Default Kartu Nama 85x55mm
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

  /* ─────────────────────────────────────────────────────────────
   * 6. Binding Event Listener Modul Reports
   * ───────────────────────────────────────────────────────────── */
  function init() {
    // Tombol tren periode
    var btn7d = $id('adm-trend-7d');
    if (btn7d) {
      btn7d.addEventListener('click', function () { setPeriod('7d'); });
    }
    var btn30d = $id('adm-trend-30d');
    if (btn30d) {
      btn30d.addEventListener('click', function () { setPeriod('30d'); });
    }

    // Tombol filter kategori
    document.querySelectorAll('[data-filter]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        setFilter(btn.dataset.filter);
      });
    });

    // Preset filter favorit (ANA-10)
    var btnSaveFav = $id('adm-save-fav-btn');
    if (btnSaveFav) {
      btnSaveFav.addEventListener('click', saveCurrentAsFavorite);
    }
    var btnLoadFav = $id('adm-load-fav-btn');
    if (btnLoadFav) {
      btnLoadFav.addEventListener('click', loadSavedFavorite);
    }
    document.querySelectorAll('[data-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyPreset(btn.dataset.preset);
      });
    });
    updateFavoriteBtnState();

    // Dropdown bulan
    var monthSelect = $id('adm-month-select');
    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        BSAdmin.loadDashboard();
      });
    }

    // Ekspor CSV
    var exportBtn = $id('adm-export-csv-btn') || $id('adm-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportEventsCsv);
    }
    var exportBtnAlt = $id('adm-export-btn');
    if (exportBtnAlt && exportBtnAlt !== exportBtn) {
      exportBtnAlt.addEventListener('click', exportEventsCsv);
    }

    // Bulk QR controls (QRN-06)
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
        window.print();
      });
    }
  }

  // Ekspor API modul
  BSAdmin.reports = {
    setPeriod:           setPeriod,
    setFilter:           setFilter,
    applyPreset:         applyPreset,
    saveFavorite:        saveCurrentAsFavorite,
    loadFavorite:        loadSavedFavorite,
    populateMonthSelect: populateMonthSelect,
    exportCsv:           exportEventsCsv,
    renderBulkQr:        renderBulkQr,
    init:                init
  };

  window.BSAdmin = BSAdmin;

})(window);
