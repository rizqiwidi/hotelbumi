/**
 * BUMI SURABAYA v5.0
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
   * @param {object} body - payload (token ditambahkan otomatis)
   * @returns {Promise<object>}
   */
  function post(body) {
    var url = getGasUrl();
    if (!url) return Promise.reject(new Error('Backend URL belum dikonfigurasi'));
    body.token = getToken();
    return fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body:    JSON.stringify(body)
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function(resp) {
      if (resp && resp.error === 'Unauthorized') throw new Error('Unauthorized');
      return resp;
    });
  }

  /**
   * GET publik (tanpa token)
   */
  function get(params) {
    var url   = getGasUrl();
    if (!url) return Promise.reject(new Error('Backend URL belum dikonfigurasi'));
    var query = Object.keys(params || {}).map(function(k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    return fetch(url + (query ? '?' + query : ''), {
      method: 'GET'
    }).then(function(r) { return r.json(); });
  }

  /** Simpan semua konfigurasi + sources + staff_devices ke Sheets */
  function saveAllAdminData(payload) {
    return post(Object.assign({ action: 'save_all_admin_data' }, payload));
  }

  /** Ambil events data bulan tertentu */
  function getEventsData(month, limit) {
    return post({ action: 'get_events_data', month: month, limit: limit || 10000 });
  }

  /** Ambil konfigurasi publik (sources + config) */
  function getPublicConfig() {
    return get({ action: 'get_config' });
  }

  window.BSApi = {
    post:             post,
    get:              get,
    saveAllAdminData: saveAllAdminData,
    getEventsData:    getEventsData,
    getPublicConfig:  getPublicConfig
  };

})(window);
