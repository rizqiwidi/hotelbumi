/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.3
 * admin-sources.js — Manajemen sumber, staf hotel, sales WA, rotasi kode & titik NFC (FR-ADM-01, FR-ADM-04, FR-CMS-05)
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id;
  var esc = BSAdmin.esc;
  var icon = BSAdmin.icon || function () { return ''; };

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
        ? '<span class="adm-badge-err" style="margin-left:4px;" title="Kode telah dirotasi, cetak ulang kartu/stiker fisik">Cetak Ulang</span>'
        : '';
      var kartuBadge = (s.kartu_diprogram
        ? '<span class="adm-badge-ok">Diprogram</span>'
        : '<span class="adm-badge-warn">Belum</span>') + reprintBadge;
      var statusBadge = s.active
        ? '<span class="adm-badge-ok">Aktif</span>'
        : '<span class="adm-badge-err">Nonaktif</span>';
      var waDisp = s.whatsapp ? ('<code style="font-size:0.76rem;">' + esc(s.whatsapp) + '</code>') : '—';

      return '<tr>' +
        '<td><code style="font-size:0.78rem;">' + esc(s.code) + '</code></td>' +
        '<td><strong>' + esc(s.name) + '</strong></td>' +
        '<td><span class="adm-role-tag">' + esc(s.type) + '</span></td>' +
        '<td>' + esc(s.outlet || '—') + '</td>' +
        '<td>' + esc(s.role || '—') + '</td>' +
        '<td>' + waDisp + '</td>' +
        '<td>' + kartuBadge + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td class="adm-actions">' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Edit Sumber" onclick="adminEditSource(\'' + esc(s.code) + '\')">' + icon('edit', 13) + ' <span>Edit</span></button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Rotasi Kode URL" onclick="adminRotateSource(\'' + esc(s.code) + '\')">' + icon('rotate', 13) + ' <span>Rotasi</span></button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" title="Ubah Status Aktif" onclick="adminDeactivate(\'' + esc(s.code) + '\')">' + icon('power', 13) + ' <span>' + (s.active ? 'Nonaktifkan' : 'Aktifkan') + '</span></button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" title="Hapus Sumber" onclick="adminDeleteSource(\'' + esc(s.code) + '\')">' + icon('trash', 13) + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  function openSourceModal(code, defaultType) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengedit sumber.', 'warning');
      return;
    }

    if (BSAdmin.content && typeof BSAdmin.content.populateOutletDropdowns === 'function') {
      BSAdmin.content.populateOutletDropdowns();
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
      if ($id('adm-src-name'))          $id('adm-src-name').value          = src.name;
      if ($id('adm-src-type'))          $id('adm-src-type').value          = src.type;
      if ($id('adm-src-role'))          $id('adm-src-role').value          = src.role || '';
      if ($id('adm-src-outlet'))        $id('adm-src-outlet').value        = src.outlet || '';
      if ($id('adm-src-wa'))            $id('adm-src-wa').value            = src.whatsapp || '';
      if ($id('adm-src-hours'))         $id('adm-src-hours').value         = src.service_hours || '';
      if ($id('adm-src-welcome-tmpl'))  $id('adm-src-welcome-tmpl').value  = src.welcome_template || '';
      if ($id('adm-src-code-preview'))  $id('adm-src-code-preview').value  = src.code;
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

  window.adminEditSource = function (code) {
    openSourceModal(code);
  };

  window.adminRotateSource = function (code) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk merotasi kode.', 'warning');
      return;
    }
    if (!confirm('Rotasi kode untuk sumber ini? Kartu NFC/QR lama akan dicabut dan ditandai perlu cetak ulang.')) return;
    try {
      var updated = BSStaffManager.rotateCode(code);
      BSAdmin.updateSyncStatus('unsaved');
      BSAdmin.showToast('Kode dirotasi menjadi: ' + updated.code + ' (Perlu cetak ulang kartu).', 'success');
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
      BSAdmin.showToast('Status sumber berhasil diubah.', 'success');
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

    var form = $id('adm-source-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name   = ($id('adm-src-name') ? $id('adm-src-name').value : '').trim();
        var type   = $id('adm-src-type') ? $id('adm-src-type').value : '';
        var role   = ($id('adm-src-role') ? $id('adm-src-role').value : '').trim();
        var outlet = $id('adm-src-outlet') ? $id('adm-src-outlet').value : '';
        var wa     = ($id('adm-src-wa') ? $id('adm-src-wa').value : '').trim();
        var hours  = ($id('adm-src-hours') ? $id('adm-src-hours').value : '').trim();
        var tmpl   = ($id('adm-src-welcome-tmpl') ? $id('adm-src-welcome-tmpl').value : '').trim();

        if (!name || !type) { BSAdmin.showToast('Nama dan tipe wajib diisi.', 'error'); return; }
        if (type === 'sales' && !wa) {
          BSAdmin.showToast('Nomor WhatsApp wajib diisi untuk tipe Sales.', 'error'); return;
        }
        if (wa && !/^628\d{7,13}$/.test(wa)) {
          BSAdmin.showToast('Format nomor WhatsApp harus diawali 628 (contoh: 6281234567890).', 'error'); return;
        }

        try {
          if (BSAdmin.state.editingCode) {
            BSStaffManager.updateSource(BSAdmin.state.editingCode, {
              name: name, type: type, role: role, outlet: outlet, whatsapp: wa,
              service_hours: hours, welcome_template: tmpl
            });
            BSAdmin.showToast('Sumber berhasil diperbarui.', 'success');
          } else {
            BSStaffManager.addSource({
              name: name, type: type, role: role, outlet: outlet, whatsapp: wa,
              service_hours: hours, welcome_template: tmpl
            });
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

    var saveBtn = $id('adm-save-sources-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        if (!BSAdmin.checkPermission('save_sources')) {
          BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menyimpan data sumber.', 'warning');
          return;
        }
        var btn = this;
        btn.disabled = true;
        btn.textContent = 'Menyinkronkan…';
        BSAdmin.updateSyncStatus('saving');

        function syncSources() {
          BSStaffManager.syncToCloud().then(function () {
            BSAdmin.updateSyncStatus('saved');
            BSAdmin.showToast('Data staf & sumber berhasil disinkronkan ke Google Sheets.', 'success');
          }).catch(function (err) {
            BSAdmin.updateSyncStatus('failed', err.message, syncSources);
            BSAdmin.showToast('Gagal sinkronisasi: ' + err.message, 'error');
          }).finally(function () {
            btn.disabled = false;
            btn.innerHTML = icon('save', 14) + ' <span>Simpan &amp; Sinkronkan ke Cloud</span>';
          });
        }
        syncSources();
      });
    }
  }

  BSAdmin.sources = {
    render:     renderSourcesTable,
    openModal:  openSourceModal,
    closeModal: closeSourceModal,
    init:       init
  };

  window.BSAdmin = BSAdmin;

})(window);
