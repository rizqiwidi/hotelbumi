/**
 * BUMI SURABAYA v6.0
 * api.js — Admin API client to Google Apps Script
 *
 * Seluruh request admin menggunakan POST dengan token di BODY (bukan URL).
 * Menghindari HTTP 414 dengan TIDAK menggunakan query string untuk data.
 */

(function(window) {
  'use strict';

  function getGasUrl() {
    return (window.BSConfig && BSConfig.getGasUrl()) || '';
  }
  function getToken() {
    return (window.BSAuth && BSAuth.getToken()) || '';
  }

  /**
   * POST request terproteksi ke GAS.
   * @param {object} body - payload (token ditambahkan otomatis jika belum ada)
   * @returns {Promise<object>}
   */
  function post(body) {
    var url = getGasUrl();
    if (!url) return Promise.reject(new Error('Backend URL belum dikonfigurasi.'));
    if (!body.token) body.token = getToken();
    return fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(body)
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(resp) {
      if (resp && resp.error === 'Unauthorized') throw new Error('Unauthorized');
      if (resp && resp.must_change) {
        var err = new Error(resp.error || 'Wajib mengganti kata sandi terlebih dahulu.');
        err.must_change = true;
        throw err;
      }
      return resp;
    });
  }

  /**
   * GET publik (tanpa token)
   */
  function get(params) {
    var url   = getGasUrl();
    if (!url) return Promise.reject(new Error('Backend URL belum dikonfigurasi.'));
    var query = Object.keys(params || {}).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetch(url + (query ? '?' + query : ''), {
      method: 'GET'
    }).then(function(r) { return r.json(); });
  }

  /** Login via API */
  function login(username, password) {
    if (window.BSAuth && typeof BSAuth.login === 'function') {
      return BSAuth.login(username, password);
    }
    return post({ action: 'login', username: username, password: password });
  }

  /** Ganti password admin via API */
  function changePassword(oldPassword, newPassword) {
    if (window.BSAuth && typeof BSAuth.changePassword === 'function') {
      return BSAuth.changePassword(oldPassword, newPassword);
    }
    return post({ action: 'change_password', old_password: oldPassword, new_password: newPassword });
  }

  /** Simpan semua konfigurasi + sources + staff_devices ke Sheets */
  function saveAllAdminData(payload) {
    return post(Object.assign({ action: 'save_all_admin_data' }, payload));
  }

  /** Ambil data konfigurasi penuh admin (config sensitif + all sources + staff_devices) */
  function getAdminData() {
    return post({ action: 'get_admin_data' });
  }

  /** Ambil events data bulan tertentu */
  function getEventsData(month, limit) {
    return post({ action: 'get_events_data', month: month, limit: limit || 10000 });
  }

  /** Ambil konfigurasi publik (sources + config) */
  function getPublicConfig() {
    return get({ action: 'get_config' });
  }

  /** Ambil log jejak audit mutasi terbaru (SEC-11, SEC-12, SRC-09) */
  function getAuditLogs(limit) {
    return post({ action: 'get_audit_logs', limit: limit || 200 });
  }

  window.BSApi = {
    post:             post,
    get:              get,
    login:            login,
    changePassword:   changePassword,
    saveAllAdminData: saveAllAdminData,
    getAdminData:     getAdminData,
    getEventsData:    getEventsData,
    getPublicConfig:  getPublicConfig,
    getAuditLogs:     getAuditLogs
  };

})(window);
