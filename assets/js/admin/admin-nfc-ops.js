/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-nfc-ops.js — Programmer Kartu NFC & Preview QR Tunggal (QRN-03, QRN-04)
 *
 * Mengelola interaksi Web NFC API (Android Chrome), status penulisan kartu 4-tahap,
 * pembuatan preview QR individual, dan pencatatan status fisik kartu.
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };

  /* ─────────────────────────────────────────────────────────────
   * 1. Deteksi Dukungan Browser untuk Web NFC (QRN-03)
   * ───────────────────────────────────────────────────────────── */
  function checkNfcSupport() {
    var banner   = $id('adm-nfc-compat-banner');
    var writeBtn = $id('adm-nfc-write-btn');
    var supported = typeof window.BSNfc !== 'undefined' && window.BSNfc.isSupported();

    if (!supported) {
      if (banner) {
        banner.style.display = '';
        banner.innerHTML = '⚠️ <strong>Web NFC tidak didukung di browser ini.</strong> Web NFC membutuhkan Google Chrome di perangkat Android dengan sensor NFC aktif. Browser iOS (Safari) dan Desktop tidak menyediakan Web NFC API. Silakan salin URL lalu ikuti <em>Panduan Alternatif NFC Tools</em> di bawah.';
      }
      if (writeBtn) {
        writeBtn.disabled = true;
        writeBtn.title = 'Web NFC tidak didukung di browser ini';
      }
    } else {
      if (banner) banner.style.display = 'none';
      if (writeBtn && $id('adm-nfc-source-select') && $id('adm-nfc-source-select').value) {
        writeBtn.disabled = false;
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Pilihan Sumber & Preview QR Tunggal
   * ───────────────────────────────────────────────────────────── */
  function populateNfcSelect() {
    var sel = $id('adm-nfc-source-select');
    if (!sel) return;

    var sources = (window.BSStaffManager && typeof BSStaffManager.getActiveSources === 'function')
      ? BSStaffManager.getActiveSources() : [];

    var currentVal = sel.value;
    sel.innerHTML = '<option value="">— Pilih sumber —</option>';
    sources.forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s.code;
      opt.textContent = s.name + ' (' + s.type + (s.outlet ? ' · ' + s.outlet : '') + ')';
      sel.appendChild(opt);
    });

    if (currentVal && sources.some(function (s) { return s.code === currentVal; })) {
      sel.value = currentVal;
    }

    checkNfcSupport();
  }

  function handleSourceSelectChange() {
    var code = this.value;
    var urlEl    = $id('adm-nfc-url-preview');
    var writeBtn = $id('adm-nfc-write-btn');
    var markBtn  = $id('adm-nfc-mark-programmed');
    var printBtn = $id('adm-print-qr-btn');
    var qrWrap   = $id('adm-qr-preview');

    if (!code) {
      if (urlEl)    urlEl.value = '';
      if (writeBtn) writeBtn.disabled = true;
      if (markBtn)  markBtn.disabled  = true;
      if (printBtn) printBtn.disabled = true;
      if (qrWrap)   qrWrap.innerHTML = '<p class="bs-empty" style="font-size:0.82rem;">Pilih sumber untuk menampilkan QR.</p>';
      return;
    }

    var appRoot = (window.BSConfig && BSConfig.appRoot) ? BSConfig.appRoot() : '/';
    var baseUrl = (window.location.origin + appRoot).replace(/\/+$/, '') + '/';
    var fullUrl = baseUrl + '?source=' + encodeURIComponent(code);
    if (urlEl) urlEl.value = fullUrl;

    var nfcSupported = typeof window.BSNfc !== 'undefined' && window.BSNfc.isSupported();
    if (writeBtn) writeBtn.disabled = !nfcSupported;
    if (markBtn)  markBtn.disabled  = false;
    if (printBtn) printBtn.disabled = false;

    if (qrWrap) {
      qrWrap.innerHTML = '';
      if (typeof window.QRCode !== 'undefined') {
        new QRCode(qrWrap, { text: fullUrl, width: 200, height: 200, correctLevel: QRCode.CorrectLevel.M });
      } else {
        qrWrap.innerHTML = '<p class="bs-empty">Library QRCode tidak dimuat.</p>';
      }
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Penulisan Web NFC & Tandai Status Kartu
   * ───────────────────────────────────────────────────────────── */
  function markCardProgrammed(code) {
    if (!code) return;
    try {
      if (window.BSStaffManager && typeof BSStaffManager.updateSource === 'function') {
        BSStaffManager.updateSource(code, { kartu_diprogram: true, needs_reprint: false });
        BSAdmin.updateSyncStatus('unsaved');
        if (BSAdmin.sources && typeof BSAdmin.sources.render === 'function') {
          BSAdmin.sources.render();
        }
      }
    } catch (_) {}
  }

  function handleWriteNfc() {
    var url = ($id('adm-nfc-url-preview') ? $id('adm-nfc-url-preview').value : '');
    if (!url) {
      BSAdmin.showToast('Pilih sumber terlebih dahulu.', 'error');
      return;
    }

    if (typeof window.BSNfc === 'undefined' || !window.BSNfc.isSupported()) {
      BSAdmin.showToast('Web NFC tidak didukung di perangkat / browser ini.', 'error');
      checkNfcSupport();
      return;
    }

    var bar = $id('adm-nfc-status-bar');
    if (bar) {
      bar.textContent = '🔒 Meminta izin akses NFC dari browser…';
      bar.className   = 'adm-nfc-status adm-nfc-waiting';
    }

    window.BSNfc.writeCard(url, function (ev) {
      if (!bar) return;
      if (ev.status === 'permission') {
        bar.textContent = '🔒 Meminta izin akses NFC dari browser… Harap izinkan dialog.';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'waiting') {
        bar.textContent = '⏳ Izin aktif. Menunggu kartu NFC… Tempelkan kartu fisik ke belakang ponsel.';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'writing') {
        bar.textContent = '📡 Kartu terdeteksi — sedang memprogram URL ke tag NFC…';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'success') {
        bar.textContent = '✅ ' + ev.message;
        bar.className   = 'adm-nfc-status adm-nfc-ok';
        var curCode = $id('adm-nfc-source-select') ? $id('adm-nfc-source-select').value : '';
        markCardProgrammed(curCode);
        BSAdmin.showToast('Kartu NFC berhasil diprogram!', 'success');
      } else if (ev.status === 'error') {
        bar.textContent = '❌ Gagal: ' + (ev.message || 'error tidak dikenal');
        bar.className   = 'adm-nfc-status adm-nfc-err';
        BSAdmin.showToast('Gagal memprogram kartu: ' + (ev.message || 'error'), 'error');
      }
    }).catch(function () {
      // error telah ditangani dalam callback di atas
    });
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. Binding Event Listener Modul NFC
   * ───────────────────────────────────────────────────────────── */
  function init() {
    var sourceSelect = $id('adm-nfc-source-select');
    if (sourceSelect) {
      sourceSelect.addEventListener('change', handleSourceSelectChange);
    }

    var copyBtn = $id('adm-nfc-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var url = ($id('adm-nfc-url-preview') ? $id('adm-nfc-url-preview').value : '');
        if (!url) { BSAdmin.showToast('Pilih sumber terlebih dahulu.', 'error'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            BSAdmin.showToast('URL berhasil disalin ke clipboard!', 'success');
          }).catch(function () {
            BSAdmin.showToast('Salin manual: ' + url, 'info');
          });
        } else {
          BSAdmin.showToast('Salin manual: ' + url, 'info');
        }
      });
    }

    var writeBtn = $id('adm-nfc-write-btn');
    if (writeBtn) {
      writeBtn.addEventListener('click', handleWriteNfc);
    }

    var markBtn = $id('adm-nfc-mark-programmed');
    if (markBtn) {
      markBtn.addEventListener('click', function () {
        var code = ($id('adm-nfc-source-select') ? $id('adm-nfc-source-select').value : '');
        if (!code) return;
        markCardProgrammed(code);
        BSAdmin.showToast('Status kartu diperbarui: Sudah Diprogram.', 'success');
      });
    }

    var printBtn = $id('adm-print-qr-btn');
    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  }

  // Ekspor API modul
  BSAdmin.nfc = {
    checkSupport:   checkNfcSupport,
    populateSelect: populateNfcSelect,
    markProgrammed: markCardProgrammed,
    init:           init
  };

  window.BSAdmin = BSAdmin;

})(window);
