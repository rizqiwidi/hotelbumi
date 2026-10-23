/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.8
 * admin-core.js — Central state manager, SVG icon system (FR-ADM-01), Dynamic Role & Sidebar Menu Visibility (FR-V66-ROLE-MENU) & health signals
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};

  /* ─────────────────────────────────────────────────────────────
   * 1. State Global Portal Admin
   * ───────────────────────────────────────────────────────────── */
  var state = {
    events:             [],
    monthlyAggregates:  [],
    evalResult:         null,
    currentPeriod:      '7d',
    currentFilter:      '',
    dateFrom:           '',
    dateTo:             '',
    editingCode:        null,
    editingOutletId:    null,
    editingPromoIdx:    null,
    configData:         JSON.parse(JSON.stringify((window.BSConfig && BSConfig.DEFAULTS) || {})),
    outlets:            [],
    promos:             [],
    staffDevices:       [],
    auditLogs:          [],
    users:              [],
    userRole:           'super_admin',
    username:           'admin',
    lastFocusedTrigger: null,
    syncStatus: {
      state:      'saved',
      lastError:  null,
      hasUnsaved: false,
      retryFn:    null
    }
  };

  if (state.configData.outlets && Array.isArray(state.configData.outlets)) {
    state.outlets = state.configData.outlets.slice();
  }
  if (state.configData.promotions && Array.isArray(state.configData.promotions)) {
    state.promos = state.configData.promotions.slice();
  }

  BSAdmin.state = state;

  /* ─────────────────────────────────────────────────────────────
   * 2. Helper DOM, Sanitasi & Sistem Ikon SVG Monoline (FR-ADM-01)
   * ───────────────────────────────────────────────────────────── */
  function $id(id) {
    return document.getElementById(id);
  }
  BSAdmin.$id = $id;

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  BSAdmin.esc = esc;

  function maskIp(ip) {
    var parts = String(ip || '').split('.');
    if (parts.length === 4) { parts[2] = 'x'; parts[3] = 'x'; return parts.join('.'); }
    return ip || '—';
  }
  BSAdmin.maskIp = maskIp;

  var SVG_PATHS = {
    edit:     '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    rotate:   '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    power:    '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
    trash:    '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    check:    '<polyline points="20 6 9 17 4 12"/>',
    plus:     '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    save:     '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    eye:      '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off':'<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
    printer:  '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    shield:   '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    upload:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    link:     '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    lock:     '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    users:    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    bell:     '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'
  };

  function icon(name, size) {
    var sz = size || 14;
    var p = SVG_PATHS[name] || SVG_PATHS.check;
    return '<svg class="adm-icon" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  BSAdmin.icon = icon;

  /* ── Toast Helper ── */
  var _toastTimer = null;
  function showToast(msg, type) {
    var toast = $id('adm-toast');
    if (!toast) return;
    toast.textContent   = msg;
    toast.className     = 'adm-toast adm-toast-' + (type || 'info');
    toast.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      toast.style.display = 'none';
    }, 4000);
  }
  BSAdmin.showToast = showToast;

  /* ── Save / Sync Status Tracker ── */
  function updateSyncStatus(syncState, errorMsg, retryFn) {
    state.syncStatus.state = syncState;
    state.syncStatus.lastError = errorMsg || null;
    if (typeof retryFn === 'function') state.syncStatus.retryFn = retryFn;

    var el       = $id('adm-sync-indicator');
    var txt      = $id('adm-sync-text');
    var retryBtn = $id('adm-sync-retry-btn');
    if (!el || !txt) return;

    el.className = 'adm-sync-indicator adm-sync-' + syncState;
    if (syncState === 'saved') {
      state.syncStatus.hasUnsaved = false;
      txt.textContent = 'Tersimpan';
      if (retryBtn) retryBtn.style.display = 'none';
    } else if (syncState === 'unsaved') {
      state.syncStatus.hasUnsaved = true;
      txt.textContent = 'Belum disimpan';
      if (retryBtn) retryBtn.style.display = 'none';
    } else if (syncState === 'saving') {
      txt.textContent = 'Menyimpan…';
      if (retryBtn) retryBtn.style.display = 'none';
    } else if (syncState === 'failed') {
      state.syncStatus.hasUnsaved = true;
      txt.textContent = 'Gagal' + (errorMsg ? ': ' + errorMsg : '');
      if (retryBtn) retryBtn.style.display = state.syncStatus.retryFn ? 'inline-block' : 'none';
    }
  }
  BSAdmin.updateSyncStatus = updateSyncStatus;

  /* ── Accessible Modal Manager ── */
  function setupAccessibleModal(modalId, closeFn) {
    var modal = $id(modalId);
    if (!modal) return;
    modal.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        if (typeof closeFn === 'function') closeFn();
        else {
          modal.style.display = 'none';
          modal.setAttribute('aria-hidden', 'true');
          if (state.lastFocusedTrigger && typeof state.lastFocusedTrigger.focus === 'function') {
            state.lastFocusedTrigger.focus();
          }
        }
        return;
      }
      if (e.key === 'Tab' || e.keyCode === 9) {
        var focusables = modal.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusables.length === 0) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }
  BSAdmin.setupAccessibleModal = setupAccessibleModal;

  /* ─────────────────────────────────────────────────────────────
   * 3. Manajemen Role Dinamis & Visibilitas Menu Sidebar (FR-V66-ROLE-MENU)
   * ───────────────────────────────────────────────────────────── */
  var ALL_TAB_IDS = [
    'dashboard', 'sources', 'antifraud', 'feedback',
    'outlets', 'sales-wa', 'nfc', 'bulk-qr',
    'promos', 'appearance', 'audit', 'config', 'account'
  ];

  var DEFAULT_ROLES_MAP = {
    super_admin: {
      label: 'Super Administrator (Akses Penuh)',
      can_mutate: true,
      default_tab: 'dashboard',
      allowed_tabs: ALL_TAB_IDS.slice()
    },
    manager: {
      label: 'Manager Operasional',
      can_mutate: true,
      default_tab: 'dashboard',
      allowed_tabs: ['dashboard', 'sources', 'antifraud', 'feedback', 'outlets', 'sales-wa', 'nfc', 'bulk-qr', 'promos', 'appearance', 'audit', 'account']
    },
    content_editor: {
      label: 'Editor Konten & Halaman Tamu',
      can_mutate: true,
      default_tab: 'appearance',
      allowed_tabs: ['outlets', 'sales-wa', 'promos', 'appearance', 'account']
    },
    analyst_readonly: {
      label: 'Analis Data (Hanya Baca)',
      can_mutate: false,
      default_tab: 'dashboard',
      allowed_tabs: ['dashboard', 'sources', 'antifraud', 'outlets', 'sales-wa', 'bulk-qr', 'promos', 'audit', 'account']
    }
  };

  function getRolePermissionsMap() {
    var base = JSON.parse(JSON.stringify(DEFAULT_ROLES_MAP));
    var custom = (state.configData && state.configData.role_permissions && typeof state.configData.role_permissions === 'object')
      ? state.configData.role_permissions : {};
    Object.keys(custom).forEach(function (rk) {
      if (rk === 'super_admin') return;
      var item = custom[rk];
      if (item && typeof item === 'object' && Array.isArray(item.allowed_tabs)) {
        var tabs = item.allowed_tabs.slice();
        if (tabs.indexOf('account') === -1) tabs.push('account');
        base[rk] = {
          label:        String(item.label || rk),
          can_mutate:   item.can_mutate !== false,
          default_tab:  String(item.default_tab || tabs[0] || 'account'),
          allowed_tabs: tabs
        };
      }
    });
    return base;
  }
  BSAdmin.getRolePermissionsMap = getRolePermissionsMap;

  function getRoleDefinition(roleKey) {
    var r = String(roleKey || state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin').trim().toLowerCase();
    var map = getRolePermissionsMap();
    if (map[r]) return map[r];
    return {
      label: r,
      can_mutate: false,
      default_tab: 'account',
      allowed_tabs: ['account']
    };
  }
  BSAdmin.getRoleDefinition = getRoleDefinition;

  function isTabAllowedForRole(tabName, roleKey) {
    var r = String(roleKey || state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin').trim().toLowerCase();
    if (r === 'super_admin' || tabName === 'account') return true;
    var def = getRoleDefinition(r);
    return Array.isArray(def.allowed_tabs) && def.allowed_tabs.indexOf(tabName) !== -1;
  }
  BSAdmin.isTabAllowedForRole = isTabAllowedForRole;

  function checkPermission(action) {
    var r = String(state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin').trim().toLowerCase();
    if (r === 'super_admin') return true;

    var def = getRoleDefinition(r);
    var canMutate = Boolean(def.can_mutate);

    if (action === 'manage_users') {
      return false;
    }
    if (action === 'save_fraud_settings' || action === 'save_system_config') {
      return canMutate && isTabAllowedForRole('config', r);
    }
    if (action === 'save_sources') {
      return canMutate && (isTabAllowedForRole('sources', r) || isTabAllowedForRole('sales-wa', r) || isTabAllowedForRole('nfc', r));
    }
    if (action === 'save_staff_devices') {
      return canMutate && isTabAllowedForRole('antifraud', r);
    }
    if (action === 'save_content') {
      return canMutate && (isTabAllowedForRole('appearance', r) || isTabAllowedForRole('outlets', r) || isTabAllowedForRole('promos', r) || isTabAllowedForRole('sales-wa', r));
    }
    if (action === 'view_analytics') {
      return isTabAllowedForRole('dashboard', r) || isTabAllowedForRole('antifraud', r);
    }
    if (action === 'view_audit') {
      return isTabAllowedForRole('audit', r);
    }
    if (action === 'view_feedback') {
      return isTabAllowedForRole('feedback', r);
    }
    if (action === 'handle_feedback') {
      return canMutate && isTabAllowedForRole('feedback', r);
    }
    return false;
  }
  BSAdmin.checkPermission = checkPermission;

  function applyRoleRestrictions() {
    var r = String(state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin').trim().toLowerCase();
    var u = (window.BSAuth && BSAuth.getUsername()) || 'admin';
    var def = getRoleDefinition(r);

    var userBadge = $id('adm-sidebar-user-role');
    if (userBadge) {
      userBadge.innerHTML = '<span class="adm-status-dot-sm"></span> ' + esc(def.label || r);
    }
    var curUserEl = $id('adm-acc-current-user');
    if (curUserEl) {
      curUserEl.textContent = u + ' (' + (def.label || r) + ')';
    }

    var readonlyBanner = $id('adm-readonly-banner');
    if (readonlyBanner) {
      if (!def.can_mutate && r !== 'super_admin') {
        readonlyBanner.style.display = 'block';
        readonlyBanner.textContent = 'Mode Baca-Saja: Peran "' + (def.label || r) + '" tidak memiliki izin untuk menyimpan perubahan data.';
      } else {
        readonlyBanner.style.display = 'none';
      }
    }

    var userMgmtCard = $id('adm-user-mgmt-card');
    if (userMgmtCard) {
      userMgmtCard.style.display = (r === 'super_admin') ? '' : 'none';
    }
    var roleMgmtCard = $id('adm-role-mgmt-card');
    if (roleMgmtCard) {
      roleMgmtCard.style.display = (r === 'super_admin') ? '' : 'none';
    }

    var isReadonly = (!def.can_mutate && r !== 'super_admin');

    document.querySelectorAll('.adm-btn-mutate').forEach(function (btn) {
      if (isReadonly) {
        btn.disabled = true;
        btn.title = 'Akses dinonaktifkan: Peran Anda bersifat baca-saja.';
      } else {
        btn.disabled = false;
      }
    });

    // Sembunyikan menu sidebar yang tidak diizinkan untuk Role ini (FR-V66-ROLE-MENU)
    document.querySelectorAll('.adm-nav-item').forEach(function (item) {
      var tab = item.dataset.tab;
      var allowed = isTabAllowedForRole(tab, r);
      if (allowed) {
        item.style.display = '';
        item.style.opacity = '';
        item.removeAttribute('aria-disabled');
      } else {
        item.style.display = 'none';
        item.setAttribute('aria-disabled', 'true');
      }
    });

    // Sembunyikan judul grup navigasi (.adm-nav-group-title) jika seluruh menu di bawahnya disembunyikan
    var navEl = document.querySelector('.adm-nav');
    if (navEl) {
      var children = Array.prototype.slice.call(navEl.children);
      var currentGroupTitle = null;
      var visibleInGroup = 0;
      children.forEach(function (child) {
        if (child.classList.contains('adm-nav-group-title')) {
          if (currentGroupTitle) {
            currentGroupTitle.style.display = visibleInGroup > 0 ? '' : 'none';
          }
          currentGroupTitle = child;
          visibleInGroup = 0;
        } else if (child.classList.contains('adm-nav-item')) {
          if (child.style.display !== 'none') visibleInGroup++;
        }
      });
      if (currentGroupTitle) {
        currentGroupTitle.style.display = visibleInGroup > 0 ? '' : 'none';
      }
    }

    // Jika tab yang sedang terbuka tidak diizinkan bagi role ini, alihkan ke default_tab role tersebut
    var activeNav = document.querySelector('.adm-nav-item.adm-nav-active');
    var activeTab = activeNav ? activeNav.dataset.tab : 'dashboard';
    if (!isTabAllowedForRole(activeTab, r)) {
      var targetTab = (def.default_tab && isTabAllowedForRole(def.default_tab, r))
        ? def.default_tab
        : (def.allowed_tabs && def.allowed_tabs[0]) || 'account';
      switchTab(targetTab);
    }
  }
  BSAdmin.applyRoleRestrictions = applyRoleRestrictions;

  /* ─────────────────────────────────────────────────────────────
   * 4. Sinyal Health & Keandalan Operasional
   * ───────────────────────────────────────────────────────────── */
  function updateHealthSignals(backendHealth) {
    var statusEl   = $id('adm-health-status');
    var beVerEl    = $id('adm-health-backend-ver');
    var feVerEl    = $id('adm-health-frontend-ver');
    var serverTsEl = $id('adm-health-server-time');
    var dlqEl      = $id('adm-health-dlq-count');

    var dlqCount = 0;
    try {
      var rawDlq = window.localStorage && localStorage.getItem('bs_dead_letter_queue');
      if (rawDlq) {
        var parsedDlq = JSON.parse(rawDlq);
        if (Array.isArray(parsedDlq)) dlqCount = parsedDlq.length;
      }
    } catch (_) {}

    if (feVerEl) feVerEl.textContent = 'v6.8.0';

    if (backendHealth && backendHealth.backend_version) {
      if (statusEl) {
        statusEl.className = 'adm-health-badge adm-health-online';
        statusEl.innerHTML = '<span class="adm-status-dot-sm"></span> Backend Terhubung';
      }
      if (beVerEl)    beVerEl.textContent = backendHealth.backend_version;
      if (serverTsEl) serverTsEl.textContent = backendHealth.server_time || new Date().toLocaleString('id-ID');
    } else {
      if (statusEl) {
        statusEl.className = 'adm-health-badge adm-health-offline';
        statusEl.textContent = 'Backend Terputus / Belum Diuji';
      }
    }

    if (dlqEl) {
      dlqEl.textContent = dlqCount + ' event tertunda' + (dlqCount > 0 ? ' (Klik untuk Kirim)' : '');
      dlqEl.className = dlqCount > 0 ? 'adm-badge-warn' : 'adm-badge-ok';
      dlqEl.style.cursor = dlqCount > 0 ? 'pointer' : 'default';
      dlqEl.onclick = dlqCount > 0 ? flushDeadLetterQueue : null;
    }
  }
  BSAdmin.updateHealthSignals = updateHealthSignals;

  function flushDeadLetterQueue() {
    var gasUrl = (window.BSConfig && BSConfig.getGasUrl()) || '';
    if (!gasUrl) {
      showToast('URL Google Apps Script belum diatur.', 'warning');
      return;
    }
    try {
      var rawDlq = window.localStorage && localStorage.getItem('bs_dead_letter_queue');
      var queue = rawDlq ? JSON.parse(rawDlq) : [];
      if (!Array.isArray(queue) || queue.length === 0) {
        showToast('Tidak ada antrean event tertunda.', 'info');
        updateHealthSignals();
        return;
      }
      showToast('Mengirim ulang ' + queue.length + ' event tertunda ke server…', 'info');
      Promise.all(queue.map(function (ev) {
        // BUG-17: entri DLQ berbentuk {id, event_id, payload, reason, ...};
        // yang dikirim harus payload aslinya, bukan pembungkusnya. Payload sudah
        // membawa action:'log_event'; default hanya dipakai bila field hilang.
        var inner = (ev && ev.payload) ? ev.payload : ev;
        var body = Object.assign({ action: 'log_event' }, inner);
        return fetch((ev && ev.gasUrl) || gasUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(body)
        }).then(function (r) {
          return r.ok ? r.json().then(function (j) { return j && j.ok !== false; }).catch(function () { return true; }) : false;
        }).catch(function () { return false; });
      })).then(function (results) {
        var remaining = queue.filter(function (_, idx) { return !results[idx]; });
        if (remaining.length === 0) {
          localStorage.removeItem('bs_dead_letter_queue');
          showToast('Seluruh event tertunda berhasil dikirim ke server.', 'success');
        } else {
          localStorage.setItem('bs_dead_letter_queue', JSON.stringify(remaining));
          showToast((queue.length - remaining.length) + ' terkirim, ' + remaining.length + ' masih tertunda.', 'warning');
        }
        updateHealthSignals();
      });
    } catch (err) {
      showToast('Gagal mengirim antrean: ' + err.message, 'error');
    }
  }
  BSAdmin.flushDeadLetterQueue = flushDeadLetterQueue;

  /* ─────────────────────────────────────────────────────────────
   * 5. Navigasi Antar Tab (dengan Pemblokiran Dinamis per Role — FR-V66-ROLE-MENU)
   * ───────────────────────────────────────────────────────────── */
  var TAB_TITLES = {
    dashboard:  'Dashboard Analitik',
    sources:    'Manajemen Staf & Titik NFC',
    antifraud:  'Audit Anti-Fraud & Integritas',
    outlets:    'Manajemen Outlet F&B',
    'sales-wa': 'Nomor WhatsApp Sales & Reservasi',
    nfc:        'Programmer Kartu NFC (Web NFC)',
    'bulk-qr':  'Cetak QR Massal & Stiker Meja',
    promos:     'Promosi & Visibilitas Seksi Tamu',
    appearance: 'CMS Isi Halaman Tamu & Identitas',
    config:     'Konfigurasi Backend & Ambang Batas',
    account:    'Pengaturan Akun, Role & Menu Dashboard',
    audit:      'Jejak Audit & Riwayat Mutasi',
    feedback:   'Feedback Langsung Tamu'
  };
  BSAdmin.TAB_TITLES = TAB_TITLES;

  function switchTab(name) {
    var r = state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin';
    if (!isTabAllowedForRole(name, r)) {
      var def = getRoleDefinition(r);
      showToast('Peran "' + (def.label || r) + '" tidak memiliki akses ke menu "' + (TAB_TITLES[name] || name) + '".', 'warning');
      return;
    }

    document.querySelectorAll('.adm-nav-item').forEach(function (el) {
      el.classList.toggle('adm-nav-active', el.dataset.tab === name);
    });
    document.querySelectorAll('.adm-tab-pane').forEach(function (el) {
      el.style.display = el.id === 'tab-' + name ? '' : 'none';
    });
    var titleEl = $id('adm-topbar-title');
    if (titleEl) titleEl.textContent = TAB_TITLES[name] || name;

    if (name === 'sources'    && BSAdmin.sources)    BSAdmin.sources.render();
    if (name === 'outlets'    && BSAdmin.content)    BSAdmin.content.renderOutlets();
    if (name === 'sales-wa'   && BSAdmin.content)    BSAdmin.content.renderSalesWa();
    if (name === 'promos'     && BSAdmin.content)    { BSAdmin.content.renderPromos(); BSAdmin.content.populateSections(); }
    if (name === 'appearance' && BSAdmin.appearance) BSAdmin.appearance.populate();
    if (name === 'bulk-qr'    && BSAdmin.reports)    BSAdmin.reports.renderBulkQr();
    if (name === 'nfc'        && BSAdmin.nfc)        { BSAdmin.nfc.populateSelect(); BSAdmin.nfc.checkSupport(); }
    if (name === 'config'     && BSAdmin.fraud)      BSAdmin.fraud.populateThresholds();
    if (name === 'antifraud'  && BSAdmin.fraud)      { BSAdmin.fraud.renderTable(); BSAdmin.fraud.renderStaffDevices(); }
    if (name === 'account'    && BSAdmin.fraud)      {
      BSAdmin.fraud.populateAccount();
      if (typeof BSAdmin.fraud.renderRoles === 'function') BSAdmin.fraud.renderRoles();
      if (typeof BSAdmin.fraud.loadUsers === 'function')   BSAdmin.fraud.loadUsers();
    }
    if (name === 'audit'      && BSAdmin.audit)      { BSAdmin.audit.load(true); BSAdmin.audit.loadSessions(); }
    if (name === 'feedback'   && BSAdmin.feedback)   BSAdmin.feedback.load();
  }
  BSAdmin.switchTab = switchTab;

  /* ─────────────────────────────────────────────────────────────
   * 6. Logika Autentikasi & Koordinasi Tampilan
   * ───────────────────────────────────────────────────────────── */
  function showPortal() {
    var loginScreen = $id('adm-login-screen');
    var portal      = $id('adm-portal');
    if (loginScreen) loginScreen.style.display = 'none';
    if (portal)      portal.style.display      = 'flex';

    var u = (window.BSAuth && BSAuth.getUsername()) || 'admin';
    var r = (window.BSAuth && BSAuth.getRole()) || 'super_admin';
    state.username = u;
    state.userRole = r;

    applyRoleRestrictions();
    var def = getRoleDefinition(r);
    if (def.default_tab && isTabAllowedForRole(def.default_tab, r)) {
      switchTab(def.default_tab);
    }
    if ($id('adm-cfg-gas-url')) $id('adm-cfg-gas-url').value = (window.BSConfig && BSConfig.getGasUrl()) || '';
  }
  BSAdmin.showPortal = showPortal;

  function showMustChangeModal(oldPwPrefill) {
    var modal = $id('adm-must-change-modal');
    if (!modal) return;
    if (oldPwPrefill && $id('adm-mc-old-pw')) {
      $id('adm-mc-old-pw').value = oldPwPrefill;
    }
    modal.style.display = 'flex';
  }
  BSAdmin.showMustChangeModal = showMustChangeModal;

  function checkLockout() {
    var lockoutMsg = $id('adm-lockout-msg');
    if (window.BSAuth && BSAuth.isLockedOut()) {
      var mins = Math.ceil(BSAuth.remainingLockMs() / 60000);
      if (lockoutMsg) {
        lockoutMsg.textContent = 'Terlalu banyak percobaan gagal. Coba lagi dalam ' + mins + ' menit.';
        lockoutMsg.style.display = '';
      }
      return true;
    }
    if (lockoutMsg) lockoutMsg.style.display = 'none';
    return false;
  }
  BSAdmin.checkLockout = checkLockout;

  /* ─────────────────────────────────────────────────────────────
   * 7. Data Loader Koordinator (Dashboard, Config, Events, MonthlyAggregates)
   * ───────────────────────────────────────────────────────────── */
  function loadDashboard() {
    var monthSelect = $id('adm-month-select');
    var month       = monthSelect ? (monthSelect.value || '') : '';
    var refreshBtn  = $id('adm-refresh-btn');
    var gasUrl      = (window.BSConfig && BSConfig.getGasUrl()) || '';

    if (!gasUrl) {
      showToast('URL Google Apps Script belum diisi di Konfigurasi.', 'warning');
      return;
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Memuat…</span>';
    }

    window.BSApi && BSApi.getAdminData().then(function (admResp) {
      if (admResp && admResp.ok) {
        if (admResp.config) {
          state.configData = Object.assign({}, BSConfig.DEFAULTS, admResp.config);
          if (admResp.config.guest_content && typeof admResp.config.guest_content === 'object') {
            state.configData.guest_content = Object.assign({}, BSConfig.DEFAULTS.guest_content, admResp.config.guest_content);
          }
          if (admResp.config.role_permissions && typeof admResp.config.role_permissions === 'object') {
            state.configData.role_permissions = Object.assign({}, BSConfig.DEFAULTS.role_permissions || {}, admResp.config.role_permissions);
          }
          if (Array.isArray(admResp.config.outlets))    state.outlets = admResp.config.outlets.slice();
          if (Array.isArray(admResp.config.promotions)) state.promos  = admResp.config.promotions.slice();
        }
        if (Array.isArray(admResp.sources) && window.BSStaffManager && typeof BSStaffManager.initSources === 'function') {
          BSStaffManager.initSources(admResp.sources);
        }
        if (Array.isArray(admResp.staff_devices)) {
          state.staffDevices = admResp.staff_devices.slice();
        }
        if (Array.isArray(admResp.monthly_aggregates)) {
          state.monthlyAggregates = admResp.monthly_aggregates.slice();
        }
        if (admResp.system_health) {
          if (admResp.system_health.current_role) {
            state.userRole = admResp.system_health.current_role;
          }
          updateHealthSignals(admResp.system_health);
        }
        applyRoleRestrictions();
      }
    }).catch(function () {
      return window.BSApi && BSApi.getPublicConfig().then(function (cfgResp) {
        if (cfgResp && cfgResp.ok && cfgResp.config) {
          state.configData = Object.assign({}, BSConfig.DEFAULTS, cfgResp.config);
          if (cfgResp.system_health) updateHealthSignals(cfgResp.system_health);
        }
      }).catch(function () {});
    }).finally(function () {
      if (BSAdmin.content) {
        BSAdmin.content.renderOutlets();
        BSAdmin.content.renderPromos();
        BSAdmin.content.populateSections();
        BSAdmin.content.renderSalesWa();
        if (typeof BSAdmin.content.populateOutletDropdowns === 'function') {
          BSAdmin.content.populateOutletDropdowns();
        }
      }
      if (BSAdmin.sources) {
        BSAdmin.sources.render();
      }
      if (BSAdmin.appearance) BSAdmin.appearance.populate();
      if (BSAdmin.fraud) {
        BSAdmin.fraud.populateThresholds();
        BSAdmin.fraud.renderStaffDevices();
        if (typeof BSAdmin.fraud.renderRoles === 'function') BSAdmin.fraud.renderRoles();
      }

      if (!checkPermission('view_analytics')) {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Perbarui</span>';
        }
        return;
      }

      if (!window.BSApi) return;
      BSApi.getEventsData(month, 10000).then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || 'Gagal memuat data event');

        state.events = resp.events || [];
        if (Array.isArray(resp.monthly_aggregates) && resp.monthly_aggregates.length > 0) {
          state.monthlyAggregates = resp.monthly_aggregates.slice();
        }
        if (Array.isArray(resp.sources) && resp.sources.length > 0 && !state.syncStatus.hasUnsaved && window.BSStaffManager && typeof BSStaffManager.initSources === 'function') {
          BSStaffManager.initSources(resp.sources);
          if (BSAdmin.sources) BSAdmin.sources.render();
        }
        if (Array.isArray(resp.staff_devices) && resp.staff_devices.length > 0) {
          state.staffDevices = resp.staff_devices.slice();
          if (BSAdmin.fraud) BSAdmin.fraud.renderStaffDevices();
        }

        if (BSAdmin.reports) {
          BSAdmin.reports.populateMonthSelect(resp.archive_tabs || []);
          if (typeof BSAdmin.reports.renderMonthlyAggregates === 'function') {
            BSAdmin.reports.renderMonthlyAggregates();
          }
        }

        var eventsToEval = (BSAdmin.reports && typeof BSAdmin.reports.getFilteredEvents === 'function')
          ? BSAdmin.reports.getFilteredEvents() : state.events;

        var srcList = (window.BSStaffManager && BSStaffManager.getSources)
          ? BSStaffManager.getSources() : [];
        var ftConfig = (state.configData && state.configData.fraud_thresholds)
          ? state.configData.fraud_thresholds : BSConfig.DEFAULTS.fraud_thresholds;

        state.evalResult = (window.BSAntiFraud && BSAntiFraud.evaluate)
          ? BSAntiFraud.evaluate(eventsToEval, ftConfig, srcList, state.staffDevices)
          : null;

        if (state.evalResult && window.BSDashboard) {
          var lb = state.evalResult.leaderboard || {};
          BSDashboard.renderMetrics({
            totalVisits:    state.evalResult.totalVisits     || 0,
            qualityScore:   state.evalResult.avgQualityScore || 0,
            totalReviews:   state.evalResult.totalReviews    || 0,
            waClicks:       state.evalResult.totalWa         || 0,
            conversionRate: state.evalResult.conversionRate  || 0
          });
          BSDashboard.renderLeaderboard({
            staffRanking:  lb.staff   || [],
            outletRanking: lb.outlets || []
          });
          BSDashboard.renderTrendChart({ daily: state.evalResult.daily || [] }, state.currentPeriod);
          BSDashboard.renderSourceTable(state.evalResult.sources || [], state.currentFilter);
        }

        if (BSAdmin.fraud) BSAdmin.fraud.renderTable();

        showToast('Data berhasil dimuat (' + state.events.length + ' catatan event).', 'success');
      }).catch(function (err) {
        showToast('Gagal memuat event: ' + err.message, 'error');
      }).finally(function () {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = icon('rotate', 14) + ' <span>Perbarui</span>';
        }
      });
    });
  }
  BSAdmin.loadDashboard = loadDashboard;


  /* ─────────────────────────────────────────────────────────────
   * Delegasi klik untuk atribut data-admin-action (BUG-22 / FR-V67-07).
   * Menggantikan handler inline onclick yang diblokir CSP.
   * Nama aksi = nama fungsi window.adminXxx; argumen di data-admin-arg.
   * ───────────────────────────────────────────────────────────── */
  var ACTION_ALLOWLIST = {
    adminEditOutlet: 1, adminToggleOutlet: 1, adminDeleteOutlet: 1,
    adminEditPromo: 1, adminTogglePromo: 1, adminDeletePromo: 1,
    adminEditSource: 1, adminRotateSource: 1, adminDeactivate: 1, adminDeleteSource: 1,
    adminRemoveStaffDevice: 1, adminMarkDevice: 1,
    adminEditRoleMenu: 1, adminDeleteRole: 1,
    adminPopulateUserEdit: 1, adminToggleUserActive: 1, adminDeleteUser: 1
  };

  function initActionDelegation() {
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-admin-action]') : null;
      if (!el) return;
      var name = el.getAttribute('data-admin-action');
      if (!ACTION_ALLOWLIST[name] || typeof window[name] !== 'function') return;
      e.preventDefault();
      var raw = el.getAttribute('data-admin-arg');
      if (raw === null || raw === '') {
        window[name]();
      } else {
        var args;
        try { args = JSON.parse(raw); } catch (_) { args = raw; }
        // Atribut numerik tunggal (mis. data-admin-arg="3") harus tetap jadi [3].
        if (!Array.isArray(args)) args = [args];
        window[name].apply(null, args);
      }
    });
  }
  BSAdmin.initActionDelegation = initActionDelegation;

  window.BSAdmin = BSAdmin;

})(window);
