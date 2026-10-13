/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-appearance.js — Manajemen tampilan, teks hero, pesan personalisasi & tema
 *
 * Mengelola preferensi tampilan tamu dengan aturan tegas:
 * PALET WARNA RESMI PRD 6.1 (Emerald #1a3c2a, Champagne Gold #c9a96e, Ivory #faf8f5)
 * DIKUNCI PERMANEN dan tidak dapat diubah ke warna di luar identitas hotel.
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id;

  /* ─────────────────────────────────────────────────────────────
   * 1. Populasi Form Tampilan
   * ───────────────────────────────────────────────────────────── */
  function populateAppearance() {
    var app = (BSAdmin.state.configData && BSAdmin.state.configData.appearance)
      ? BSAdmin.state.configData.appearance
      : ((window.BSConfig && BSConfig.DEFAULTS && BSConfig.DEFAULTS.appearance) || {});

    if ($id('adm-app-hero-title'))    $id('adm-app-hero-title').value    = app.hero_text || 'Bumi Surabaya City Resort';
    if ($id('adm-app-hero-sub'))      $id('adm-app-hero-sub').value      = app.hero_subtitle || 'Hotel Bintang Lima di Jantung Surabaya';
    if ($id('adm-app-welcome-gen'))   $id('adm-app-welcome-gen').value   = app.welcome_msg_general || 'Kami dengan bangga menyambut Anda di Bumi Surabaya City Resort.';
    if ($id('adm-app-welcome-staff')) $id('adm-app-welcome-staff').value = app.welcome_msg_staff || 'Halo! Anda saat ini dilayani dengan tulus oleh {staff_name} ({role}) dari {outlet}.';

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Simpan Pengaturan Tampilan
   * ───────────────────────────────────────────────────────────── */
  function saveAppearance() {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah tampilan.', 'warning');
      return;
    }

    var appData = {
      accent_color:        '#c9a96e', // Token resmi Champagne Gold dikunci permanen (PRD 6.1)
      hero_text:           ($id('adm-app-hero-title') ? $id('adm-app-hero-title').value : '').trim(),
      hero_subtitle:       ($id('adm-app-hero-sub') ? $id('adm-app-hero-sub').value : '').trim(),
      welcome_msg_general: ($id('adm-app-welcome-gen') ? $id('adm-app-welcome-gen').value : '').trim(),
      welcome_msg_staff:   ($id('adm-app-welcome-staff') ? $id('adm-app-welcome-staff').value : '').trim()
    };

    BSAdmin.state.configData.appearance = appData;

    var btn = $id('adm-app-save-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Menyimpan…';
    }
    BSAdmin.updateSyncStatus('saving');

    function syncApp() {
      window.BSApi && BSApi.saveAllAdminData({ config: { appearance: appData } }).then(function () {
        if (window.BSConfig) BSConfig.clearCache();
        BSAdmin.updateSyncStatus('saved');
        BSAdmin.showToast('Pengaturan tampilan berhasil diperbarui.', 'success');
      }).catch(function (err) {
        BSAdmin.updateSyncStatus('failed', err.message, syncApp);
        BSAdmin.showToast('Gagal: ' + err.message, 'error');
      }).finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '💾 Simpan Perubahan Tampilan';
        }
      });
    }
    syncApp();
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Inisialisasi Event Listener
   * ───────────────────────────────────────────────────────────── */
  function init() {
    var saveBtn = $id('adm-app-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveAppearance);
    }
  }

  // Ekspor API modul
  BSAdmin.appearance = {
    populate: populateAppearance,
    save:     saveAppearance,
    init:     init
  };

  window.BSAdmin = BSAdmin;

})(window);
