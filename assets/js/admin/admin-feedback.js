/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (REV-02)
 * admin-feedback.js — Feedback Langsung Tamu
 *
 * Menampilkan daftar feedback dari tombol "Direct Feedback" di halaman tamu:
 * filter status/rating/outlet, badge belum dibaca, tandai handled.
 * Akses baca & mutasi hanya untuk super_admin & manager (ditegakkan di backend).
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  var items = [];

  /* ─────────────────────────────────────────────────────────────
   * 1. Pemuatan data dari server
   * ───────────────────────────────────────────────────────────── */
  function load() {
    var tbody = $id('adm-feedback-tbody');
    var refreshBtn = $id('adm-feedback-refresh-btn');

    if (!BSAdmin.checkPermission || !BSAdmin.checkPermission('view_feedback')) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">Peran Anda (' +
          esc(state.userRole || BSAuth && BSAuth.getRole()) +
          ') tidak memiliki izin untuk melihat feedback tamu.</td></tr>';
      }
      updateBadge(0);
      return;
    }

    if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '🔄 Memuat…'; }
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">⏳ Memuat feedback dari server…</td></tr>';
    }

    var filters = {
      status: $id('adm-feedback-filter-status') ? $id('adm-feedback-filter-status').value : '',
      rating: $id('adm-feedback-filter-rating') ? $id('adm-feedback-filter-rating').value : 0,
      outlet: $id('adm-feedback-filter-outlet') ? $id('adm-feedback-filter-outlet').value : ''
    };

    if (!window.BSApi || typeof BSApi.getFeedbackData !== 'function') {
      if (tbody) tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">API feedback tidak tersedia.</td></tr>';
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '🔄 Perbarui'; }
      return;
    }

    BSApi.getFeedbackData(filters).then(function (resp) {
      if (resp && resp.ok) {
        items = resp.items || [];
        renderTable();
        updateBadge(resp.unread || 0);
        var info = $id('adm-feedback-count-info');
        if (info) info.textContent = items.length + ' dari ' + (resp.total || 0) + ' masukan';
        populateOutletFilter();
      } else {
        throw new Error((resp && resp.error) || 'Gagal memuat feedback dari server');
      }
    }).catch(function (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">❌ ' + esc(err.message) + '</td></tr>';
      }
      if (BSAdmin.showToast) BSAdmin.showToast('Gagal memuat feedback: ' + err.message, 'error');
    }).then(function () {
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '🔄 Perbarui'; }
    });
  }

  function updateBadge(unread) {
    var badge = $id('adm-feedback-badge');
    if (!badge) return;
    if (unread > 0) {
      badge.style.display = '';
      badge.textContent = unread > 99 ? '99+' : String(unread);
      badge.title = unread + ' feedback belum dibaca';
    } else {
      badge.style.display = 'none';
    }
  }

  function populateOutletFilter() {
    var sel = $id('adm-feedback-filter-outlet');
    if (!sel) return;
    var seen = {};
    items.forEach(function (it) {
      if (it.outlet) seen[it.outlet] = true;
    });
    var cur = sel.value;
    sel.innerHTML = '<option value="">Semua Outlet</option>';
    Object.keys(seen).sort().forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o; opt.textContent = o;
      sel.appendChild(opt);
    });
    if (cur && seen[cur]) sel.value = cur;
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Render tabel
   * ───────────────────────────────────────────────────────────── */
  function starText(n) {
    n = Math.max(0, Math.min(5, parseInt(n, 10) || 0));
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= n ? '★' : '☆';
    return s;
  }

  function renderTable() {
    var tbody = $id('adm-feedback-tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">Belum ada feedback tamu.</td></tr>';
      return;
    }
    var html = items.map(function (it) {
      var statusBadge = it.status === 'handled'
        ? '<span class="adm-badge-ok">Ditangani</span>'
        : '<span class="adm-badge-warn">Belum dibaca</span>';
      var actionBtn = it.status === 'handled'
        ? '—'
        : '<button class="adm-btn adm-btn-secondary adm-btn-mutate" data-fb-row="' + it.row + '">✓ Tandai ditangani</button>';
      return '<tr>' +
        '<td style="white-space:nowrap;">' + esc(it.timestamp) + '</td>' +
        '<td style="white-space:nowrap;color:#b08f51;" title="' + it.rating + '/5">' + starText(it.rating) + '</td>' +
        '<td style="max-width:320px;white-space:normal;">' + esc(it.message) + '</td>' +
        '<td>' + (esc(it.guest_name) || '—') + '</td>' +
        '<td style="font-family:monospace;">' + (esc(it.guest_wa) || '—') + '</td>' +
        '<td>' + (esc(it.source_name || it.source) || '—') + '</td>' +
        '<td>' + (esc(it.outlet) || '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td>' + actionBtn + '</td>' +
        '</tr>';
    }).join('');
    tbody.innerHTML = html;

    tbody.querySelectorAll('[data-fb-row]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        markHandled(parseInt(btn.getAttribute('data-fb-row'), 10), btn);
      });
    });

    // Terapkan kembali pembatasan role untuk tombol mutasi
    if (BSAdmin.applyRoleRestrictions && state.userRole === 'analyst_readonly') {
      tbody.querySelectorAll('.adm-btn-mutate').forEach(function (b) { b.disabled = true; });
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Tandai handled
   * ───────────────────────────────────────────────────────────── */
  function markHandled(row, btn) {
    if (!row) return;
    if (!BSAdmin.checkPermission || !BSAdmin.checkPermission('handle_feedback')) {
      if (BSAdmin.showToast) BSAdmin.showToast('Peran Anda tidak diizinkan menandai feedback.', 'error');
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    BSApi.markFeedbackHandled(row).then(function (resp) {
      if (resp && resp.ok) {
        if (BSAdmin.showToast) BSAdmin.showToast('Feedback ditandai sudah ditangani.', 'success');
        load();
      } else {
        throw new Error((resp && resp.error) || 'Gagal memperbarui status');
      }
    }).catch(function (err) {
      if (BSAdmin.showToast) BSAdmin.showToast('Gagal: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ Tandai ditangani'; }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. Inisialisasi filter
   * ───────────────────────────────────────────────────────────── */
  function init() {
    ['adm-feedback-filter-status', 'adm-feedback-filter-rating', 'adm-feedback-filter-outlet'].forEach(function (id) {
      var el = $id(id);
      if (el) el.addEventListener('change', load);
    });
    var refreshBtn = $id('adm-feedback-refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', load);
  }

  BSAdmin.feedback = {
    load:   load,
    renderTable: renderTable,
    init:   init
  };

  window.BSAdmin = BSAdmin;

})(window);
