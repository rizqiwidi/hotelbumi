/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.7
 * admin-audit.js — Jejak Audit & Riwayat Mutasi Sensitif (FR-P0-02, FR-ADM-01)
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
  var icon = BSAdmin.icon || function () { return ''; };

  function loadAuditLogs(limit) {
    var tbody = $id('adm-audit-tbody');
    var refreshBtn = $id('adm-audit-refresh-btn');

    if (!BSAdmin.checkPermission('view_audit')) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Peran Anda (' + esc(state.userRole || 'editor') + ') tidak memiliki izin untuk melihat log audit.</td></tr>';
      }
      return;
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Memuat…</span>';
    }

    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Memuat riwayat jejak audit dari server…</td></tr>';
    }

    if (!window.BSApi || typeof BSApi.getAuditLogs !== 'function') {
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">API Audit tidak tersedia.</td></tr>';
      if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Perbarui Log</span>'; }
      return;
    }

    BSApi.getAuditLogs(limit || 150).then(function (resp) {
      if (resp && resp.ok) {
        // Mendukung resp.audit_logs maupun resp.logs (FR-P0-02)
        state.auditLogs = resp.audit_logs || resp.logs || [];
        renderAuditTable();
        BSAdmin.showToast('Memuat ' + state.auditLogs.length + ' catatan audit.', 'info');
      } else {
        throw new Error((resp && resp.error) || 'Gagal memuat log audit dari server');
      }
    }).catch(function (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty" style="color:var(--danger,#dc2626);">Gagal memuat audit log: ' + esc(err.message) + '</td></tr>';
      }
      BSAdmin.showToast('Gagal memuat audit log: ' + err.message, 'error');
    }).finally(function () {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Perbarui Log</span>';
      }
    });
  }

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

    var countEl = $id('adm-audit-count-info');
    if (countEl) {
      countEl.textContent = 'Menampilkan ' + logs.length + ' dari ' + (state.auditLogs || []).length + ' catatan.';
    }

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Belum ada catatan jejak audit yang sesuai filter.</td></tr>';
      return;
    }

    tbody.innerHTML = logs.map(function (log) {
      var tsVal = log.ts_server || log.timestamp;
      var ts = tsVal ? new Date(tsVal).toLocaleString('id-ID') : '—';
      var statusBadge = '';
      if (log.status === 'SUCCESS') {
        statusBadge = '<span class="adm-badge-ok">SUCCESS</span>';
      } else if (log.status === 'FAILED') {
        statusBadge = '<span class="adm-badge-err">FAILED</span>';
      } else if (log.status === 'DENIED' || log.status === 'REJECTED') {
        statusBadge = '<span class="adm-badge-warn">' + esc(log.status) + '</span>';
      } else {
        statusBadge = '<span class="adm-badge-secondary">' + esc(log.status || 'INFO') + '</span>';
      }

      var roleBadge = '<span class="adm-role-tag adm-role-' + esc(log.role || 'user') + '">' + esc(log.role || '—') + '</span>';

      return '<tr>' +
        '<td class="bs-num" style="font-size:0.78rem;white-space:nowrap;text-align:left;">' + esc(ts) + '</td>' +
        '<td><strong>' + esc(log.actor || 'system') + '</strong></td>' +
        '<td>' + roleBadge + '</td>' +
        '<td><code>' + esc(log.action || '—') + '</code></td>' +
        '<td>' + esc(log.target_object || '—') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="font-size:0.78rem;max-width:260px;word-break:break-word;">' + esc(log.details || '—') + '</td>' +
      '</tr>';
    }).join('');
  }

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

  BSAdmin.audit = {
    load:        loadAuditLogs,
    renderTable: renderAuditTable,
    init:        init
  };

  window.BSAdmin = BSAdmin;

})(window);
