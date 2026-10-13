/**
 * BUMI SURABAYA v6.0
 * auth.js — Login session & credentials management
 *
 * - Autentikasi berbasis Username & Password (tab Sheets 'Users')
 * - Token sesi acak 32 hex disimpan di sessionStorage (TTL 6 jam di GAS, 8 jam client)
 * - Brute-force protection: maks 5 kali gagal / 15 menit
 * - Alur paksa ganti password jika must_change=TRUE
 */

(function(window) {
  'use strict';

  var TOKEN_KEY       = 'bs_admin_token';
  var ROLE_KEY        = 'bs_admin_role';
  var USERNAME_KEY    = 'bs_admin_username';
  var MUST_CHANGE_KEY = 'bs_admin_must_change';
  var LOGIN_TIME      = 'bs_admin_login_ts';
  var BF_KEY          = 'bs_login_fails';
  var BF_TS_KEY       = 'bs_login_fails_ts';

  var MAX_FAILS   = 5;
  var LOCKOUT_MS  = 15 * 60 * 1000;  // 15 menit
  var SESSION_TTL = 6 * 60 * 60 * 1000; // 6 jam (sesuai backend GAS)

  function getToken()       { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function getRole()        { return sessionStorage.getItem(ROLE_KEY)  || ''; }
  function getUsername()    { return sessionStorage.getItem(USERNAME_KEY) || 'Administrator'; }
  function isMustChange()   { return sessionStorage.getItem(MUST_CHANGE_KEY) === 'true'; }
  function setMustChange(v) { sessionStorage.setItem(MUST_CHANGE_KEY, String(!!v)); }

  function isLoggedIn() {
    var token = getToken();
    if (!token) return false;
    var ts = parseInt(sessionStorage.getItem(LOGIN_TIME) || '0', 10);
    if (Date.now() - ts > SESSION_TTL) { logout(); return false; }
    return true;
  }

  function saveSession(token, role, username, mustChange) {
    sessionStorage.setItem(TOKEN_KEY,       token);
    sessionStorage.setItem(ROLE_KEY,        role || 'super_admin');
    sessionStorage.setItem(USERNAME_KEY,    username || 'admin');
    sessionStorage.setItem(MUST_CHANGE_KEY, String(!!mustChange));
    sessionStorage.setItem(LOGIN_TIME,      String(Date.now()));
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(USERNAME_KEY);
    sessionStorage.removeItem(MUST_CHANGE_KEY);
    sessionStorage.removeItem(LOGIN_TIME);
    if (window.BSConfig) window.BSConfig.clearCache();
  }

  // Brute-force tracking (di sessionStorage per-tab/browser session)
  function getFailCount() {
    var ts   = parseInt(sessionStorage.getItem(BF_TS_KEY) || '0', 10);
    var fails= parseInt(sessionStorage.getItem(BF_KEY)    || '0', 10);
    if (Date.now() - ts > LOCKOUT_MS) {
      sessionStorage.removeItem(BF_KEY);
      sessionStorage.removeItem(BF_TS_KEY);
      return 0;
    }
    return fails;
  }
  function addFail() {
    var fails = getFailCount();
    sessionStorage.setItem(BF_KEY,    String(fails + 1));
    sessionStorage.setItem(BF_TS_KEY, String(Date.now()));
  }
  function resetFails() {
    sessionStorage.removeItem(BF_KEY);
    sessionStorage.removeItem(BF_TS_KEY);
  }
  function isLockedOut() { return getFailCount() >= MAX_FAILS; }
  function remainingLockMs() {
    var ts = parseInt(sessionStorage.getItem(BF_TS_KEY) || '0', 10);
    var remaining = LOCKOUT_MS - (Date.now() - ts);
    return Math.max(0, remaining);
  }

  /**
   * Login dengan username & password ke backend Google Apps Script.
   * @param {string} username
   * @param {string} password
   * @returns {Promise<{ok:boolean, token:string, username:string, must_change:boolean, role:string}>}
   */
  function login(username, password) {
    var gasUrl = (window.BSConfig && BSConfig.getGasUrl()) || '';
    if (!gasUrl) return Promise.reject(new Error('URL backend belum dikonfigurasi.'));

    return fetch(gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({ action: 'login', username: username, password: password })
    })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.ok && resp.token) {
        saveSession(resp.token, resp.role || 'super_admin', resp.username || username, !!resp.must_change);
        resetFails();
        return resp;
      }
      addFail();
      var err = (resp && resp.error) || 'Nama pengguna atau kata sandi tidak valid.';
      throw new Error(err);
    });
  }

  /**
   * Perbarui kata sandi pengguna via endpoint change_password.
   * @param {string} oldPassword
   * @param {string} newPassword
   * @returns {Promise<{ok:boolean, message:string}>}
   */
  function changePassword(oldPassword, newPassword) {
    var gasUrl = (window.BSConfig && BSConfig.getGasUrl()) || '';
    var token  = getToken();
    if (!gasUrl) return Promise.reject(new Error('URL backend belum dikonfigurasi.'));
    if (!token) return Promise.reject(new Error('Sesi admin tidak ditemukan. Silakan masuk kembali.'));

    return fetch(gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify({
        action:       'change_password',
        token:        token,
        old_password: oldPassword,
        new_password: newPassword
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.ok) {
        setMustChange(false);
        return resp;
      }
      throw new Error((resp && resp.error) || 'Gagal mengubah kata sandi.');
    });
  }

  /**
   * Verifikasi token ke backend GAS (kompatibilitas & fallback).
   */
  function verifyToken(gasUrl, token) {
    if (!gasUrl || !token) return Promise.resolve({ ok: false, error: 'Parameter tidak lengkap' });
    return fetch(gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'get_admin_data', token: token })
    })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      if (resp && resp.ok) {
        return { ok: true, role: resp.role || 'super_admin' };
      }
      return { ok: false, error: (resp && resp.error) || 'Token tidak valid atau tidak memiliki akses' };
    })
    .catch(function(err) {
      return { ok: false, error: 'Gagal terhubung ke backend: ' + err.message };
    });
  }

  window.BSAuth = {
    getToken:           getToken,
    getRole:            getRole,
    getUsername:        getUsername,
    isMustChange:       isMustChange,
    mustChangePassword: isMustChange,
    setMustChange:      setMustChange,
    isLoggedIn:         isLoggedIn,
    saveSession:        saveSession,
    logout:             logout,
    login:              login,
    changePassword:     changePassword,
    isLockedOut:        isLockedOut,
    remainingLockMs:    remainingLockMs,
    addFail:            addFail,
    resetFails:         resetFails,
    getFailCount:       getFailCount,
    MAX_FAILS:          MAX_FAILS,
    verifyToken:        verifyToken
  };

})(window);
