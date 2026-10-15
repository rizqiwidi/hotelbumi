/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.3
 * admin-nfc-ops.js — Programmer Kartu NFC & Preview/Cetak QR Tunggal (FR-P1-05, FR-ADM-01)
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var esc = BSAdmin.esc || function (s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  function checkNfcSupport() {
    var banner   = $id('adm-nfc-compat-banner');
    var writeBtn = $id('adm-nfc-write-btn');
    var supported = typeof window.BSNfc !== 'undefined' && window.BSNfc.isSupported();

    if (!supported) {
      if (banner) {
        banner.style.display = '';
        banner.innerHTML = '<strong>Web NFC tidak didukung di peramban ini.</strong> Web NFC membutuhkan Google Chrome di perangkat Android dengan sensor NFC aktif. Silakan salin URL di bawah lalu gunakan panduan aplikasi <em>NFC Tools</em>.';
      }
      if (writeBtn) {
        writeBtn.disabled = true;
        writeBtn.title = 'Web NFC tidak didukung di peramban ini';
      }
    } else {
      if (banner) banner.style.display = 'none';
      if (writeBtn && $id('adm-nfc-source-select') && $id('adm-nfc-source-select').value) {
        writeBtn.disabled = false;
      }
    }
  }

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
      if (qrWrap)   qrWrap.innerHTML = '<p class="bs-empty" style="font-size:0.82rem;">Pilih sumber untuk menampilkan QR Code.</p>';
      return;
    }

    var sources = (window.BSStaffManager && typeof BSStaffManager.getSources === 'function')
      ? BSStaffManager.getSources() : [];
    var srcObj = sources.find(function (s) { return s.code === code; }) || { code: code, name: code, type: 'staff', outlet: '', role: '' };

    var appRoot = (window.BSConfig && BSConfig.appRoot) ? BSConfig.appRoot() : '/';
    var baseUrl = (window.location.origin + appRoot).replace(/\/+$/, '') + '/';
    var fullUrl = baseUrl + '?source=' + encodeURIComponent(code);
    if (urlEl) urlEl.value = fullUrl;

    var nfcSupported = typeof window.BSNfc !== 'undefined' && window.BSNfc.isSupported();
    if (writeBtn) writeBtn.disabled = !nfcSupported;
    if (markBtn)  markBtn.disabled  = false;
    if (printBtn) printBtn.disabled = false;

    if (qrWrap) {
      var subText = (srcObj.type === 'staff' || srcObj.type === 'sales')
        ? ((srcObj.role || 'Staf Hotel') + (srcObj.outlet ? ' · ' + srcObj.outlet : ''))
        : (srcObj.outlet || srcObj.role || 'Titik Layanan Tamu');
      var instText = (srcObj.type === 'staff' || srcObj.type === 'sales')
        ? 'ID Badge Resmi Staf Bumi Surabaya City Resort'
        : 'Tap kartu NFC atau pindai QR Code untuk layanan tamu';

      // Bungkus QR Code individual di dalam kartu siap-cetak (FR-P1-05)
      qrWrap.innerHTML =
        '<div class="adm-print-card-sample print-card" id="adm-single-print-card">' +
          '<div class="adm-pc-logo"><img src="../assets/images/logo-hotel.png" alt="Logo" width="110"></div>' +
          '<div class="adm-pc-qr" id="adm-single-qr-target" style="width:140px;height:140px;"></div>' +
          '<div class="adm-pc-title">' + esc(srcObj.name) + '</div>' +
          '<div class="adm-pc-sub">' + esc(subText) + '</div>' +
          '<div class="adm-pc-inst">' + esc(instText) + '</div>' +
        '</div>';

      var targetEl = $id('adm-single-qr-target');
      if (targetEl && typeof window.QRCode !== 'undefined') {
        new QRCode(targetEl, { text: fullUrl, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
      } else if (targetEl) {
        targetEl.innerHTML = '<p class="bs-empty">Pustaka QRCode tidak tersedia.</p>';
      }
    }
  }

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
      BSAdmin.showToast('Web NFC tidak didukung di perangkat atau peramban ini.', 'error');
      checkNfcSupport();
      return;
    }

    var bar = $id('adm-nfc-status-bar');
    if (bar) {
      bar.textContent = 'Meminta izin akses NFC dari peramban…';
      bar.className   = 'adm-nfc-status adm-nfc-waiting';
    }

    window.BSNfc.writeCard(url, function (ev) {
      if (!bar) return;
      if (ev.status === 'permission') {
        bar.textContent = 'Meminta izin akses NFC dari peramban… Harap izinkan dialog.';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'waiting') {
        bar.textContent = 'Izin aktif. Menunggu kartu NFC… Tempelkan kartu fisik ke belakang ponsel.';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'writing') {
        bar.textContent = 'Kartu terdeteksi — sedang memprogram URL ke tag NFC…';
        bar.className   = 'adm-nfc-status adm-nfc-waiting';
      } else if (ev.status === 'success') {
        bar.textContent = ev.message;
        bar.className   = 'adm-nfc-status adm-nfc-ok';
        var curCode = $id('adm-nfc-source-select') ? $id('adm-nfc-source-select').value : '';
        markCardProgrammed(curCode);
        BSAdmin.showToast('Kartu NFC berhasil diprogram.', 'success');
      } else if (ev.status === 'error') {
        bar.textContent = 'Gagal: ' + (ev.message || 'kesalahan tidak dikenal');
        bar.className   = 'adm-nfc-status adm-nfc-err';
        BSAdmin.showToast('Gagal memprogram kartu: ' + (ev.message || 'error'), 'error');
      }
    }).catch(function () {});
  }

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
            BSAdmin.showToast('URL berhasil disalin ke clipboard.', 'success');
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
        // Isolasi cetak hanya untuk kartu tunggal di #tab-nfc (FR-P1-05)
        document.body.classList.add('print-single-qr');
        window.print();
        setTimeout(function () {
          document.body.classList.remove('print-single-qr');
        }, 500);
      });
    }
  }

  BSAdmin.nfc = {
    checkSupport:   checkNfcSupport,
    populateSelect: populateNfcSelect,
    markProgrammed: markCardProgrammed,
    init:           init
  };

  window.BSAdmin = BSAdmin;

})(window);
