/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-core.js — Central state manager, navigation, auth lifecycle & health signals
 *
 * Mengelola state global aplikasi admin, otentikasi, perizinan role (SEC-11),
 * dan indikator status sinkronisasi & health sistem (PRD 8.3).
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};

  /* ─────────────────────────────────────────────────────────────
   * 1. State Global Portal Admin
   * ───────────────────────────────────────────────────────────── */
  var state = {
    events:           [],       // raw events dari GAS
    evalResult:       null,     // hasil evaluasi BSAntiFraud.evaluate()
    currentPeriod:    '7d',     // '7d' | '30d'
    currentFilter:    '',       // filter tombol sumber ('', 'staff', 'outlet', etc.)
    editingCode:      null,     // null = tambah baru, string = edit sumber
    editingOutletId:  null,     // null = tambah baru, number = edit gerai
    editingPromoIdx:  null,     // null = tambah baru, number = edit promo
    configData:       JSON.parse(JSON.stringify((window.BSConfig && BSConfig.DEFAULTS) || {})),
    outlets:          [],
    promos:           [],
    staffDevices:     [],
    auditLogs:        [],
    userRole:         'super_admin',
    username:         'admin',
    lastFocusedTrigger: null,
    syncStatus: {
      state:      'saved',      // 'saved' | 'unsaved' | 'saving' | 'failed'
      lastError:  null,
      hasUnsaved: false,
      retryFn:    null
    }
  };

  // Inisialisasi outlet & promosi dari config default jika belum ada
  if (state.configData.outlets && Array.isArray(state.configData.outlets)) {
    state.outlets = state.configData.outlets.slice();
  }
  if (state.configData.promotions && Array.isArray(state.configData.promotions)) {
    state.promos = state.configData.promotions.slice();
  }

  BSAdmin.state = state;

  /* ─────────────────────────────────────────────────────────────
   * 2. Helper DOM & Format Dasar
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

  /* ── Toast Helper ── */
  var _toastTimer = null;
  function showToast(msg, type) {
    var toast = $id('adm-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className   = 'adm-toast adm-toast-' + (type || 'info');
    toast.style.display = 'block';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      toast.style.display = 'none';
    }, 4000);
  }
  BSAdmin.showToast = showToast;

  /* ── Save / Sync Status Tracker (SRC-01 s/d SRC-03, SEC-09) ── */
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

  /* ── Accessible Modal Manager (GUE-14, PRD 6.3) ── */
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
   * 3. Penegakan Izin Role di Sisi UI (SEC-11)
   * ───────────────────────────────────────────────────────────── */
  var ROLE_LABELS = {
    super_admin:      'Super Administrator (Akses Penuh)',
    manager:          'Manager Operasional (Tanpa Config Sistem)',
    content_editor:   'Editor Konten (Gerai & Promosi)',
    analyst_readonly: 'Analis Data (Hanya Baca)'
  };

  function checkPermission(action) {
    var r = state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin';
    if (r === 'super_admin') return true;

    if (action === 'save_fraud_settings' || action === 'save_system_config') {
      return r === 'super_admin';
    }
    if (action === 'save_sources' || action === 'save_staff_devices') {
      return r === 'super_admin' || r === 'manager';
    }
    if (action === 'save_content') {
      return r === 'super_admin' || r === 'manager' || r === 'content_editor';
    }
    if (action === 'view_analytics' || action === 'view_audit') {
      return r === 'super_admin' || r === 'manager' || r === 'analyst_readonly';
    }
    return false;
  }
  BSAdmin.checkPermission = checkPermission;

  function applyRoleRestrictions() {
    var r = state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin';
    var u = (window.BSAuth && BSAuth.getUsername()) || 'admin';

    // Perbarui badge role di sidebar & account tab
    var userBadge = $id('adm-sidebar-user-role');
    if (userBadge) {
      userBadge.innerHTML = '<span class="adm-status-dot-sm"></span> ' + (ROLE_LABELS[r] || r);
    }
    var curUserEl = $id('adm-acc-current-user');
    if (curUserEl) {
      curUserEl.textContent = u + ' (' + (ROLE_LABELS[r] || r) + ')';
    }

    // Tampilkan banner peringatan untuk role dengan hak terbatas
    var readonlyBanner = $id('adm-readonly-banner');
    if (readonlyBanner) {
      if (r === 'analyst_readonly') {
        readonlyBanner.style.display = 'block';
        readonlyBanner.textContent = '🔒 Mode Baca-Saja: Peran analyst_readonly tidak memiliki izin untuk menyimpan perubahan data.';
      } else {
        readonlyBanner.style.display = 'none';
      }
    }

    // Batasi tombol mutasi sesuai role
    var isReadonly = (r === 'analyst_readonly');
    var isContentOnly = (r === 'content_editor');

    document.querySelectorAll('.adm-btn-mutate').forEach(function (btn) {
      if (isReadonly) {
        btn.disabled = true;
        btn.title = 'Akses dinonaktifkan: Anda memiliki hak akses baca-saja.';
      }
    });

    // Batasi tab navigasi jika role adalah content_editor
    if (isContentOnly) {
      var disallowedTabs = ['sources', 'antifraud', 'config', 'audit'];
      document.querySelectorAll('.adm-nav-item').forEach(function (item) {
        if (disallowedTabs.indexOf(item.dataset.tab) !== -1) {
          item.style.opacity = '0.4';
          item.title = 'Hanya dapat diakses oleh Super Admin & Manager.';
        }
      });
    }
  }
  BSAdmin.applyRoleRestrictions = applyRoleRestrictions;

  /* ─────────────────────────────────────────────────────────────
   * 4. Sinyal Health & Keandalan Operasional (PRD 8.3, 11E)
   * ───────────────────────────────────────────────────────────── */
  function updateHealthSignals(backendHealth) {
    var statusEl   = $id('adm-health-status');
    var beVerEl    = $id('adm-health-backend-ver');
    var feVerEl    = $id('adm-health-frontend-ver');
    var serverTsEl = $id('adm-health-server-time');
    var dlqEl      = $id('adm-health-dlq-count');

    // Cek dead-letter queue di localStorage
    var dlqCount = 0;
    try {
      var rawDlq = window.localStorage && localStorage.getItem('bs_dead_letter_queue');
      if (rawDlq) {
        var parsedDlq = JSON.parse(rawDlq);
        if (Array.isArray(parsedDlq)) dlqCount = parsedDlq.length;
      }
    } catch (_) {}

    if (feVerEl) feVerEl.textContent = 'v6.2.0-phase2 (P2)';

    if (backendHealth && backendHealth.backend_version) {
      if (statusEl) {
        statusEl.className = 'adm-health-badge adm-health-online';
        statusEl.innerHTML = '🟢 Backend Terhubung';
      }
      if (beVerEl)    beVerEl.textContent = backendHealth.backend_version;
      if (serverTsEl) serverTsEl.textContent = backendHealth.server_time || new Date().toLocaleString('id-ID');
    } else {
      if (statusEl) {
        statusEl.className = 'adm-health-badge adm-health-offline';
        statusEl.innerHTML = '🔴 Backend Terputus / Belum Diuji';
      }
    }

    if (dlqEl) {
      dlqEl.textContent = dlqCount + ' event gagal';
      dlqEl.className = dlqCount > 0 ? 'adm-badge-warn' : 'adm-badge-ok';
    }
  }
  BSAdmin.updateHealthSignals = updateHealthSignals;

  /* ─────────────────────────────────────────────────────────────
   * 5. Navigasi Antar Tab
   * ───────────────────────────────────────────────────────────── */
  var TAB_TITLES = {
    dashboard:  'Dashboard Analitik',
    sources:    'Manajemen Staf & Titik NFC',
    antifraud:  'Audit Anti-Fraud & Integritas',
    outlets:    'Manajemen Outlet F&B',
    'sales-wa': 'Nomor WhatsApp Sales & Reservasi',
    nfc:        'Programmer Kartu NFC (Web NFC)',
    'bulk-qr':  'Cetak QR Massal & Stiker Meja',
    promos:     'Promosi & Konten Halaman Tamu',
    appearance: 'Tampilan & Tema Visual',
    config:     'Konfigurasi Backend & Ambang Batas',
    account:    'Pengaturan Akun & Keamanan',
    audit:      'Jejak Audit & Riwayat Mutasi'
  };

  function switchTab(name) {
    document.querySelectorAll('.adm-nav-item').forEach(function (el) {
      el.classList.toggle('adm-nav-active', el.dataset.tab === name);
    });
    document.querySelectorAll('.adm-tab-pane').forEach(function (el) {
      el.style.display = el.id === 'tab-' + name ? '' : 'none';
    });
    var titleEl = $id('adm-topbar-title');
    if (titleEl) titleEl.textContent = TAB_TITLES[name] || name;

    // Panggil render handler per domain modul
    if (name === 'sources'    && BSAdmin.sources)    BSAdmin.sources.render();
    if (name === 'outlets'    && BSAdmin.content)    BSAdmin.content.renderOutlets();
    if (name === 'sales-wa'   && BSAdmin.content)    BSAdmin.content.renderSalesWa();
    if (name === 'promos'     && BSAdmin.content)    { BSAdmin.content.renderPromos(); BSAdmin.content.populateSections(); }
    if (name === 'appearance' && BSAdmin.appearance) BSAdmin.appearance.populate();
    if (name === 'bulk-qr'    && BSAdmin.reports)    BSAdmin.reports.renderBulkQr();
    if (name === 'nfc'        && BSAdmin.nfc)        { BSAdmin.nfc.populateSelect(); BSAdmin.nfc.checkSupport(); }
    if (name === 'config'     && BSAdmin.fraud)      BSAdmin.fraud.populateThresholds();
    if (name === 'antifraud'  && BSAdmin.fraud)      { BSAdmin.fraud.renderTable(); BSAdmin.fraud.renderStaffDevices(); }
    if (name === 'account'    && BSAdmin.fraud)      BSAdmin.fraud.populateAccount();
    if (name === 'audit'      && BSAdmin.audit)      BSAdmin.audit.load();
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
   * 7. Data Loader Koordinator (Dashboard, Config, Events)
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
      refreshBtn.textContent = '🔄 Memuat…';
    }

    // 1. Ambil data konfigurasi terproteksi admin
    window.BSApi && BSApi.getAdminData().then(function (admResp) {
      if (admResp && admResp.ok) {
        if (admResp.config) {
          state.configData = Object.assign({}, BSConfig.DEFAULTS, admResp.config);
          if (Array.isArray(admResp.config.outlets))    state.outlets = admResp.config.outlets.slice();
          if (Array.isArray(admResp.config.promotions)) state.promos  = admResp.config.promotions.slice();
        }
        if (Array.isArray(admResp.sources) && window.BSStaffManager) {
          if (typeof BSStaffManager.initSources === 'function') {
            BSStaffManager.initSources(admResp.sources);
          } else if (typeof BSStaffManager.loadFromCloud === 'function') {
            BSStaffManager.loadFromCloud().catch(function () {});
          }
        }
        if (Array.isArray(admResp.staff_devices)) {
          state.staffDevices = admResp.staff_devices.slice();
        }
        if (admResp.system_health) {
          if (admResp.system_health.current_role) {
            state.userRole = admResp.system_health.current_role;
            applyRoleRestrictions();
          }
          updateHealthSignals(admResp.system_health);
        }
      }
    }).catch(function () {
      // Fallback ke config publik jika sesi admin terbatas
      return window.BSApi && BSApi.getPublicConfig().then(function (cfgResp) {
        if (cfgResp && cfgResp.ok && cfgResp.config) {
          state.configData = Object.assign({}, BSConfig.DEFAULTS, cfgResp.config);
          if (cfgResp.system_health) updateHealthSignals(cfgResp.system_health);
        }
      }).catch(function () {});
    }).finally(function () {
      // Render modul yang terpengaruh config
      if (BSAdmin.content) {
        BSAdmin.content.renderOutlets();
        BSAdmin.content.renderPromos();
        BSAdmin.content.populateSections();
        BSAdmin.content.renderSalesWa();
      }
      if (BSAdmin.appearance) BSAdmin.appearance.populate();
      if (BSAdmin.fraud) {
        BSAdmin.fraud.populateThresholds();
        BSAdmin.fraud.renderStaffDevices();
      }

      // 2. Ambil data event
      if (!window.BSApi) return;
      BSApi.getEventsData(month, 10000).then(function (resp) {
        if (!resp.ok) throw new Error(resp.error || 'Gagal memuat data event');

        state.events = resp.events || [];
        if (Array.isArray(resp.staff_devices) && resp.staff_devices.length > 0) {
          state.staffDevices = resp.staff_devices.slice();
          if (BSAdmin.fraud) BSAdmin.fraud.renderStaffDevices();
        }

        if (BSAdmin.reports) {
          BSAdmin.reports.populateMonthSelect(resp.archive_tabs || []);
        }

        var srcList = (window.BSStaffManager && BSStaffManager.getSources)
          ? BSStaffManager.getSources() : [];
        var ftConfig = (state.configData && state.configData.fraud_thresholds)
          ? state.configData.fraud_thresholds : BSConfig.DEFAULTS.fraud_thresholds;

        // Evaluasi 8 aturan anti-fraud
        state.evalResult = (window.BSAntiFraud && BSAntiFraud.evaluate)
          ? BSAntiFraud.evaluate(state.events, ftConfig, srcList, state.staffDevices)
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

        showToast('Data berhasil dimuat — ' + state.events.length + ' event.', 'success');
      }).catch(function (err) {
        showToast('Gagal memuat event: ' + err.message, 'error');
      }).finally(function () {
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '🔄 Perbarui';
        }
      });
    });
  }
  BSAdmin.loadDashboard = loadDashboard;

  // Ekspor namespace ke global
  window.BSAdmin = BSAdmin;

})(window);
