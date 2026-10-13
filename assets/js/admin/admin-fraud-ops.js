/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-fraud-ops.js — Audit Anomali, Perangkat Staf, Konfigurasi Backend & Akun
 *
 * Mengelola deteksi fraud (8 aturan), pendaftaran HP Staf (StaffDevices — SRC-08, AF-03),
 * ambang batas fraud, koneksi backend Apps Script, dan perubahan kata sandi admin.
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
   * 1. Evaluasi Ulang & Tabel Anomali Fraud
   * ───────────────────────────────────────────────────────────── */
  function reEvaluateFraud() {
    if (!state.events || state.events.length === 0) return;
    var srcList = (window.BSStaffManager && typeof BSStaffManager.getSources === 'function')
      ? BSStaffManager.getSources() : [];
    var ftConfig = (state.configData && state.configData.fraud_thresholds)
      ? state.configData.fraud_thresholds : BSConfig.DEFAULTS.fraud_thresholds;

    state.evalResult = (window.BSAntiFraud && typeof BSAntiFraud.evaluate === 'function')
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

    renderFraudTable();
  }

  function renderFraudTable() {
    var tbody = $id('adm-fraud-tbody');
    var summary = $id('adm-fraud-summary');

    if (!state.evalResult) {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="bs-empty">Muat data dashboard terlebih dahulu.</td></tr>';
      return;
    }

    var flagsMap = state.evalResult.flagsByEventId || new Map();
    var flagged = [];
    if (Array.isArray(state.events)) {
      state.events.forEach(function (ev) {
        var eid = String(ev.event_id || '');
        if (flagsMap.has(eid)) {
          var item = Object.assign({}, ev);
          item._flags = flagsMap.get(eid);
          flagged.push(item);
        }
      });
    }

    if (summary) {
      summary.innerHTML = '<div class="adm-fraud-summary-pill">Total event anomali terdeteksi: <strong>' + flagged.length + '</strong></div>';
    }

    if (!tbody) return;
    if (flagged.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="bs-empty">Tidak ada event mencurigakan terdeteksi. Sistem beroperasi normal.</td></tr>';
      return;
    }

    tbody.innerHTML = flagged.slice(0, 200).map(function (ev) {
      var mIp = maskIp(ev.ip || '');
      var mDev = (ev.device_id || '').substring(0, 8) + '…';
      var ts = ev.ts_server ? new Date(ev.ts_server).toLocaleString('id-ID') : '—';
      var flags = (ev._flags || []).join(', ');
      return '<tr>' +
        '<td style="font-size:0.78rem;">' + esc(ts) + '</td>' +
        '<td><strong>' + esc(ev.source || '—') + '</strong></td>' +
        '<td><code style="font-size:0.75rem;">' + esc(mDev) + '</code></td>' +
        '<td><code style="font-size:0.75rem;">' + esc(mIp) + '</code></td>' +
        '<td><span class="adm-badge-err">' + esc(flags) + '</span></td>' +
        '<td>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary" onclick="adminMarkDevice(\'' + esc(ev.device_id || '') + '\',\'' + esc(ev.source || '') + '\')">📌 Daftarkan HP Staf</button>' +
        '</td>' +
      '</tr>';
    }).join('');
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Manajemen Perangkat Staf (StaffDevices — SRC-08, AF-03)
   * ───────────────────────────────────────────────────────────── */
  function renderStaffDevicesTable() {
    var tbody = $id('adm-staff-devices-tbody');
    if (!tbody) return;
    if (!state.staffDevices || state.staffDevices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="bs-empty">Belum ada perangkat staf terdaftar di sistem.</td></tr>';
      return;
    }

    tbody.innerHTML = state.staffDevices.map(function (dev, idx) {
      var devSub = (dev.device_id || '').substring(0, 12) + '…';
      var regTs = dev.registered_at ? new Date(dev.registered_at).toLocaleString('id-ID') : '—';
      return '<tr>' +
        '<td><code style="font-size:0.75rem;" title="' + esc(dev.device_id || '') + '">' + esc(devSub) + '</code></td>' +
        '<td><strong>' + esc(dev.staff_code || '—') + '</strong></td>' +
        '<td>' + esc(dev.label || '—') + '</td>' +
        '<td style="font-size:0.78rem;">' + esc(regTs) + '</td>' +
        '<td><button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" onclick="adminRemoveStaffDevice(' + idx + ')">🗑 Hapus</button></td>' +
      '</tr>';
    }).join('');

    BSAdmin.applyRoleRestrictions();
  }

  window.adminRemoveStaffDevice = function (idx) {
    if (!BSAdmin.checkPermission('save_staff_devices')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengelola perangkat staf.', 'warning');
      return;
    }
    if (idx < 0 || idx >= state.staffDevices.length) return;
    var dev = state.staffDevices[idx];
    if (!confirm('Hapus perangkat staf "' + (dev.label || dev.device_id) + '" dari StaffDevices?')) return;

    var removed = state.staffDevices.splice(idx, 1)[0];
    BSAdmin.showToast('Menghapus perangkat dari server…', 'info');
    BSApi.saveAllAdminData({ staff_devices: state.staffDevices }).then(function () {
      BSAdmin.showToast('Perangkat staf berhasil dihapus dari server.', 'success');
      renderStaffDevicesTable();
      reEvaluateFraud();
    }).catch(function (err) {
      if (removed) state.staffDevices.splice(idx, 0, removed);
      BSAdmin.showToast('Gagal menghapus perangkat: ' + err.message, 'error');
    });
  };

  window.adminMarkDevice = function (deviceId, sourceCode) {
    if (!BSAdmin.checkPermission('save_staff_devices')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mendaftarkan perangkat staf.', 'warning');
      return;
    }
    if (!deviceId) {
      BSAdmin.showToast('Device ID tidak valid.', 'error');
      return;
    }
    if (!confirm('Daftarkan perangkat ' + deviceId.substring(0, 8) + '… sebagai HP staf untuk sumber "' + sourceCode + '"?')) return;
    var exists = state.staffDevices.some(function (d) { return d.device_id === deviceId; });
    if (exists) {
      BSAdmin.showToast('Perangkat sudah terdaftar di StaffDevices.', 'warning');
      return;
    }

    var newDev = {
      device_id: deviceId,
      staff_code: sourceCode || '',
      label: 'Ditandai dari audit fraud',
      registered_at: new Date().toISOString()
    };
    state.staffDevices.push(newDev);

    BSAdmin.showToast('Menyimpan perangkat ke server (StaffDevices)…', 'info');
    BSApi.saveAllAdminData({ staff_devices: state.staffDevices }).then(function () {
      BSAdmin.showToast('✅ Perangkat HP staf berhasil disimpan ke server!', 'success');
      renderStaffDevicesTable();
      reEvaluateFraud();
    }).catch(function (err) {
      var idx = state.staffDevices.indexOf(newDev);
      if (idx !== -1) state.staffDevices.splice(idx, 1);
      BSAdmin.showToast('❌ Gagal menyimpan perangkat ke server: ' + err.message, 'error');
    });
  };

  /* ─────────────────────────────────────────────────────────────
   * 3. Form Pendaftaran Manual HP Staf
   * ───────────────────────────────────────────────────────────── */
  function handleStaffDeviceSubmit(e) {
    e.preventDefault();
    if (!BSAdmin.checkPermission('save_staff_devices')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mendaftarkan perangkat staf.', 'warning');
      return;
    }

    var devId = ($id('adm-sd-device-id').value || '').trim();
    var sCode = ($id('adm-sd-staff-code').value || '').trim();
    var label = ($id('adm-sd-label').value || '').trim();

    if (!devId || !sCode) {
      BSAdmin.showToast('Device ID dan Kode Staf wajib diisi.', 'error');
      return;
    }

    var exists = state.staffDevices.some(function (d) { return d.device_id === devId; });
    if (exists) {
      BSAdmin.showToast('Perangkat dengan Device ID ini sudah terdaftar.', 'warning');
      return;
    }

    var newDev = {
      device_id: devId,
      staff_code: sCode,
      label: label || 'Didaftarkan manual',
      registered_at: new Date().toISOString()
    };
    state.staffDevices.push(newDev);

    var btn = $id('adm-sd-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan…'; }

    BSApi.saveAllAdminData({ staff_devices: state.staffDevices }).then(function () {
      BSAdmin.showToast('✅ Perangkat staf berhasil disimpan ke server.', 'success');
      $id('adm-staff-device-form').reset();
      renderStaffDevicesTable();
      reEvaluateFraud();
    }).catch(function (err) {
      var idx = state.staffDevices.indexOf(newDev);
      if (idx !== -1) state.staffDevices.splice(idx, 1);
      BSAdmin.showToast('❌ Gagal menyimpan perangkat: ' + err.message, 'error');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '➕ Daftarkan Perangkat'; }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. Ambang Batas Anti-Fraud & Konfigurasi Backend GAS
   * ───────────────────────────────────────────────────────────── */
  function populateFraudThresholds() {
    var ft = (state.configData && state.configData.fraud_thresholds)
      ? state.configData.fraud_thresholds : BSConfig.DEFAULTS.fraud_thresholds;
    if ($id('adm-ft-velocity'))  $id('adm-ft-velocity').value  = ft.velocity_limit || 3;
    if ($id('adm-ft-burst'))     $id('adm-ft-burst').value     = ft.burst_count || 5;
    if ($id('adm-ft-low-dwell')) $id('adm-ft-low-dwell').value = Math.round((ft.low_dwell_ms || 5000) / 1000);
    if ($id('adm-ft-hopping'))   $id('adm-ft-hopping').value   = ft.hopping_sources || 4;
  }

  function handleSaveFraudThresholds() {
    if (!BSAdmin.checkPermission('save_fraud_settings')) {
      BSAdmin.showToast('Hanya Super Administrator yang dapat mengubah ambang batas anti-fraud.', 'warning');
      return;
    }

    var ft = {
      velocity_limit:   parseInt($id('adm-ft-velocity').value, 10)  || 3,
      burst_count:      parseInt($id('adm-ft-burst').value, 10)     || 5,
      low_dwell_ms:     (parseInt($id('adm-ft-low-dwell').value, 10) || 5) * 1000,
      hopping_sources:  parseInt($id('adm-ft-hopping').value, 10)   || 4
    };

    state.configData.fraud_thresholds = ft;
    var btn = $id('adm-ft-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menyimpan…'; }

    BSApi.saveAllAdminData({ fraud_settings: ft }).then(function () {
      BSAdmin.showToast('Threshold anti-fraud berhasil disimpan ke server.', 'success');
      reEvaluateFraud();
    }).catch(function (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '💾 Simpan & Sinkronkan Threshold'; }
    });
  }

  function handleSaveGasUrl() {
    var url = ($id('adm-cfg-gas-url') ? $id('adm-cfg-gas-url').value : '').trim();
    if (url) {
      if (window.BSConfig && typeof BSConfig.setGasUrl === 'function') {
        BSConfig.setGasUrl(url);
      }
      var msgEl = $id('adm-cfg-msg');
      if (msgEl) msgEl.textContent = '✅ URL backend tersimpan di LocalStorage.';
      BSAdmin.showToast('URL backend disimpan.', 'success');
    } else {
      BSAdmin.showToast('URL backend tidak boleh kosong.', 'error');
    }
  }

  function handleTestGasUrl() {
    var btn = $id('adm-cfg-test-btn');
    var msgEl = $id('adm-cfg-msg');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Menguji…'; }

    BSApi.getPublicConfig().then(function (resp) {
      if (msgEl) {
        msgEl.textContent = resp.ok
          ? '✅ Koneksi berhasil! Versi config: ' + (resp.version || '?')
          : '❌ Backend merespons tapi gagal: ' + (resp.error || '?');
      }
      if (resp.system_health) {
        BSAdmin.updateHealthSignals(resp.system_health);
      }
    }).catch(function (err) {
      if (msgEl) msgEl.textContent = '❌ Tidak dapat terhubung: ' + err.message;
      BSAdmin.updateHealthSignals(null);
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🔗 Uji Koneksi Backend'; }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 5. Tab Akun & Ganti Kata Sandi (SEC-11)
   * ───────────────────────────────────────────────────────────── */
  function populateAccount() {
    var u = (window.BSAuth && BSAuth.getUsername()) || 'admin';
    var r = state.userRole || (window.BSAuth && BSAuth.getRole()) || 'super_admin';
    var userEl = $id('adm-acc-current-user');
    if (userEl) userEl.textContent = u + ' (' + r + ')';
  }

  function handleAccountPasswordChange(e) {
    e.preventDefault();
    var oldPw = ($id('adm-acc-old-pw').value || '').trim();
    var newPw = ($id('adm-acc-new-pw').value || '').trim();
    var cfmPw = ($id('adm-acc-cfm-pw').value || '').trim();

    if (!oldPw || !newPw || !cfmPw) {
      BSAdmin.showToast('Semua kolom kata sandi wajib diisi.', 'error');
      return;
    }
    if (newPw !== cfmPw) {
      BSAdmin.showToast('Konfirmasi kata sandi baru tidak cocok.', 'error');
      return;
    }
    if (newPw.length < 6) {
      BSAdmin.showToast('Kata sandi baru minimal 6 karakter.', 'error');
      return;
    }

    var btn = $id('adm-acc-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

    BSAuth.changePassword(oldPw, newPw).then(function (res) {
      if (res.ok) {
        BSAdmin.showToast('Kata sandi administrator berhasil diubah!', 'success');
        $id('adm-acc-pw-form').reset();
      } else {
        BSAdmin.showToast(res.error || 'Gagal mengubah kata sandi.', 'error');
      }
    }).catch(function (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }).finally(function () {
      if (btn) { btn.disabled = false; btn.textContent = '🔐 Perbarui Kata Sandi Admin'; }
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 6. Binding Event Listener Modul Fraud & Config
   * ───────────────────────────────────────────────────────────── */
  function init() {
    var sdForm = $id('adm-staff-device-form');
    if (sdForm) sdForm.addEventListener('submit', handleStaffDeviceSubmit);

    var ftSaveBtn = $id('adm-ft-save-btn');
    if (ftSaveBtn) ftSaveBtn.addEventListener('click', handleSaveFraudThresholds);

    var cfgSaveBtn = $id('adm-cfg-save-btn');
    if (cfgSaveBtn) cfgSaveBtn.addEventListener('click', handleSaveGasUrl);

    var cfgTestBtn = $id('adm-cfg-test-btn');
    if (cfgTestBtn) cfgTestBtn.addEventListener('click', handleTestGasUrl);

    var accForm = $id('adm-acc-pw-form');
    if (accForm) accForm.addEventListener('submit', handleAccountPasswordChange);
  }

  // Ekspor API modul
  BSAdmin.fraud = {
    renderTable:        renderFraudTable,
    renderStaffDevices: renderStaffDevicesTable,
    populateThresholds: populateFraudThresholds,
    populateAccount:    populateAccount,
    reEvaluateFraud:    reEvaluateFraud,
    init:               init
  };

  window.BSAdmin = BSAdmin;

})(window);
