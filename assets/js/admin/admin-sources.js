/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.4
 * admin-sources.js — Manajemen sumber, staf hotel, sales WA, rotasi kode, titik NFC & Impor/Ekspor CSV (FR-CRUD-AUTO, FR-V64-05)
 *
 * Setiap aksi CRUD (Tambah, Edit, Rotasi, Aktif/Nonaktif, Hapus, Impor CSV) OTOMATIS tersimpan ke Google Sheets!
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id;
  var esc = BSAdmin.esc;
  var icon = BSAdmin.icon || function () { return ''; };

  /* ─────────────────────────────────────────────────────────────
   * 1. Helper Auto-Save Sumber ke Cloud (FR-CRUD-AUTO)
   * ───────────────────────────────────────────────────────────── */
  function autoSyncSources(successMsg) {
    if (!window.BSStaffManager || typeof BSStaffManager.syncToCloud !== 'function') {
      return Promise.resolve();
    }
    var saveBtn = $id('adm-save-sources-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Menyimpan ke Cloud…';
    }
    BSAdmin.updateSyncStatus('saving');

    function attemptSync() {
      return BSStaffManager.syncToCloud().then(function () {
        BSAdmin.updateSyncStatus('saved');
        if (successMsg) BSAdmin.showToast(successMsg, 'success');
      }).catch(function (err) {
        BSAdmin.updateSyncStatus('failed', err.message, attemptSync);
        BSAdmin.showToast('Tersimpan lokal, namun gagal sinkron ke server: ' + err.message, 'error');
      }).finally(function () {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = icon('save', 14) + ' <span>Simpan &amp; Sinkronkan ke Cloud</span>';
        }
      });
    }

    return attemptSync();
  }

  /* ─────────────────────────────────────────────────────────────
   * 2. Render Tabel Sumber
   * ───────────────────────────────────────────────────────────── */
  function renderSourcesTable() {
    var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
    var tbody   = $id('adm-sources-tbody');
    if (!tbody) return;

    if (sources.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" class="bs-empty">Belum ada data sumber. Klik "+ Tambah Staf / Titik" atau "Impor CSV".</td></tr>';
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

  /* ─────────────────────────────────────────────────────────────
   * 3. Modal Tambah / Edit Sumber
   * ───────────────────────────────────────────────────────────── */
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

  function refreshAllSourceViews() {
    renderSourcesTable();
    if (BSAdmin.content && typeof BSAdmin.content.renderSalesWa === 'function') {
      BSAdmin.content.renderSalesWa();
    }
    if (BSAdmin.nfc && typeof BSAdmin.nfc.populateSelect === 'function') {
      BSAdmin.nfc.populateSelect();
    }
    if (BSAdmin.reports && typeof BSAdmin.reports.renderBulkQr === 'function') {
      BSAdmin.reports.renderBulkQr();
    }
  }

  /* ─────────────────────────────────────────────────────────────
   * 4. Aksi Global Sumber (Otomatis Tersimpan ke Cloud — FR-CRUD-AUTO)
   * ───────────────────────────────────────────────────────────── */
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
      refreshAllSourceViews();
      autoSyncSources('Kode berhasil dirotasi menjadi ' + updated.code + ' dan disimpan ke server.');
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
    if (!confirm('Yakin ingin ' + action + ' sumber "' + src.name + '"?')) return;
    try {
      if (src.active) BSStaffManager.deactivateSource(code);
      else BSStaffManager.updateSource(code, { active: true });
      refreshAllSourceViews();
      autoSyncSources('Status sumber "' + src.name + '" berhasil diperbarui dan disimpan ke server.');
    } catch (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }
  };

  window.adminDeleteSource = function (code) {
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menghapus sumber.', 'warning');
      return;
    }
    if (!confirm('Hapus permanen sumber "' + code + '"? Data akan langsung dihapus dari server.')) return;
    try {
      BSStaffManager.deleteSource(code);
      refreshAllSourceViews();
      autoSyncSources('Sumber "' + code + '" berhasil dihapus dari server.');
    } catch (err) {
      BSAdmin.showToast('Gagal: ' + err.message, 'error');
    }
  };

  /* ─────────────────────────────────────────────────────────────
   * 5. Impor & Ekspor Massal Sumber via CSV (FR-V64-05)
   * ───────────────────────────────────────────────────────────── */
  function csvEscape(val) {
    var s = (val === null || val === undefined) ? '' : String(val);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function parseCsvLine(line) {
    var result = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQuotes = true; }
        else if (ch === ',') { result.push(cur.trim()); cur = ''; }
        else { cur += ch; }
      }
    }
    result.push(cur.trim());
    return result;
  }

  function exportSourcesCsv() {
    var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
    if (!sources.length) {
      BSAdmin.showToast('Belum ada data sumber untuk diekspor.', 'warning');
      return;
    }
    var headers = ['code', 'name', 'type', 'outlet', 'role', 'whatsapp', 'service_hours', 'welcome_template', 'active', 'kartu_diprogram'];
    var lines = [headers.join(',')];
    sources.forEach(function (s) {
      lines.push(headers.map(function (h) { return csvEscape(s[h]); }).join(','));
    });
    var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'bumi-surabaya-sources-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    BSAdmin.showToast('File CSV daftar sumber berhasil diunduh.', 'success');
  }

  function handleImportSourcesCsv(file) {
    if (!file) return;
    if (!BSAdmin.checkPermission('save_sources')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengimpor sumber.', 'warning');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var text = String(ev.target.result || '').replace(/^\uFEFF/, '');
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        if (lines.length < 2) {
          BSAdmin.showToast('File CSV kosong atau tidak memiliki baris data.', 'error');
          return;
        }
        var headers = parseCsvLine(lines[0]).map(function (h) { return h.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
        var idxName   = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('nama');
        var idxType   = headers.indexOf('type') !== -1 ? headers.indexOf('type') : headers.indexOf('tipe');
        var idxOutlet = headers.indexOf('outlet') !== -1 ? headers.indexOf('outlet') : headers.indexOf('gerai');
        var idxRole   = headers.indexOf('role') !== -1 ? headers.indexOf('role') : headers.indexOf('jabatan');
        var idxWa     = headers.indexOf('whatsapp') !== -1 ? headers.indexOf('whatsapp') : headers.indexOf('wa');
        var idxHours  = headers.indexOf('service_hours');
        var idxTmpl   = headers.indexOf('welcome_template');
        var idxCode   = headers.indexOf('code');

        if (idxName === -1) {
          BSAdmin.showToast('Kolom "name" (atau "nama") wajib ada pada baris header CSV.', 'error');
          return;
        }

        var existingSources = BSStaffManager.getSources();
        var addedCount = 0;
        var updatedCount = 0;

        for (var r = 1; r < lines.length; r++) {
          var cols = parseCsvLine(lines[r]);
          var name = (cols[idxName] || '').trim();
          if (!name) continue;
          var type = (idxType !== -1 && cols[idxType] ? cols[idxType].trim().toLowerCase() : 'staff');
          if (['staff', 'sales', 'nfc', 'outlet'].indexOf(type) === -1) type = 'staff';
          var outlet = idxOutlet !== -1 ? (cols[idxOutlet] || '').trim() : '';
          var role   = idxRole !== -1   ? (cols[idxRole]   || '').trim() : '';
          var wa     = idxWa !== -1     ? (cols[idxWa]     || '').replace(/[^0-9]/g, '') : '';
          var hours  = idxHours !== -1  ? (cols[idxHours]  || '').trim() : '';
          var tmpl   = idxTmpl !== -1   ? (cols[idxTmpl]   || '').trim() : '';
          var code   = idxCode !== -1   ? (cols[idxCode]   || '').trim() : '';

          var match = existingSources.find(function (s) {
            return (code && s.code === code) || (s.name.toLowerCase() === name.toLowerCase() && s.type === type);
          });

          if (match) {
            BSStaffManager.updateSource(match.code, {
              name: name, type: type, outlet: outlet, role: role,
              whatsapp: wa, service_hours: hours, welcome_template: tmpl
            });
            updatedCount++;
          } else {
            BSStaffManager.addSource({
              name: name, type: type, outlet: outlet, role: role,
              whatsapp: wa, service_hours: hours, welcome_template: tmpl
            });
            addedCount++;
          }
        }

        refreshAllSourceViews();
        autoSyncSources('Impor CSV berhasil (' + addedCount + ' baru, ' + updatedCount + ' diperbarui) & otomatis disimpan ke server.');
      } catch (err) {
        BSAdmin.showToast('Gagal memproses file CSV: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ─────────────────────────────────────────────────────────────
   * 6. Inisialisasi Event Listener Modul Sources
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

    // Form submit: Tambah / Edit Sumber atau Sales -> Otomatis tersimpan ke Cloud!
    var form = $id('adm-source-form');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name   = ($id('adm-src-name') ? $id('adm-src-name').value : '').trim();
        var type   = $id('adm-src-type') ? $id('adm-src-type').value : '';
        var role   = ($id('adm-src-role') ? $id('adm-src-role').value : '').trim();
        var outlet = $id('adm-src-outlet') ? $id('adm-src-outlet').value : '';
        var wa     = ($id('adm-src-wa') ? $id('adm-src-wa').value : '').replace(/[^0-9]/g, '');
        if (wa.indexOf('08') === 0) wa = '62' + wa.substring(1);
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
          var isEdit = Boolean(BSAdmin.state.editingCode);
          if (isEdit) {
            BSStaffManager.updateSource(BSAdmin.state.editingCode, {
              name: name, type: type, role: role, outlet: outlet, whatsapp: wa,
              service_hours: hours, welcome_template: tmpl
            });
          } else {
            BSStaffManager.addSource({
              name: name, type: type, role: role, outlet: outlet, whatsapp: wa,
              service_hours: hours, welcome_template: tmpl
            });
          }
          closeSourceModal();
          refreshAllSourceViews();
          autoSyncSources((isEdit ? 'Perubahan sumber "' : 'Sumber baru "') + name + '" berhasil disimpan otomatis ke server.');
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
        autoSyncSources('Seluruh data sumber berhasil disinkronkan ke Google Sheets.');
      });
    }

    var exportCsvBtn = $id('adm-export-sources-csv-btn');
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportSourcesCsv);
    }

    var importCsvBtn  = $id('adm-import-sources-csv-btn');
    var importCsvFile = $id('adm-import-sources-file');
    if (importCsvBtn && importCsvFile) {
      importCsvBtn.addEventListener('click', function () {
        importCsvFile.value = '';
        importCsvFile.click();
      });
      importCsvFile.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          handleImportSourcesCsv(this.files[0]);
        }
      });
    }
  }

  BSAdmin.sources = {
    render:          renderSourcesTable,
    openModal:       openSourceModal,
    closeModal:      closeSourceModal,
    autoSyncSources: autoSyncSources,
    exportCsv:       exportSourcesCsv,
    init:            init
  };

  window.BSAdmin = BSAdmin;

})(window);
