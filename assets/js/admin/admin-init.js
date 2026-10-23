/**
 * BUMI SURABAYA DIGITAL GUEST EXPERIENCE v6.7
 * admin-init.js — Bootstrapper, Lifecycle, Mobile Drawer Backdrop & Koordinasi Event Portal Admin (FR-P0-03, FR-ADM-01, FR-V65-01)
 */

(function (window) {
  'use strict';

  var BSAdmin = window.BSAdmin || {};
  var state = BSAdmin.state;
  var $id = BSAdmin.$id || function (id) { return document.getElementById(id); };
  var icon = BSAdmin.icon || function () { return ''; };

  function initApp() {
    var sidebar         = $id('adm-sidebar');
    var sidebarBackdrop = $id('adm-sidebar-backdrop');
    var sidebarToggle   = $id('adm-sidebar-toggle');
    var sidebarClose    = $id('adm-sidebar-close');
    var loginForm       = $id('adm-login-form');
    var loginErr        = $id('adm-login-err');
    var logoutBtn       = $id('adm-logout-btn');
    var refreshBtn      = $id('adm-refresh-btn');

    function setMobileSidebarOpen(isOpen) {
      if (!sidebar) return;
      sidebar.classList.toggle('adm-sidebar-open', Boolean(isOpen));
      if (sidebarBackdrop) {
        sidebarBackdrop.classList.toggle('adm-sidebar-backdrop-open', Boolean(isOpen));
      }
      document.body.classList.toggle('adm-mobile-nav-open', Boolean(isOpen));
    }

    /* ── 1. Navigasi Sidebar & Responsivitas Drawer Mobile (FR-V65-01) ── */
    document.querySelectorAll('.adm-nav-item').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        BSAdmin.switchTab(el.dataset.tab);
        if (window.innerWidth <= 768) {
          setMobileSidebarOpen(false);
        }
      });
    });

    if (sidebarToggle && sidebar) {
      sidebarToggle.addEventListener('click', function () {
        var nextState = !sidebar.classList.contains('adm-sidebar-open');
        setMobileSidebarOpen(nextState);
      });
    }
    if (sidebarClose && sidebar) {
      sidebarClose.addEventListener('click', function () {
        setMobileSidebarOpen(false);
      });
    }
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', function () {
        setMobileSidebarOpen(false);
      });
    }

    /* ── 2. Password Toggle Helper (SVG Monoline — FR-ADM-01) ── */
    function togglePw(inputId, btn) {
      var inp = $id(inputId);
      if (!inp) return;
      var isPassword = (inp.type === 'password');
      inp.type = isPassword ? 'text' : 'password';
      btn.innerHTML = icon(isPassword ? 'eye-off' : 'eye', 16);
    }

    var togglePwBtn = $id('adm-toggle-pw');
    if (togglePwBtn) {
      togglePwBtn.addEventListener('click', function () {
        togglePw('adm-password', this);
      });
    }

    /* ── 3. Modal Ganti Kata Sandi Wajib (First Login / Break-Glass — FR-P0-03) ── */
    BSAdmin.setupAccessibleModal('adm-must-change-modal');

    var mustChangeForm = $id('adm-must-change-form');
    if (mustChangeForm) {
      mustChangeForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var oldPw = ($id('adm-mc-old-pw').value || '').trim();
        var newPw = ($id('adm-mc-new-pw').value || '').trim();
        var cfmPw = ($id('adm-mc-confirm-pw').value || '').trim();
        var errEl = $id('adm-mc-err');

        if (!oldPw || !newPw || !cfmPw) {
          if (errEl) { errEl.textContent = 'Semua field wajib diisi.'; errEl.style.display = ''; }
          return;
        }
        if (newPw !== cfmPw) {
          if (errEl) { errEl.textContent = 'Konfirmasi kata sandi baru tidak sesuai.'; errEl.style.display = ''; }
          return;
        }
        if (newPw.length < 8) {
          if (errEl) { errEl.textContent = 'Kata sandi baru wajib minimal 8 karakter.'; errEl.style.display = ''; }
          return;
        }

        if (errEl) errEl.style.display = 'none';
        var btn = $id('adm-mc-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan…'; }

        window.BSAuth.changePassword(oldPw, newPw).then(function (res) {
          if (res.ok) {
            $id('adm-must-change-modal').style.display = 'none';
            BSAdmin.showToast('Kata sandi berhasil diperbarui. Selamat datang di portal.', 'success');
            BSAdmin.showPortal();
            BSAdmin.loadDashboard();
          } else {
            if (errEl) {
              errEl.textContent = res.error || 'Gagal mengubah kata sandi.';
              errEl.style.display = '';
            }
          }
        }).catch(function (err) {
          if (errEl) {
            errEl.textContent = 'Terjadi kesalahan: ' + err.message;
            errEl.style.display = '';
          }
        }).finally(function () {
          if (btn) { btn.disabled = false; btn.innerHTML = icon('lock', 14) + ' <span>Simpan Kata Sandi Baru &amp; Masuk</span>'; }
        });
      });
    }

    /* ── 4. Form Login & Otentikasi ── */
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (BSAdmin.checkLockout()) return;

        var username = ($id('adm-username').value || '').trim();
        var password = ($id('adm-password').value || '').trim();

        if (!username || !password) {
          if (loginErr) {
            loginErr.textContent = 'Isi nama pengguna dan kata sandi terlebih dahulu.';
            loginErr.style.display = '';
          }
          return;
        }

        if (loginErr) loginErr.style.display = 'none';
        var btn = $id('adm-login-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Memverifikasi…'; }

        window.BSAuth.login(username, password).then(function (res) {
          if (res.ok) {
            if (window.BSAuth.mustChangePassword()) {
              BSAdmin.showMustChangeModal(password);
            } else {
              BSAdmin.showToast('Selamat datang, ' + username + ' (' + (res.role || 'admin') + ').', 'success');
              BSAdmin.showPortal();
              BSAdmin.loadDashboard();
            }
          } else {
            if (loginErr) {
              loginErr.textContent = res.error || 'Kredensial tidak valid.';
              loginErr.style.display = '';
            }
            BSAdmin.checkLockout();
          }
        }).catch(function (err) {
          if (loginErr) {
            loginErr.textContent = 'Kesalahan jaringan: ' + err.message;
            loginErr.style.display = '';
          }
        }).finally(function () {
          if (btn) { btn.disabled = false; btn.textContent = 'Masuk ke Portal Manajemen'; }
        });
      });
    }

    /* ── 5. Form Logout ── */
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        if (state.syncStatus.hasUnsaved) {
          if (!confirm('Ada perubahan yang belum tersimpan ke server. Yakin ingin keluar?')) return;
        }
        setMobileSidebarOpen(false);
        window.BSAuth.logout();
        var portal = $id('adm-portal');
        var loginScreen = $id('adm-login-screen');
        if (portal) portal.style.display = 'none';
        if (loginScreen) loginScreen.style.display = '';
        if ($id('adm-password')) $id('adm-password').value = '';
        if (loginErr) loginErr.style.display = 'none';
        BSAdmin.showToast('Anda telah keluar dari portal admin.', 'info');
      });
    }

    /* ── 6. Tombol Refresh Global ── */
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        BSAdmin.loadDashboard();
      });
    }

    /* ── 7. Peringatan Perubahan Belum Disimpan (beforeunload) ── */
    window.addEventListener('beforeunload', function (e) {
      if (state.syncStatus && state.syncStatus.hasUnsaved) {
        e.preventDefault();
        e.returnValue = 'Ada perubahan yang belum tersimpan ke cloud. Yakin ingin menutup halaman?';
        return e.returnValue;
      }
    });

    /* ── 8. Inisialisasi Submodul Domain ── */
    if (typeof BSAdmin.initActionDelegation === 'function') BSAdmin.initActionDelegation();

    if (BSAdmin.sources && typeof BSAdmin.sources.init === 'function') BSAdmin.sources.init();
    if (BSAdmin.content && typeof BSAdmin.content.init === 'function') BSAdmin.content.init();
    if (BSAdmin.appearance && typeof BSAdmin.appearance.init === 'function') BSAdmin.appearance.init();
    if (BSAdmin.reports && typeof BSAdmin.reports.init === 'function') BSAdmin.reports.init();
    if (BSAdmin.fraud && typeof BSAdmin.fraud.init === 'function') BSAdmin.fraud.init();
    if (BSAdmin.audit && typeof BSAdmin.audit.init === 'function') BSAdmin.audit.init();
    if (BSAdmin.feedback && typeof BSAdmin.feedback.init === 'function') BSAdmin.feedback.init();
    if (BSAdmin.nfc && typeof BSAdmin.nfc.init === 'function') BSAdmin.nfc.init();

    /* ── 9. Auto-Resume Sesi ── */
    if (window.BSAuth && BSAuth.isLoggedIn()) {
      if (BSAuth.mustChangePassword()) {
        BSAdmin.showMustChangeModal();
      } else {
        BSAdmin.showPortal();
        BSAdmin.loadDashboard();
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})(window);
