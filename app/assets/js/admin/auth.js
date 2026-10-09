/**
 * BUMI SURABAYA v5.0
 * auth.js — Login session & READ_TOKEN management
 *
 * - Token disimpan di sessionStorage (tidak pernah di localStorage atau URL)
 * - Brute-force protection: maks 5 kali gagal / 15 menit
 * - Role: super_admin, manager
 */

(function(window) {
  'use strict';

  var TOKEN_KEY   = 'bs_admin_token';
  var ROLE_KEY    = 'bs_admin_role';
  var LOGIN_TIME  = 'bs_admin_login_ts';
  var BF_KEY      = 'bs_login_fails';
  var BF_TS_KEY   = 'bs_login_fails_ts';

  var MAX_FAILS   = 5;
  var LOCKOUT_MS  = 15 * 60 * 1000;  // 15 menit
  var SESSION_TTL = 8 * 60 * 60 * 1000; // 8 jam

  function getToken()  { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  function getRole()   { return sessionStorage.getItem(ROLE_KEY)  || ''; }
  function isLoggedIn() {
    var token = getToken();
    if (!token) return false;
    var ts = parseInt(sessionStorage.getItem(LOGIN_TIME) || '0', 10);
    if (Date.now() - ts > SESSION_TTL) { logout(); return false; }
    return true;
  }

  function saveSession(token, role) {
    sessionStorage.setItem(TOKEN_KEY,  token);
    sessionStorage.setItem(ROLE_KEY,   role || 'manager');
    sessionStorage.setItem(LOGIN_TIME, String(Date.now()));
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(ROLE_KEY);
    sessionStorage.removeItem(LOGIN_TIME);
    if (window.BSConfig) window.BSConfig.clearCache();
  }

  // Brute-force tracking (di sessionStorage karena per-tab)
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
   * Verifikasi token ke backend GAS.
   * Kita kirim dummy action dan lihat apakah Unauthorized kembali.
   * @param {string} gasUrl
   * @param {string} token
   * @returns {Promise<{ok:boolean, role:string, error:string}>}
   */
  function verifyToken(gasUrl, token) {
    if (!gasUrl || !token) return Promise.resolve({ ok: false, error: 'Parameter tidak lengkap' });
    return fetch(gasUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'get_events_data', token: token, month: 'Events_verify', limit: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function(resp) {
      // GAS returns ok:false + Unauthorized jika token salah
      // ok:true atau error selain Unauthorized = token valid
      if (resp.ok || (resp.error && resp.error !== 'Unauthorized')) {
        return { ok: true, role: 'super_admin' };
      }
      return { ok: false, error: 'Token tidak valid atau tidak memiliki akses' };
    })
    .catch(function(err) {
      return { ok: false, error: 'Gagal terhubung ke backend: ' + err.message };
    });
  }

  window.BSAuth = {
    getToken:       getToken,
    getRole:        getRole,
    isLoggedIn:     isLoggedIn,
    saveSession:    saveSession,
    logout:         logout,
    isLockedOut:    isLockedOut,
    remainingLockMs:remainingLockMs,
    addFail:        addFail,
    resetFails:     resetFails,
    getFailCount:   getFailCount,
    MAX_FAILS:      MAX_FAILS,
    verifyToken:    verifyToken
  };

})(window);
