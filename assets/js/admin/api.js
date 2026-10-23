/**
 * BUMI SURABAYA v6.8
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

  function login(username, password) {
    if (window.BSAuth && typeof BSAuth.login === 'function') {
      return BSAuth.login(username, password);
    }
    return post({ action: 'login', username: username, password: password });
  }

  function logout() {
    if (window.BSAuth && typeof BSAuth.logout === 'function') {
      return BSAuth.logout();
    }
    return post({ action: 'logout' });
  }

  function changePassword(oldPassword, newPassword) {
    if (window.BSAuth && typeof BSAuth.changePassword === 'function') {
      return BSAuth.changePassword(oldPassword, newPassword);
    }
    return post({ action: 'change_password', old_password: oldPassword, new_password: newPassword });
  }

  function saveAllAdminData(payload) {
    return post(Object.assign({ action: 'save_all_admin_data' }, payload));
  }

  function getAdminData() {
    return post({ action: 'get_admin_data' });
  }

  function getEventsData(month, limit) {
    return post({ action: 'get_events_data', month: month, limit: limit || 10000 });
  }

  function getPublicConfig(bypassCache) {
    var p = { action: 'get_config' };
    if (bypassCache) p.nocache = '1';
    return get(p);
  }

  function getAuditLogs(limitOrOpts) {
    var opts = (typeof limitOrOpts === 'object' && limitOrOpts !== null)
      ? limitOrOpts : { limit: limitOrOpts || 100 };
    return post(Object.assign({ action: 'get_audit_logs' }, opts));
  }

  function getFeedbackData(filters) {
    return post(Object.assign({ action: 'get_feedback_data', limit: 50 }, filters || {}));
  }

  function markFeedbackHandled(row) {
    return post({ action: 'mark_feedback_handled', row: row });
  }

  /** Manajemen Akun Pengguna RBAC (FR-V64-03 — khusus super_admin) */
  function listUsers() {
    return post({ action: 'list_users' });
  }

  function saveUser(userPayload) {
    return post(Object.assign({ action: 'save_user' }, userPayload || {}));
  }

  function deleteUser(username) {
    return post({ action: 'delete_user', target_username: username });
  }

  /** Sesi aktif & pencabutan (FR-V67-14) */
  function listSessions(targetUsername) {
    return post({ action: 'list_sessions', target_username: targetUsername || '' });
  }

  function revokeSession(payload) {
    return post(Object.assign({ action: 'revoke_session' }, payload || {}));
  }

  /** Reset sandi mandiri (FR-V67-14) — dua endpoint publik, tanpa token. */
  function requestPasswordReset(username) {
    return post({ action: 'request_password_reset', username: username });
  }

  function confirmPasswordReset(username, code, newPassword) {
    return post({ action: 'confirm_password_reset', username: username, code: code, new_password: newPassword });
  }

  /** Unggah gambar ke Google Drive (FR-V67-14). */
  function uploadImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('Berkas tidak dipilih.')); return; }
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        reject(new Error('Format gambar harus JPEG, PNG, atau WebP.'));
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        reject(new Error('Ukuran gambar melebihi 2 MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Berkas tidak dapat dibaca.')); };
      reader.onload = function (evt) {
        var dataUrl = String(evt.target.result || '');
        var comma = dataUrl.indexOf(',');
        if (comma === -1) { reject(new Error('Data gambar tidak valid.')); return; }
        post({
          action:      'upload_image',
          mime_type:   file.type,
          file_name:   String(file.name || 'gambar').replace(/\.[^.]+$/, ''),
          data_base64: dataUrl.substring(comma + 1)
        }).then(resolve).catch(reject);
      };
      reader.readAsDataURL(file);
    });
  }

  window.BSApi = {
    post:                post,
    get:                 get,
    login:               login,
    logout:              logout,
    changePassword:      changePassword,
    saveAllAdminData:    saveAllAdminData,
    getAdminData:        getAdminData,
    getEventsData:       getEventsData,
    getPublicConfig:     getPublicConfig,
    getAuditLogs:        getAuditLogs,
    getFeedbackData:     getFeedbackData,
    markFeedbackHandled: markFeedbackHandled,
    listUsers:           listUsers,
    saveUser:            saveUser,
    deleteUser:          deleteUser,
    listSessions:        listSessions,
    revokeSession:       revokeSession,
    requestPasswordReset:  requestPasswordReset,
    confirmPasswordReset:  confirmPasswordReset,
    uploadImage:         uploadImage
  };

})(window);
