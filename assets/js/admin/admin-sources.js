/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.2 (FASE 2)
 * admin-sources.js — Manajemen sumber, staf hotel, rotasi kode, dan titik NFC
 *
 * Mengelola tab Staf & Kartu NFC, modal pembuatan/penyuntingan, rotasi kode (SRC-04),
 * dan sinkronisasi ke Google Sheets dengan status jujur (SRC-01 s/d SRC-03).
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id;
  var esc = BSAdmin.esc;

  /* ─────────────────────────────────────────────────────────────
   * 1. Render Tabel Sumber
   * ───────────────────────────────────────────────────────────── */
  function renderSourcesTable() {
    var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
    var tbody   = $id('adm-sources-tbody');
    if (!tbody) return;

    if (sources.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">Belum ada data sumber. Klik "Tambah Staf / Titik".</td></tr>';
      return;
    }

    tbody.innerHTML = sources.map(function (s) {
      var reprintBadge = s.needs_reprint
        ? '<span class="adm-badge-err" style="margin-left:4px;" title="Kode telah dirotasi, cetak ulang kartu/stiker fisik">🖨️ Cetak Ulang</span>'
        : '';
      var kartuBadge = (s.kartu_diprogram
        ? '<span class="adm-badge-ok">✅ Diprogram</span>'
        : '<span class="adm-badge-warn">⚠ Belum</span>') + reprintBadge;
      var statusBadge = s.active
        ? '<span class="adm-badge-ok">Aktif</span>'
        : '<span class="adm-badge-err">Nonaktif</span>';
      var waDisp = s.whatsapp ? ('<code>' + esc(s.whatsapp) + '</code>') : '—';

      return '<tr>' +
        '<td><code style="font-size:0.78rem;">' + esc(s.code) + '</code></td>' +
        '<td><strong>' + esc(s.name) + '</strong></td>' +
        '<td>' + esc(s.type) + '</td>' +
        '<td>' + esc(s.outlet || '—') + '</td>' +
        '<td>' + esc(s.role || '—') + '</td>' +
        '<td>' + waDisp + '</td>' +
        '<td>' + kartuBadge + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td class="adm-actions">' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Edit" onclick="adminEditSource(\'' + esc(s.code) + '\')">✏</button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Rotasi Kode" onclick="adminRotateSource(\'' + esc(s.code) + '\')">🔄</button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Toggle Aktif" onclick="adminDeactivate(\'' + esc(s.code) + '\')">' + (s.active ? '🚫' : '✅') + '</button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate"    title="Hapus" onclick="adminDeleteSource(\'' + esc(s.code) + '\')">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Modal Tambah / Edit Sumber
   * ───────────────────────────────────────────────────────────── */
  function openSourceModal(code, defaultType) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengedit sumber.', 'warning');
      return;
    }

    BSAdmin.state.lastFocusedTrigger = document.activeElement;
    BSAdmin.state.editingCode = code;
    var modal   = $id('adm-source-modal');
    var title   = $id('adm-source-modal-title');
    var codeGrp = $id('adm-src-code-group');
    if (!modal) return;

    if (code) {
      var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
      var src = sources.find(function (s) { return s.code === code; });
      if (!src) return;
      if (title) title.textContent = 'Edit Sumber: ' + src.name;
      if ($id('adm-src-name'))   $id('adm-src-name').value   = src.name;
      if ($id('adm-src-type'))   $id('adm-src-type').value   = src.type;
      if ($id('adm-src-role'))   $id('adm-src-role').value   = src.role || '';
      if ($id('adm-src-outlet')) $id('adm-src-outlet').value = src.outlet || '';
      if ($id('adm-src-wa'))     $id('adm-src-wa').value     = src.whatsapp || '';
      if ($id('adm-src-code-preview')) $id('adm-src-code-preview').value = src.code;
      if (codeGrp) codeGrp.style.display = '';
    } else {
      if (title) title.textContent = defaultType === 'sales' ? 'Tambah Sales / Marketing Baru' : 'Tambah Staf / Titik Baru';
      if ($id('adm-source-form')) $id('adm-source-form').reset();
      if (defaultType && $id('adm-src-type')) $id('adm-src-type').value = defaultType;
      if ($id('adm-src-code-preview')) $id('adm-src-code-preview').value = '';
      if (codeGrp) codeGrp.style.display = 'none';
    }

    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'false');
    if ($id('adm-src-name')) $id('adm-src-name').focus();
  }

  function closeSourceModal() {
    var modal = $id('adm-source-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    BSAdmin.state.editingCode = null;
    if (BSAdmin.state.lastFocusedTrigger && typeof BSAdmin.state.lastFocusedTrigger.focus === 'function') {
      BSAdmin.state.lastFocusedTrigger.focus();
    }
  }

  function previewSlug() {
    if (BSAdmin.state.editingCode) return;
    var nameEl = $id('adm-src-name');
    var typeEl = $id('adm-src-type');
    if (!nameEl || !typeEl) return;
    var name = nameEl.value.trim();
    var type = typeEl.value;
    if (name && type && window.BSStaffManager && typeof BSStaffManager.generateSlug === 'function') {
      try {
        var slug = BSStaffManager.generateSlug(name, type);
        if ($id('adm-src-code-preview')) $id('adm-src-code-preview').value = slug;
        if ($id('adm-src-code-group')) $id('adm-src-code-group').style.display = '';
      } catch (_) {}
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 3. Aksi Global Sumber (Edit, Rotasi, Deaktivasi, Hapus)
   * ───────────────────────────────────────────────────────────── */
  window.adminEditSource = function (code) {
    openSourceModal(code);
  };

  window.adminRotateSource = function (code) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk merotasi kode.', 'warning');
      return;
    }
    if (!confirm('Rotasi kode untuk sumber ini? Kartu NFC lama tidak lagi aktif menambah skor (SRC-04).')) return;
    try {
      var updated = BSStaffManager.rotateCode(code);
      BSAdmin.updateSyncStatus('unsaved');
      BSAdmin.showToast('Kode dirotasi menjadi: ' + updated.code + ' (Perlu cetak ulang kartu)', 'success');
      renderSourcesTable();
    } catch (err) {
      BSAdmin.showToast('Gagal rotasi: ' + err.message, 'error');
    }
  };

  window.adminDeactivate = function (code) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah status sumber.', 'warning');
      return;
    }
    var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
    var src = sources.find(function (s) { return s.code === code; });
    if (!src) return;
    var action = src.active ? 'nonaktifkan' : 'aktifkan kembali';
    if (!confirm('Yakin ingin ' + action + ' sumber ini?')) return;
    try {
      if (src.active) BSStaffManager.deactivateSource(code);
      else BSStaffManager.updateSource(code, { active: true });
      BSAdmin.updateSyncStatus('unsaved');
      BSAdmin.showToast('Status berhasil diubah.', 'success');
      renderSourcesTable();
      if (BSAdmin.content && typeof BSAdmin.content.renderSalesWa === 'function') {
        BSAdmin.content.renderSalesWa();
      }
    } catch (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }
  };

  window.adminDeleteSource = function (code) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menghapus sumber.', 'warning');
      return;
    }
    if (!confirm('Hapus permanen sumber "' + code + '"? Data tidak dapat dikembalikan.')) return;
    try {
      BSStaffManager.deleteSource(code);
      BSAdmin.updateSyncStatus('unsaved');
      BSAdmin.showToast('Sumber berhasil dihapus.', 'success');
      renderSourcesTable();
      if (BSAdmin.content && typeof BSAdmin.content.renderSalesWa === 'function') {
        BSAdmin.content.renderSalesWa();
      }
      if (BSAdmin.nfc && typeof BSAdmin.nfc.populateSelect === 'function') {
        BSAdmin.nfc.populateSelect();
      }
    } catch (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * 4. Inisialisasi Event Listener Modul Sources
   * ───────────────────────────────────────────────────────────── */
  function init() {
    if ($id('adm-add-source-btn')) {
      $id('adm-add-source-btn').addEventListener('click', function () {
        openSourceModal(null);
      });
    }
    if ($id('adm-source-modal-close'))  $id('adm-source-modal-close').addEventListener('click', closeSourceModal);
    if ($id('adm-source-modal-cancel')) $id('adm-source-modal-cancel').addEventListener('click', closeSourceModal);
    if ($id('adm-src-name')) $id('adm-src-name').addEventListener('input', previewSlug);
    if ($id('adm-src-type')) $id('adm-src-type').addEventListener('change', previewSlug);
    BSAdmin.setupAccessibleModal('adm-source-modal', closeSourceModal);

    // Form submit
    var form = $id('adm-source-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name   = ($id('adm-src-name') ? $id('adm-src-name').value : '').trim();
        var type   = $id('adm-src-type') ? $id('adm-src-type').value : '';
        var role   = ($id('adm-src-role') ? $id('adm-src-role').value : '').trim();
        var outlet = $id('adm-src-outlet') ? $id('adm-src-outlet').value : '';
        var wa     = ($id('adm-src-wa') ? $id('adm-src-wa').value : '').trim();

        if (!name || !type) { BSAdmin.showToast('Nama dan tipe wajib diisi.', 'error'); return; }
        if (type === 'sales' && !wa) {
          BSAdmin.showToast('Nomor WhatsApp wajib diisi untuk tipe Sales.', 'error'); return;
        }
        if (wa && !/^628\d{7,13}$/.test(wa)) {
          BSAdmin.showToast('Format nomor WhatsApp harus diawali 628 (contoh: 6281234567890).', 'error'); return;
        }

        try {
          if (BSAdmin.state.editingCode) {
            BSStaffManager.updateSource(BSAdmin.state.editingCode, { name: name, role: role, outlet: outlet, whatsapp: wa });
            BSAdmin.showToast('Sumber berhasil diperbarui.', 'success');
          } else {
            BSStaffManager.addSource({ name: name, type: type, role: role, outlet: outlet, whatsapp: wa });
            BSAdmin.showToast('Sumber berhasil ditambahkan.', 'success');
          }
          BSAdmin.updateSyncStatus('unsaved');
          closeSourceModal();
          renderSourcesTable();
          if (BSAdmin.content && typeof BSAdmin.content.renderSalesWa === 'function') {
            BSAdmin.content.renderSalesWa();
          }
          if (BSAdmin.nfc && typeof BSAdmin.nfc.populateSelect === 'function') {
            BSAdmin.nfc.populateSelect();
          }
        } catch (err) {
          BSAdmin.showToast('Gagal: ' + err.message, 'error');
        }
      });
    }

    // Tombol Sinkronisasi Sumber ke Cloud
    var saveBtn = $id('adm-save-sources-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!BSAdmin.checkPermission('save_sources')) {
          BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menyimpan data sumber.', 'warning');
          return;
        }
        var btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ Menyinkronkan…';
        BSAdmin.updateSyncStatus('saving');

        function syncSources() {
          BSStaffManager.syncToCloud().then(function () {
            BSAdmin.updateSyncStatus('saved');
            BSAdmin.showToast('Data staf berhasil disinkronkan ke Google Sheets.', 'success');
          }).catch(function (err) {
            BSAdmin.updateSyncStatus('failed', err.message, syncSources);
            BSAdmin.showToast('Gagal sinkronisasi: ' + err.message, 'error');
          }).finally(function () {
            btn.disabled = false;
            btn.textContent = '💾 Simpan & Sinkronkan ke Cloud';
          });
        }
        syncSources();
      });
    }
  }

  // Ekspor API modul
  BSAdmin.sources = {
    render:     renderSourcesTable,
    openModal:  openSourceModal,
    closeModal: closeSourceModal,
    init:       init
  };

  window.BSAdmin = BSAdmin;

})(window);
