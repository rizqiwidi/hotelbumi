/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.8
 * admin-content.js — Manajemen gerai F&B, promosi, 8 toggle visibilitas seksi, sales WA & live draft preview (FR-CRUD-AUTO)
 *
 * Setiap aksi CRUD (Tambah/Edit/Toggle/Hapus Gerai & Promosi, Toggle Visibilitas Seksi, Simpan WA) OTOMATIS tersimpan ke Google Sheets!
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var $id = BSAdmin.$id;
  var esc = BSAdmin.esc;
  var icon = BSAdmin.icon || function () { return ''; };

  function populateOutletDropdowns() {
    var outlets = BSAdmin.state.outlets || [];
    var names = outlets.map(function (o) { return o && o.name; }).filter(Boolean);
    if (names.length === 0) {
      names = ['Arumanis Restaurant', 'Kizahashi', 'Lobby Lounge', 'DeliKopi'];
    }

    var srcSel = $id('adm-src-outlet');
    if (srcSel) {
      var curSrc = srcSel.value;
      srcSel.innerHTML = '<option value="">— Pilih gerai / unit —</option>';
      names.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        srcSel.appendChild(opt);
      });
      ['Banquet & Wedding', 'Corporate & Room Sales', 'Front Office & Concierge'].forEach(function (u) {
        if (names.indexOf(u) === -1) {
          var opt = document.createElement('option');
          opt.value = u; opt.textContent = u;
          srcSel.appendChild(opt);
        }
      });
      if (curSrc) srcSel.value = curSrc;
    }

    var prmSel = $id('adm-prm-outlet');
    if (prmSel) {
      var curPrm = prmSel.value;
      prmSel.innerHTML = '';
      names.forEach(function (n) {
        var opt = document.createElement('option');
        opt.value = n; opt.textContent = n;
        prmSel.appendChild(opt);
      });
      if (curPrm) prmSel.value = curPrm;
    }
  }

  function saveOutletsToCloud(toastMsg) {
    BSAdmin.state.configData.outlets = BSAdmin.state.outlets;
    BSAdmin.updateSyncStatus('saving');
    return window.BSApi && BSApi.saveAllAdminData({ config: { outlets: BSAdmin.state.outlets } }).then(function () {
      if (window.BSConfig) BSConfig.clearCache();
      BSAdmin.updateSyncStatus('saved');
      BSAdmin.showToast(toastMsg || 'Daftar gerai berhasil disimpan ke server.', 'success');
    }).catch(function (err) {
      BSAdmin.updateSyncStatus('failed', err.message, function () { saveOutletsToCloud(toastMsg); });
      BSAdmin.showToast('Gagal menyimpan gerai: ' + err.message, 'error');
    });
  }

  function savePromosToCloud(toastMsg) {
    BSAdmin.state.configData.promotions = BSAdmin.state.promos;
    BSAdmin.updateSyncStatus('saving');
    return window.BSApi && BSApi.saveAllAdminData({ config: { promotions: BSAdmin.state.promos } }).then(function () {
      if (window.BSConfig) BSConfig.clearCache();
      BSAdmin.updateSyncStatus('saved');
      BSAdmin.showToast(toastMsg || 'Daftar promosi berhasil disimpan ke server.', 'success');
    }).catch(function (err) {
      BSAdmin.updateSyncStatus('failed', err.message, function () { savePromosToCloud(toastMsg); });
      BSAdmin.showToast('Gagal menyimpan promosi: ' + err.message, 'error');
    });
  }

  function renderOutlets() {
    var grid = $id('adm-outlets-grid');
    if (!grid) return;
    var outlets = BSAdmin.state.outlets || [];

    populateOutletDropdowns();

    if (outlets.length === 0) {
      grid.innerHTML = '<p class="bs-empty" style="grid-column:1/-1;">Belum ada gerai F&amp;B terdaftar. Klik "+ Tambah Gerai Baru".</p>';
      return;
    }

    grid.innerHTML = outlets.map(function (o, idx) {
      var isAct = (o.active !== false);
      var activeBadge = isAct
        ? '<span class="adm-badge-ok">Aktif</span>'
        : '<span class="adm-badge-err">Nonaktif</span>';
      var imgSrc = o.image_url || 'assets/images/outlets/arumanis.jpg';
      var resolvedImg = (window.BSConfig && BSConfig.resolveAsset) ? BSConfig.resolveAsset(imgSrc) : imgSrc;

      return '<div class="adm-outlet-card-item">' +
        '<div class="adm-outlet-card-media">' +
          '<img src="' + esc(resolvedImg) + '" alt="' + esc(o.name) + '">' +
          (o.highlight ? '<span class="adm-outlet-badge-tag">' + esc(o.highlight) + '</span>' : '') +
        '</div>' +
        '<div class="adm-outlet-card-body">' +
          '<div class="adm-outlet-card-title">' + esc(o.name) + '</div>' +
          '<div class="adm-outlet-card-type">' + esc(o.type || 'Gerai Restoran') + '</div>' +
          '<p class="adm-outlet-card-desc">' + esc(o.description || '') + '</p>' +
          '<div class="adm-outlet-meta-row">' +
            '<span>' + icon('clock', 13) + ' ' + esc(o.hours || '06.00 – 22.00 WIB') + '</span>' +
            activeBadge +
          '</div>' +
          '<div class="adm-outlet-card-actions">' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminEditOutlet" data-admin-arg="' + idx + '">' + icon('edit', 13) + ' <span>Edit Detail</span></button>' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminToggleOutlet" data-admin-arg="' + idx + '">' + icon('power', 13) + ' <span>' + (isAct ? 'Nonaktifkan' : 'Aktifkan') + '</span></button>' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" data-admin-action="adminDeleteOutlet" data-admin-arg="' + idx + '">' + icon('trash', 13) + ' <span>Hapus</span></button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  function openOutletModal(idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengedit gerai.', 'warning');
      return;
    }

    BSAdmin.state.lastFocusedTrigger = document.activeElement;
    BSAdmin.state.editingOutletId = (idx !== null && idx !== undefined) ? idx : null;
    var modal = $id('adm-outlet-modal');
    var title = $id('adm-outlet-modal-title');
    if (!modal) return;

    var outlets = BSAdmin.state.outlets || [];
    if (BSAdmin.state.editingOutletId !== null && outlets[BSAdmin.state.editingOutletId]) {
      var otl = outlets[BSAdmin.state.editingOutletId];
      if (title) title.textContent = 'Edit Gerai: ' + otl.name;
      if ($id('adm-otl-name'))       $id('adm-otl-name').value       = otl.name;
      if ($id('adm-otl-image'))      $id('adm-otl-image').value      = otl.image_url || 'assets/images/outlets/arumanis.jpg';
      if ($id('adm-otl-type'))       $id('adm-otl-type').value       = otl.type || '';
      if ($id('adm-otl-badge'))      $id('adm-otl-badge').value      = otl.highlight || '';
      if ($id('adm-otl-desc'))       $id('adm-otl-desc').value       = otl.description || '';
      if ($id('adm-otl-hours'))      $id('adm-otl-hours').value      = otl.hours || '';
      if ($id('adm-otl-emoji'))      $id('adm-otl-emoji').value      = otl.emoji || '';
      if ($id('adm-otl-whatsapp'))   $id('adm-otl-whatsapp').value   = otl.whatsapp || '';
      if ($id('adm-otl-res-url'))    $id('adm-otl-res-url').value    = otl.reservation_url || '';
      if ($id('adm-otl-review-url')) $id('adm-otl-review-url').value = otl.review_url || '';
      if ($id('adm-otl-active'))     $id('adm-otl-active').checked   = otl.active !== false;
    } else {
      if (title) title.textContent = 'Tambah Gerai F&B Baru';
      if ($id('adm-outlet-form')) $id('adm-outlet-form').reset();
      if ($id('adm-otl-image'))   $id('adm-otl-image').value   = 'assets/images/outlets/arumanis.jpg';
      if ($id('adm-otl-active'))  $id('adm-otl-active').checked = true;
    }

    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'false');
    if ($id('adm-otl-name')) $id('adm-otl-name').focus();
  }

  function closeOutletModal() {
    var modal = $id('adm-outlet-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    BSAdmin.state.editingOutletId = null;
    if (BSAdmin.state.lastFocusedTrigger && typeof BSAdmin.state.lastFocusedTrigger.focus === 'function') {
      BSAdmin.state.lastFocusedTrigger.focus();
    }
  }

  window.adminEditOutlet = function (idx) {
    openOutletModal(idx);
  };

  window.adminToggleOutlet = function (idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah status gerai.', 'warning');
      return;
    }
    var outlets = BSAdmin.state.outlets || [];
    if (!outlets[idx]) return;
    outlets[idx].active = (outlets[idx].active === false);
    renderOutlets();
    saveOutletsToCloud('Status gerai "' + outlets[idx].name + '" diperbarui & disimpan ke server.');
  };

  window.adminDeleteOutlet = function (idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menghapus gerai.', 'warning');
      return;
    }
    var outlets = BSAdmin.state.outlets || [];
    if (!outlets[idx]) return;
    var delName = outlets[idx].name;
    if (!confirm('Hapus gerai "' + delName + '"?')) return;
    outlets.splice(idx, 1);
    renderOutlets();
    saveOutletsToCloud('Gerai "' + delName + '" dihapus dan disinkronkan ke server.');
  };

  function renderPromos() {
    var tbody = $id('adm-promos-tbody');
    if (!tbody) return;
    var promos = BSAdmin.state.promos || [];

    if (promos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="bs-empty">Belum ada promosi. Klik "+ Tambah Promosi Baru".</td></tr>';
      return;
    }

    tbody.innerHTML = promos.map(function (p, idx) {
      var isAct = (p.active !== false);
      var actBadge = isAct
        ? '<span class="adm-badge-ok">Aktif</span>'
        : '<span class="adm-badge-err">Nonaktif</span>';

      return '<tr>' +
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td>' + esc(p.outlet || '—') + '</td>' +
        '<td>' + esc(p.price || '—') + '</td>' +
        '<td>' + esc(p.period || '—') + '</td>' +
        '<td>' + actBadge + '</td>' +
        '<td class="adm-actions">' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminEditPromo" data-admin-arg="' + idx + '">' + icon('edit', 13) + ' <span>Edit</span></button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminTogglePromo" data-admin-arg="' + idx + '">' + icon('power', 13) + ' <span>' + (isAct ? 'Nonaktifkan' : 'Aktifkan') + '</span></button>' +
          '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" data-admin-action="adminDeletePromo" data-admin-arg="' + idx + '">' + icon('trash', 13) + '</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  function openPromoModal(idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengedit promosi.', 'warning');
      return;
    }

    populateOutletDropdowns();

    BSAdmin.state.lastFocusedTrigger = document.activeElement;
    BSAdmin.state.editingPromoIdx = (idx !== null && idx !== undefined) ? idx : null;
    var modal = $id('adm-promo-modal');
    var title = $id('adm-promo-modal-title');
    if (!modal) return;

    var promos = BSAdmin.state.promos || [];
    if (BSAdmin.state.editingPromoIdx !== null && promos[BSAdmin.state.editingPromoIdx]) {
      var p = promos[BSAdmin.state.editingPromoIdx];
      if (title) title.textContent = 'Edit Promosi: ' + p.name;
      if ($id('adm-prm-name'))       $id('adm-prm-name').value       = p.name;
      if ($id('adm-prm-outlet'))     $id('adm-prm-outlet').value     = p.outlet || 'Arumanis Restaurant';
      if ($id('adm-prm-price'))      $id('adm-prm-price').value      = p.price || '';
      if ($id('adm-prm-period'))     $id('adm-prm-period').value     = p.period || '';
      if ($id('adm-prm-emoji'))      $id('adm-prm-emoji').value      = p.emoji || '';
      if ($id('adm-prm-image'))      $id('adm-prm-image').value      = p.image_url || '';
      if ($id('adm-prm-desc'))       $id('adm-prm-desc').value       = p.description || '';
      if ($id('adm-prm-starts-at'))  $id('adm-prm-starts-at').value  = p.starts_at || '';
      if ($id('adm-prm-ends-at'))    $id('adm-prm-ends-at').value    = p.ends_at || '';
      if ($id('adm-prm-cta-label'))  $id('adm-prm-cta-label').value  = p.cta_label || '';
      if ($id('adm-prm-cta-url'))    $id('adm-prm-cta-url').value    = p.cta_url || '';
      if ($id('adm-prm-active'))     $id('adm-prm-active').checked   = p.active !== false;
    } else {
      if (title) title.textContent = 'Tambah Promosi Baru';
      if ($id('adm-promo-form')) $id('adm-promo-form').reset();
      if ($id('adm-prm-active')) $id('adm-prm-active').checked = true;
    }

    modal.style.display = '';
    modal.setAttribute('aria-hidden', 'false');
    if ($id('adm-prm-name')) $id('adm-prm-name').focus();
  }

  function closePromoModal() {
    var modal = $id('adm-promo-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    BSAdmin.state.editingPromoIdx = null;
    if (BSAdmin.state.lastFocusedTrigger && typeof BSAdmin.state.lastFocusedTrigger.focus === 'function') {
      BSAdmin.state.lastFocusedTrigger.focus();
    }
  }

  window.adminEditPromo = function (idx) {
    openPromoModal(idx);
  };

  window.adminTogglePromo = function (idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah status promosi.', 'warning');
      return;
    }
    var promos = BSAdmin.state.promos || [];
    if (!promos[idx]) return;
    promos[idx].active = (promos[idx].active === false);
    renderPromos();
    savePromosToCloud('Status promosi "' + promos[idx].name + '" diperbarui & disimpan ke server.');
  };

  window.adminDeletePromo = function (idx) {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menghapus promosi.', 'warning');
      return;
    }
    var promos = BSAdmin.state.promos || [];
    if (!promos[idx]) return;
    var delName = promos[idx].name;
    if (!confirm('Hapus promosi "' + delName + '"?')) return;
    promos.splice(idx, 1);
    renderPromos();
    savePromosToCloud('Promosi "' + delName + '" dihapus dan disinkronkan ke server.');
  };

  function populateSections() {
    var sec = (BSAdmin.state.configData && BSAdmin.state.configData.guest_sections)
      ? BSAdmin.state.configData.guest_sections
      : ((window.BSConfig && BSConfig.DEFAULTS && BSConfig.DEFAULTS.guest_sections) || {});

    if ($id('adm-sec-review'))     $id('adm-sec-review').checked     = sec.show_review !== false;
    if ($id('adm-sec-feedback'))   $id('adm-sec-feedback').checked   = sec.show_direct_feedback !== false;
    if ($id('adm-sec-wa'))         $id('adm-sec-wa').checked         = sec.show_wa !== false;
    if ($id('adm-sec-outlets'))    $id('adm-sec-outlets').checked    = sec.show_outlets !== false;
    if ($id('adm-sec-promos'))     $id('adm-sec-promos').checked     = sec.show_promotions !== false;
    if ($id('adm-sec-social'))     $id('adm-sec-social').checked     = sec.show_social !== false;
    if ($id('adm-sec-final-cta'))  $id('adm-sec-final-cta').checked  = sec.show_final_cta !== false;
    if ($id('adm-sec-mobile-bar')) $id('adm-sec-mobile-bar').checked = sec.show_mobile_bar !== false;
  }

  function saveSectionsToCloud() {
    if (!BSAdmin.checkPermission('save_content')) {
      BSAdmin.showToast('Peran Anda tidak memiliki izin untuk menyimpan seksi.', 'warning');
      return;
    }
    var sections = {
      show_review:          $id('adm-sec-review') ? $id('adm-sec-review').checked : true,
      show_direct_feedback: $id('adm-sec-feedback') ? $id('adm-sec-feedback').checked : true,
      show_wa:              $id('adm-sec-wa') ? $id('adm-sec-wa').checked : true,
      show_outlets:         $id('adm-sec-outlets') ? $id('adm-sec-outlets').checked : true,
      show_promotions:      $id('adm-sec-promos') ? $id('adm-sec-promos').checked : true,
      show_social:          $id('adm-sec-social') ? $id('adm-sec-social').checked : true,
      show_final_cta:       $id('adm-sec-final-cta') ? $id('adm-sec-final-cta').checked : true,
      show_mobile_bar:      $id('adm-sec-mobile-bar') ? $id('adm-sec-mobile-bar').checked : true
    };
    BSAdmin.state.configData.guest_sections = sections;

    var btn = $id('adm-save-sections-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }
    BSAdmin.updateSyncStatus('saving');

    window.BSApi && BSApi.saveAllAdminData({ config: { guest_sections: sections } }).then(function () {
      if (window.BSConfig) BSConfig.clearCache();
      BSAdmin.updateSyncStatus('saved');
      BSAdmin.showToast('Visibilitas seksi halaman tamu berhasil disimpan ke server.', 'success');
    }).catch(function (err) {
      BSAdmin.updateSyncStatus('failed', err.message, saveSectionsToCloud);
      BSAdmin.showToast('Gagal menyimpan seksi: ' + err.message, 'error');
    }).finally(function () {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = icon('save', 14) + ' <span>Simpan Visibilitas Seksi</span>';
      }
    });
  }

  function renderSalesWa() {
    var tbody = $id('adm-sales-wa-tbody');
    if (!tbody) return;
    var allSources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
    var salesList = allSources.filter(function (s) {
      return s.type === 'sales' || (s.whatsapp && s.whatsapp.length > 0);
    });

    if (salesList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="bs-empty">Belum ada tim sales dengan nomor WhatsApp. Klik "+ Tambah Sales Baru".</td></tr>';
    } else {
      tbody.innerHTML = salesList.map(function (s) {
        var statusBadge = s.active
          ? '<span class="adm-badge-ok">Aktif</span>'
          : '<span class="adm-badge-err">Nonaktif</span>';
        var waNum = s.whatsapp ? ('<code>' + esc(s.whatsapp) + '</code>') : '<span class="adm-badge-warn">Belum diisi</span>';
        var tmpl  = s.welcome_template
          ? esc(s.welcome_template)
          : ('Halo, saya tamu Bumi Surabaya. Saya dilayani oleh ' + esc(s.name) + '.');
        var hours = esc(s.service_hours || '08.00 – 21.00 WIB');

        return '<tr>' +
          '<td><strong>' + esc(s.outlet || s.role || 'Sales & Reservasi') + '</strong></td>' +
          '<td>' + esc(s.name) + '</td>' +
          '<td>' + waNum + '</td>' +
          '<td style="font-size:0.78rem;max-width:240px;">' + tmpl + '</td>' +
          '<td>' + hours + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td class="adm-actions">' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminEditSource" data-admin-arg="' + esc(JSON.stringify([s.code])) + '">' + icon('edit', 13) + ' <span>Edit</span></button>' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-secondary adm-btn-mutate" data-admin-action="adminDeactivate" data-admin-arg="' + esc(JSON.stringify([s.code])) + '">' + icon('power', 13) + ' <span>' + (s.active ? 'Nonaktifkan' : 'Aktifkan') + '</span></button>' +
            '<button type="button" class="adm-btn adm-btn-xs adm-btn-danger adm-btn-mutate" data-admin-action="adminDeleteSource" data-admin-arg="' + esc(JSON.stringify([s.code])) + '">' + icon('trash', 13) + '</button>' +
          '</td>' +
        '</tr>';
      }).join('');
    }

    var waSettings = (BSAdmin.state.configData && BSAdmin.state.configData.whatsapp_settings)
      ? BSAdmin.state.configData.whatsapp_settings
      : ((window.BSConfig && BSConfig.DEFAULTS && BSConfig.DEFAULTS.whatsapp_settings) || {});

    if ($id('adm-wa-global-num'))  $id('adm-wa-global-num').value  = waSettings.number || '628113388523';
    if ($id('adm-wa-staff-tmpl')) $id('adm-wa-staff-tmpl').value = waSettings.template_staff || 'Halo, saya tamu Bumi Surabaya. Saya baru saja dilayani oleh {staff_name} dan ingin melakukan reservasi.';
    if ($id('adm-wa-gen-tmpl'))   $id('adm-wa-gen-tmpl').value   = waSettings.template_general || 'Halo Bumi Surabaya, saya ingin informasi mengenai reservasi dan layanan hotel.';

    BSAdmin.applyRoleRestrictions && BSAdmin.applyRoleRestrictions();
  }

  function openDraftPreview() {
    if (BSAdmin.appearance && typeof BSAdmin.appearance.collectDraftToState === 'function') {
      BSAdmin.appearance.collectDraftToState();
    }

    var draftConfig = Object.assign({}, BSAdmin.state.configData, {
      promotions: BSAdmin.state.promos,
      outlets:    BSAdmin.state.outlets
    });

    try {
      sessionStorage.setItem('bs_preview_config', JSON.stringify(draftConfig));
      var sources = (window.BSStaffManager && BSStaffManager.getSources) ? BSStaffManager.getSources() : [];
      sessionStorage.setItem('bs_preview_sources', JSON.stringify(sources));
    } catch (e) {
      console.warn('[BSAdmin] Gagal menyimpan preview ke sessionStorage:', e);
    }

    var modal = $id('adm-preview-modal');
    var iframe = $id('adm-preview-iframe');
    if (!modal || !iframe) {
      window.open('../index.html?preview=1', '_blank');
      return;
    }

    iframe.src = '../index.html?preview=1&_t=' + Date.now();
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeDraftPreview() {
    var modal = $id('adm-preview-modal');
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    var iframe = $id('adm-preview-iframe');
    if (iframe) iframe.src = 'about:blank';
  }

  function init() {
    populateOutletDropdowns();

    if ($id('adm-add-outlet-btn')) {
      $id('adm-add-outlet-btn').addEventListener('click', function () { openOutletModal(null); });
    }
    if ($id('adm-outlet-modal-close'))  $id('adm-outlet-modal-close').addEventListener('click', closeOutletModal);
    if ($id('adm-outlet-modal-cancel')) $id('adm-outlet-modal-cancel').addEventListener('click', closeOutletModal);
    BSAdmin.setupAccessibleModal('adm-outlet-modal', closeOutletModal);

    var outletForm = $id('adm-outlet-form');
    if (outletForm) {
      outletForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name  = ($id('adm-otl-name').value || '').trim();
        var img   = ($id('adm-otl-image') ? $id('adm-otl-image').value : '').trim() || 'assets/images/outlets/arumanis.jpg';
        var type  = ($id('adm-otl-type') ? $id('adm-otl-type').value : '').trim();
        var badge = ($id('adm-otl-badge') ? $id('adm-otl-badge').value : '').trim();
        var desc  = ($id('adm-otl-desc') ? $id('adm-otl-desc').value : '').trim();
        var hours = ($id('adm-otl-hours') ? $id('adm-otl-hours').value : '').trim();
        var emoji = ($id('adm-otl-emoji') ? $id('adm-otl-emoji').value : '').trim() || '🍽️';
        var wa    = ($id('adm-otl-whatsapp') ? $id('adm-otl-whatsapp').value : '').trim();
        var rUrl  = ($id('adm-otl-res-url') ? $id('adm-otl-res-url').value : '').trim();
        var gUrl  = ($id('adm-otl-review-url') ? $id('adm-otl-review-url').value : '').trim();
        var act   = $id('adm-otl-active') ? $id('adm-otl-active').checked : true;

        if (!name) { BSAdmin.showToast('Nama gerai wajib diisi.', 'error'); return; }

        var record = {
          id:              name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name:            name,
          image_url:       img.replace(/^\.\.\//, ''),
          type:            type,
          highlight:       badge,
          description:     desc,
          hours:           hours,
          emoji:           emoji,
          whatsapp:        wa,
          reservation_url: rUrl,
          review_url:      gUrl,
          active:          act
        };

        if (BSAdmin.state.editingOutletId !== null && BSAdmin.state.outlets[BSAdmin.state.editingOutletId]) {
          BSAdmin.state.outlets[BSAdmin.state.editingOutletId] = Object.assign({}, BSAdmin.state.outlets[BSAdmin.state.editingOutletId], record);
        } else {
          BSAdmin.state.outlets.push(record);
        }

        closeOutletModal();
        renderOutlets();
        saveOutletsToCloud('Data gerai "' + name + '" berhasil disimpan otomatis ke server.');
      });
    }

    if ($id('adm-add-promo-btn')) {
      $id('adm-add-promo-btn').addEventListener('click', function () { openPromoModal(null); });
    }
    if ($id('adm-promo-modal-close'))  $id('adm-promo-modal-close').addEventListener('click', closePromoModal);
    if ($id('adm-promo-modal-cancel')) $id('adm-promo-modal-cancel').addEventListener('click', closePromoModal);
    BSAdmin.setupAccessibleModal('adm-promo-modal', closePromoModal);

    var promoForm = $id('adm-promo-form');
    if (promoForm) {
      promoForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var name     = ($id('adm-prm-name').value || '').trim();
        var outlet   = $id('adm-prm-outlet') ? $id('adm-prm-outlet').value : '';
        var price    = ($id('adm-prm-price') ? $id('adm-prm-price').value : '').trim();
        var period   = ($id('adm-prm-period') ? $id('adm-prm-period').value : '').trim();
        var emoji    = ($id('adm-prm-emoji') ? $id('adm-prm-emoji').value : '').trim() || '🍽️';
        var img      = ($id('adm-prm-image') ? $id('adm-prm-image').value : '').trim();
        var desc     = ($id('adm-prm-desc') ? $id('adm-prm-desc').value : '').trim();
        var startsAt = ($id('adm-prm-starts-at') ? $id('adm-prm-starts-at').value : '').trim();
        var endsAt   = ($id('adm-prm-ends-at') ? $id('adm-prm-ends-at').value : '').trim();
        var ctaLbl   = ($id('adm-prm-cta-label') ? $id('adm-prm-cta-label').value : '').trim();
        var ctaUrl   = ($id('adm-prm-cta-url') ? $id('adm-prm-cta-url').value : '').trim();
        var act      = $id('adm-prm-active') ? $id('adm-prm-active').checked : true;

        if (!name) { BSAdmin.showToast('Nama promosi wajib diisi.', 'error'); return; }

        var record = {
          id:          name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name:        name,
          outlet:      outlet,
          price:       price,
          period:      period,
          emoji:       emoji,
          image_url:   img,
          description: desc,
          starts_at:   startsAt,
          ends_at:     endsAt,
          cta_label:   ctaLbl,
          cta_url:     ctaUrl,
          active:      act
        };

        if (BSAdmin.state.editingPromoIdx !== null && BSAdmin.state.promos[BSAdmin.state.editingPromoIdx]) {
          BSAdmin.state.promos[BSAdmin.state.editingPromoIdx] = Object.assign({}, BSAdmin.state.promos[BSAdmin.state.editingPromoIdx], record);
        } else {
          BSAdmin.state.promos.push(record);
        }

        closePromoModal();
        renderPromos();
        savePromosToCloud('Promosi "' + name + '" berhasil disimpan otomatis ke server.');
      });
    }

    // Auto-save saat checkbox visibilitas seksi diubah maupun saat tombol Simpan diklik (FR-CRUD-AUTO)
    ['adm-sec-review', 'adm-sec-feedback', 'adm-sec-wa', 'adm-sec-outlets', 'adm-sec-promos', 'adm-sec-social', 'adm-sec-final-cta', 'adm-sec-mobile-bar'].forEach(function (chkId) {
      var chk = $id(chkId);
      if (chk) {
        chk.addEventListener('change', saveSectionsToCloud);
      }
    });

    if ($id('adm-save-sections-btn')) {
      $id('adm-save-sections-btn').addEventListener('click', saveSectionsToCloud);
    }

    if ($id('adm-add-sales-wa-btn')) {
      $id('adm-add-sales-wa-btn').addEventListener('click', function () {
        if (BSAdmin.sources && typeof BSAdmin.sources.openModal === 'function') {
          BSAdmin.sources.openModal(null, 'sales');
        }
      });
    }

    if ($id('adm-save-global-wa-btn')) {
      $id('adm-save-global-wa-btn').addEventListener('click', function () {
        if (!BSAdmin.checkPermission('save_content')) {
          BSAdmin.showToast('Peran Anda tidak memiliki izin untuk mengubah nomor WhatsApp.', 'warning');
          return;
        }
        var num = ($id('adm-wa-global-num') ? $id('adm-wa-global-num').value : '').replace(/[^0-9]/g, '');
        if (num.indexOf('08') === 0) num = '62' + num.substring(1);
        var stm = ($id('adm-wa-staff-tmpl') ? $id('adm-wa-staff-tmpl').value : '').trim();
        var gtm = ($id('adm-wa-gen-tmpl') ? $id('adm-wa-gen-tmpl').value : '').trim();

        if (!num || !/^628\d{7,13}$/.test(num)) {
          BSAdmin.showToast('Nomor WhatsApp hotel harus diawali 628 (contoh: 628113388523).', 'error');
          return;
        }

        var waSettings = {
          number:           num,
          template_staff:   stm,
          template_general: gtm
        };
        BSAdmin.state.configData.whatsapp_settings = waSettings;

        var btn = this;
        btn.disabled = true;
        btn.textContent = 'Menyimpan…';
        BSAdmin.updateSyncStatus('saving');
        window.BSApi && BSApi.saveAllAdminData({ config: { whatsapp_settings: waSettings } }).then(function () {
          if (window.BSConfig) BSConfig.clearCache();
          BSAdmin.updateSyncStatus('saved');
          BSAdmin.showToast('Pengaturan WhatsApp global berhasil disimpan.', 'success');
        }).catch(function (err) {
          BSAdmin.updateSyncStatus('failed', err.message);
          BSAdmin.showToast('Gagal: ' + err.message, 'error');
        }).finally(function () {
          btn.disabled = false;
          btn.innerHTML = icon('save', 14) + ' <span>Simpan Pengaturan WhatsApp Global</span>';
        });
      });
    }

    ['adm-preview-draft-btn', 'adm-preview-draft-btn-outlets', 'adm-cms-preview-btn'].forEach(function (id) {
      var b = $id(id);
      if (b) b.addEventListener('click', openDraftPreview);
    });

    if ($id('adm-preview-mode-mobile')) {
      $id('adm-preview-mode-mobile').addEventListener('click', function () {
        var iframe = $id('adm-preview-iframe');
        if (iframe) iframe.style.width = '414px';
      });
    }
    if ($id('adm-preview-mode-desktop')) {
      $id('adm-preview-mode-desktop').addEventListener('click', function () {
        var iframe = $id('adm-preview-iframe');
        if (iframe) iframe.style.width = '100%';
      });
    }
    if ($id('adm-preview-modal-close')) {
      $id('adm-preview-modal-close').addEventListener('click', closeDraftPreview);
    }
    BSAdmin.setupAccessibleModal('adm-preview-modal', closeDraftPreview);
  }

  BSAdmin.content = {
    populateOutletDropdowns: populateOutletDropdowns,
    renderOutlets:           renderOutlets,
    openOutletModal:         openOutletModal,
    closeOutletModal:        closeOutletModal,
    renderPromos:            renderPromos,
    openPromoModal:          openPromoModal,
    closePromoModal:         closePromoModal,
    populateSections:        populateSections,
    renderSalesWa:           renderSalesWa,
    openDraftPreview:        openDraftPreview,
    closeDraftPreview:       closeDraftPreview,
    init:                    init
  };

  window.BSAdmin = BSAdmin;

})(window);
