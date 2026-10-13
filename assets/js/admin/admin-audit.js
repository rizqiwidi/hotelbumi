/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-audit.js — Jejak Audit & Riwayat Mutasi Sensitif (SEC-11, SEC-12, PRD 7.9)
 *
 * Mengelola pembacaan dan visualisasi log audit dari lembar AuditLog backend Apps Script:
 * mencatat aktor, peran, waktu server, tindakan, objek mutasi, status, detail, dan IP masked.
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var maskIp = BSAdmin.maskIp || function (ip) {
    var parts = String(ip || '').split('.');
    if (parts.length === 4) { parts[2] = 'x'; parts[3] = 'x'; return parts.join('.'); }
    return ip || '—';
  };

  /* ─────────────────────────────────────────────────────────────
   * 1. Pemuatan Data Audit Log dari Server
   * ───────────────────────────────────────────────────────────── */
  function loadAuditLogs(limit) {
    var tbody = $id('adm-audit-tbody');
    var refreshBtn = $id('adm-audit-refresh-btn');

    if (!BSAdmin.checkPermission('view_audit')) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Peran Anda (' + (state.userRole || 'editor') + ') tidak memiliki izin untuk melihat log audit.</td></tr>';
      }
      return;
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '🔄 Memuat…';
    }

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">⏳ Memuat riwayat jejak audit dari server…</td></tr>';
    }

    if (!window.BSApi || typeof BSApi.getAuditLogs !== 'function') {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">API Audit tidak tersedia.</td></tr>';
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '🔄 Perbarui Log'; }
      return;
    }

    BSApi.getAuditLogs(limit || 150).then(function (resp) {
      if (resp && resp.ok) {
        state.auditLogs = resp.audit_logs || [];
        renderAuditTable();
        BSAdmin.showToast('Memuat ' + state.auditLogs.length + ' catatan audit.', 'info');
      } else {
        throw new Error((resp && resp.error) || 'Gagal memuat log audit dari server');
      }
    }).catch(function (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty" style="color:var(--color-danger,#c0392b);">❌ Gagal memuat audit log: ' + esc(err.message) + '</td></tr>';
      }
      BSAdmin.showToast('Gagal memuat audit log: ' + err.message, 'error');
    }).finally(function () {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.textContent = '🔄 Perbarui Log';
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Render Tabel Audit Log
   * ───────────────────────────────────────────────────────────── */
  function renderAuditTable() {
    var tbody = $id('adm-audit-tbody');
    if (!tbody) return;

    var filterAction = ($id('adm-audit-filter-action') ? $id('adm-audit-filter-action').value : 'all') || 'all';
    var searchQuery  = ($id('adm-audit-search') ? $id('adm-audit-search').value : '').trim().toLowerCase();

    var logs = (state.auditLogs || []).filter(function (log) {
      if (filterAction !== 'all' && log.action !== filterAction) return false;
      if (searchQuery) {
        var matchActor = String(log.actor || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchObj   = String(log.target_object || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchDet   = String(log.details || '').toLowerCase().indexOf(searchQuery) !== -1;
        var matchRole  = String(log.role || '').toLowerCase().indexOf(searchQuery) !== -1;
        if (!matchActor && !matchObj && !matchDet && !matchRole) return false;
      }
      return true;
    });

    // Update info hitungan log
    var countEl = $id('adm-audit-count-info');
    if (countEl) {
      countEl.textContent = 'Menampilkan ' + logs.length + ' dari ' + (state.auditLogs || []).length + ' catatan.';
    }

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Belum ada catatan jejak audit yang sesuai filter.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(function (log) {
      var ts = log.ts_server ? new Date(log.ts_server).toLocaleString('id-ID') : '—';
      var statusBadge = '';
      if (log.status === 'SUCCESS') {
        statusBadge = '<span class="adm-badge-ok">SUCCESS</span>';
      } else if (log.status === 'FAILED') {
        statusBadge = '<span class="adm-badge-err">FAILED</span>';
      } else if (log.status === 'DENIED') {
        statusBadge = '<span class="adm-badge-warn">DENIED</span>';
      } else {
        statusBadge = '<span class="adm-badge-secondary">' + esc(log.status || 'INFO') + '</span>';
      }

      var roleBadge = '<span class="adm-role-tag adm-role-' + esc(log.role || 'user') + '">' + esc(log.role || '—') + '</span>';
      var ipDisp = maskIp(log.ip || '');

      return '<tr>' +
        '<td style="font-size:0.75rem;white-space:nowrap;">' + esc(ts) + '</td>' +
        '<td><strong>' + esc(log.actor || 'system') + '</strong></td>' +
        '<td>' + roleBadge + '</td>' +
        '<td><code>' + esc(log.action || '—') + '</code></td>' +
        '<td>' + esc(log.target_object || '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="font-size:0.75rem;max-width:240px;word-break:break-word;">' + esc(log.details || '—') + '</td>' +
      '</tr>';
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Binding Event Listener Modul Audit
   * ───────────────────────────────────────────────────────────── */
  function init() {
    var refreshBtn = $id('adm-audit-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadAuditLogs(150);
      });
    }

    var filterAction = $id('adm-audit-filter-action');
    if (filterAction) {
      filterAction.addEventListener('change', renderAuditTable);
    }

    var searchInput = $id('adm-audit-search');
    if (searchInput) {
      searchInput.addEventListener('input', renderAuditTable);
    }
  }

  // Ekspor API modul
  BSAdmin.audit = {
    load:        loadAuditLogs,
    renderTable: renderAuditTable,
    init:        init
  };

  window.BSAdmin = BSAdmin;

})(window);
