/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.8
 * admin-audit.js — Jejak Audit, Paginasi, Ekspor CSV & Sesi Aktif (FR-P0-02, FR-ADM-01, FR-V67-14)
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var icon = BSAdmin.icon || function () { return ''; };

  var PAGE_SIZE = 100;
  var auditPage = 0;
  var auditMeta = { matched: 0, hasMore: false, loading: false };

  function csvEscape(val) {
    var s = (val === null || val === undefined) ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  /* ── Paginasi server-side: filter dikirim ke backend agar halaman konsisten ── */
  function loadAuditLogs(resetPage) {
    var tbody = $id('adm-audit-tbody');
    var refreshBtn = $id('adm-audit-refresh-btn');

    if (!BSAdmin.checkPermission('view_audit')) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Peran Anda (' + esc(state.userRole || 'editor') + ') tidak memiliki izin untuk melihat log audit.</td></tr>';
      }
      return;
    }

    if (auditMeta.loading) return;
    auditMeta.loading = true;
    if (resetPage) auditPage = 0;

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
      auditMeta.loading = false;
      return;
    }

    var filterEl = $id('adm-audit-filter-action');
    var searchEl = $id('adm-audit-search');

    BSApi.getAuditLogs({
      limit: PAGE_SIZE,
      offset: auditPage * PAGE_SIZE,
      action_filter: filterEl ? filterEl.value : '',
      search: searchEl ? searchEl.value.trim() : ''
    }).then(function (resp) {
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Gagal memuat log audit dari server');
      state.auditLogs = resp.audit_logs || resp.logs || [];
      auditMeta.matched = Number(resp.matched || state.auditLogs.length);
      auditMeta.hasMore = !!resp.has_more;
      renderAuditTable();
    }).catch(function (err) {
      if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="bs-empty" style="color:var(--danger,#dc2626);">Gagal memuat audit log: ' + esc(err.message) + '</td></tr>';
      }
      BSAdmin.showToast('Gagal memuat audit log: ' + err.message, 'error');
    }).finally(function () {
      auditMeta.loading = false;
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Perbarui Log</span>';
      }
    });
  }

  function renderAuditTable() {
    var tbody = $id('adm-audit-tbody');
    if (!tbody) return;

    var logs = state.auditLogs || [];

    var countEl = $id('adm-audit-count-info');
    if (countEl) {
      countEl.textContent = logs.length + ' dari ' + auditMeta.matched + ' catatan';
    }

    var pageInfo = $id('adm-audit-page-info');
    if (pageInfo) {
      pageInfo.textContent = 'Halaman ' + (auditPage + 1);
    }
    var prevBtn = $id('adm-audit-prev-btn');
    var nextBtn = $id('adm-audit-next-btn');
    if (prevBtn) prevBtn.disabled = auditPage === 0;
    if (nextBtn) nextBtn.disabled = !auditMeta.hasMore;

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

  function csvFor(logs) {
    var headers = ['timestamp', 'actor', 'role', 'action', 'target_object', 'status', 'details', 'ip'];
    var lines = [headers.join(',')];
    logs.forEach(function (log) {
      lines.push([
        csvEscape(log.ts_server || log.timestamp),
        csvEscape(log.actor),
        csvEscape(log.role),
        csvEscape(log.action),
        csvEscape(log.target_object),
        csvEscape(log.status),
        csvEscape(log.details),
        csvEscape(log.ip)
      ].join(','));
    });
    return lines;
  }

  function downloadCsv(logs) {
    var blob = new Blob(['\uFEFF' + csvFor(logs).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bumi-surabaya-audit-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  /* Ekspor mengikuti filter aktif, bukan hanya halaman yang terlihat.
     Plafon backend 500 baris per permintaan; bila terpotong, toast menyebutkannya. */
  function exportAuditCsv() {
    if (!BSAdmin.checkPermission('view_audit')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin mengekspor log audit.', 'warning');
      return;
    }
    var btn = $id('adm-audit-export-btn');
    var filterEl = $id('adm-audit-filter-action');
    var searchEl = $id('adm-audit-search');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan…'; }

    BSApi.getAuditLogs({
      limit: 500,
      offset: 0,
      action_filter: filterEl ? filterEl.value : '',
      search: searchEl ? searchEl.value.trim() : ''
    }).then(function (resp) {
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Gagal memuat log audit');
      var logs = resp.audit_logs || resp.logs || [];
      if (logs.length === 0) {
        BSAdmin.showToast('Tidak ada catatan audit yang cocok dengan filter.', 'warning');
        return;
      }
      downloadCsv(logs);
      BSAdmin.showToast('CSV audit (' + logs.length + ' baris' +
        (resp.has_more ? ' dari total ' + resp.matched + ' — persempit filter untuk sisanya' : '') +
        ') berhasil diunduh.', 'success');
    }).catch(function (err) {
      BSAdmin.showToast('Gagal mengekspor audit: ' + err.message, 'error');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Ekspor CSV'; }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * Sesi aktif (FR-V67-14)
   * ───────────────────────────────────────────────────────────── */
  function loadSessions() {
    var tbody = $id('adm-sess-tbody');
    var btn = $id('adm-sess-refresh-btn');
    if (!tbody) return;
    if (!window.BSApi || typeof BSApi.listSessions !== 'function') {
      tbody.innerHTML = '<tr><td colspan="5" class="bs-empty">API sesi tidak tersedia.</td></tr>';
      return;
    }
    if (btn) btn.disabled = true;
    tbody.innerHTML = '<tr><td colspan="5" class="bs-empty">Memuat sesi aktif…</td></tr>';

    BSApi.listSessions().then(function (resp) {
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Gagal memuat sesi');
      var users = resp.users || [];
      var rows = [];
      users.forEach(function (u) {
        var sessions = u.sessions || [];
        if (sessions.length === 0) return;
        sessions.forEach(function (s) {
          var loginAt = s.login_at ? new Date(s.login_at).toLocaleString('id-ID') : '—';
          rows.push('<tr>' +
            '<td><strong>' + esc(u.username) + '</strong>' + (s.current ? ' <span class="adm-badge-ok">Sesi ini</span>' : '') + '</td>' +
            '<td><span class="adm-role-tag">' + esc(u.role || '—') + '</span></td>' +
            '<td><code>' + esc(s.token_preview) + '…</code></td>' +
            '<td style="font-size:0.78rem;">' + esc(loginAt) + '</td>' +
            '<td class="adm-actions">' +
              (s.current
                ? '<span class="adm-field-hint">Sesi berjalan</span>'
                : '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" data-sess-revoke="' + esc(s.token_preview) + '" data-sess-user="' + esc(u.username) + '">Cabut</button>') +
            '</td>' +
          '</tr>');
        });
      });

      var countEl = $id('adm-sess-count-info');
      if (countEl) countEl.textContent = rows.length + ' sesi aktif';
      tbody.innerHTML = rows.length
        ? rows.join('')
        : '<tr><td colspan="5" class="bs-empty">Tidak ada sesi aktif saat ini.</td></tr>';
    }).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="5" class="bs-empty" style="color:var(--danger,#dc2626);">Gagal memuat sesi: ' + esc(err.message) + '</td></tr>';
    }).finally(function () {
      if (btn) btn.disabled = false;
    });
  }

  function revokeSession(tokenPreview, username) {
    if (!confirm('Cabut sesi ' + username + ' (' + tokenPreview + '…)? Perangkat tersebut harus login ulang.')) return;
    BSApi.revokeSession({ token_preview: tokenPreview, target_username: username }).then(function (resp) {
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'Gagal mencabut sesi');
      BSAdmin.showToast(resp.revoked + ' sesi dicabut.', 'success');
      loadSessions();
    }).catch(function (err) {
      BSAdmin.showToast('Gagal mencabut sesi: ' + err.message, 'error');
    });
  }

  var _initialised = false;

  function init() {
    if (_initialised) return;
    _initialised = true;
    var refreshBtn = $id('adm-audit-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { loadAuditLogs(true); });
    }

    var exportBtn = $id('adm-audit-export-btn');
    if (exportBtn) exportBtn.addEventListener('click', exportAuditCsv);

    var prevBtn = $id('adm-audit-prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (auditPage > 0) { auditPage--; loadAuditLogs(false); }
      });
    }
    var nextBtn = $id('adm-audit-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (auditMeta.hasMore) { auditPage++; loadAuditLogs(false); }
      });
    }

    var filterAction = $id('adm-audit-filter-action');
    if (filterAction) {
      filterAction.addEventListener('change', function () { loadAuditLogs(true); });
    }

    var searchInput = $id('adm-audit-search');
    if (searchInput) {
      var timer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { loadAuditLogs(true); }, 350);
      });
    }

    var sessRefresh = $id('adm-sess-refresh-btn');
    if (sessRefresh) sessRefresh.addEventListener('click', loadSessions);

    var sessBody = $id('adm-sess-tbody');
    if (sessBody) {
      sessBody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-sess-revoke]');
        if (!btn) return;
        revokeSession(btn.getAttribute('data-sess-revoke'), btn.getAttribute('data-sess-user'));
      });
    }
  }

  BSAdmin.audit = {
    load:        loadAuditLogs,
    renderTable: renderAuditTable,
    exportCsv:   exportAuditCsv,
    loadSessions: loadSessions,
    init:        init
  };

  window.BSAdmin = BSAdmin;

})(window);
