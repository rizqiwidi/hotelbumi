/**
 * BUMI SURABAYA v6.3
 * staff-manager.js — CRUD staf, rotasi kode, status kartu & inisialisasi sumber lengkap (FR-P0-04, FR-P0-05)
 *
 * Manages the in-memory sources array and syncs to Google Sheets via BSApi.
 */

(function (global) {
  'use strict';

  /** @type {Array<SourceRecord>} */
  let _sources = [];

  function _normalise(raw) {
    const MAP = {
      à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
      è: 'e', é: 'e', ê: 'e', ë: 'e',
      ì: 'i', í: 'i', î: 'i', ï: 'i',
      ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
      ù: 'u', ú: 'u', û: 'u', ü: 'u',
      ý: 'y', ÿ: 'y',
      ñ: 'n', ç: 'c', ß: 'ss',
      '&': 'dan',
    };

    return String(raw)
      .toLowerCase()
      .replace(/[^\u0000-\u007E]/g, (ch) => MAP[ch] || '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function generateSlug(name, type) {
    const prefix = _normalise(type || 'src');
    const body   = _normalise(name || 'unknown');
    const base   = prefix + '-' + body;

    const SAFE_RE = /^[a-z0-9-]+$/;
    const slug    = base || 'src-unknown';

    if (!SAFE_RE.test(slug)) {
      throw new Error('[BSStaffManager] generateSlug: produced invalid slug "' + slug + '"');
    }

    const existing = new Set(_sources.map((s) => s.code));
    if (!existing.has(slug)) return slug;

    let counter = 2;
    while (existing.has(slug + '-' + counter)) {
      counter++;
    }
    return slug + '-' + counter;
  }

  function _normalizeSourceRecord(s) {
    const now = new Date().toISOString();
    return {
      code:             String((s && s.code) || ''),
      name:             String((s && s.name) || ''),
      type:             String((s && s.type) || 'staff'),
      role:             String((s && s.role) || ''),
      outlet:           String((s && s.outlet) || ''),
      whatsapp:         (s && s.whatsapp) ? String(s.whatsapp).replace(/[^0-9]/g, '') : '',
      active:           s && s.active !== undefined ? (s.active !== false && s.active !== 'FALSE') : true,
      kartu_diprogram:  Boolean(s && (s.kartu_diprogram === true || s.kartu_diprogram === 'TRUE')),
      legacy_codes:     Array.isArray(s && s.legacy_codes) ? s.legacy_codes.slice() : [],
      revoked_codes:    Array.isArray(s && s.revoked_codes) ? s.revoked_codes.slice() : [],
      migration_mode:   Boolean(s && (s.migration_mode === true || s.migration_mode === 'TRUE')),
      migration_until:  (s && s.migration_until) ? String(s.migration_until) : null,
      needs_reprint:    Boolean(s && (s.needs_reprint === true || s.needs_reprint === 'TRUE')),
      service_hours:    String((s && s.service_hours) || ''),
      welcome_template: String((s && s.welcome_template) || ''),
      created_at:       (s && s.created_at) ? String(s.created_at) : now,
      updated_at:       (s && s.updated_at) ? String(s.updated_at) : now,
    };
  }

  /**
   * Inisialisasi langsung daftar sumber dari endpoint terproteksi get_admin_data / get_events_data
   * tanpa membuang sumber berstatus active === false (FR-P0-04).
   *
   * @param {Array<Object>} sourcesArray
   * @returns {Array<Object>}
   */
  function initSources(sourcesArray) {
    if (!Array.isArray(sourcesArray)) return getSources();
    _sources = sourcesArray
      .filter((s) => s && s.code)
      .map(_normalizeSourceRecord);
    _persistLocal();
    return getSources();
  }

  function addSource({ name, type, role = '', outlet = '', whatsapp = '', service_hours = '', welcome_template = '' } = {}) {
    if (!name) throw new Error('[BSStaffManager] addSource: "name" is required');
    if (!type) throw new Error('[BSStaffManager] addSource: "type" is required');

    const code = generateSlug(name, type);
    const now  = new Date().toISOString();

    const record = _normalizeSourceRecord({
      code,
      name,
      type,
      role,
      outlet,
      whatsapp:         whatsapp ? String(whatsapp).replace(/[^0-9]/g, '') : '',
      active:           true,
      kartu_diprogram:  false,
      legacy_codes:     [],
      revoked_codes:    [],
      migration_mode:   false,
      migration_until:  null,
      needs_reprint:    false,
      service_hours:    service_hours || '',
      welcome_template: welcome_template || '',
      created_at:       now,
      updated_at:       now,
    });

    _sources.push(record);
    _persistLocal();
    return record;
  }

  function updateSource(code, updates = {}) {
    const idx = _findIndex(code);
    const PROTECTED = new Set(['code', 'legacy_codes', 'created_at']);
    const sanitised = Object.fromEntries(
      Object.entries(updates).filter(([k]) => !PROTECTED.has(k))
    );

    _sources[idx] = _normalizeSourceRecord(Object.assign({}, _sources[idx], sanitised, {
      updated_at: new Date().toISOString(),
    }));

    _persistLocal();
    return _sources[idx];
  }

  function rotateCode(code, opts = {}) {
    const idx    = _findIndex(code);
    const source = _sources[idx];

    const version = (source.legacy_codes || []).length + 2;
    const baseCode = code.replace(/-v\d+$/, '');
    const newCode = _uniquifyCode(baseCode + '-v' + version);

    const now = new Date();
    const isMigration = Boolean(opts.migration_mode);
    const graceDays = Number(opts.grace_days) || 7;
    const migrationUntil = isMigration
      ? new Date(now.getTime() + graceDays * 86400000).toISOString()
      : null;

    _sources[idx] = _normalizeSourceRecord(Object.assign({}, source, {
      code:            newCode,
      legacy_codes:    [...(source.legacy_codes || []), code],
      revoked_codes:   [...(source.revoked_codes || []), (!isMigration ? code : null)].filter(Boolean),
      migration_mode:  isMigration,
      migration_until: migrationUntil,
      kartu_diprogram: false,
      needs_reprint:   true,
      updated_at:      now.toISOString(),
    }));

    _persistLocal();
    return _sources[idx];
  }

  function deactivateSource(code) {
    return updateSource(code, { active: false });
  }

  function deleteSource(code) {
    const idx = _findIndex(code);
    const removed = _sources.splice(idx, 1)[0];
    _persistLocal();
    return removed;
  }

  function getSources() {
    return _sources.slice();
  }

  function getActiveSources() {
    return _sources.filter((s) => s.active);
  }

  async function syncToCloud() {
    if (!global.BSApi || typeof global.BSApi.saveAllAdminData !== 'function') {
      throw new Error('[BSStaffManager] BSApi.saveAllAdminData is not available');
    }

    const payload = { sources: getSources() };
    const result  = await global.BSApi.saveAllAdminData(payload);

    if (global.BSConfig && typeof global.BSConfig.clearCache === 'function') {
      global.BSConfig.clearCache();
    }

    return result;
  }

  /**
   * Muat sumber dari cloud: prioritaskan getAdminData() bila sesi admin aktif
   * agar sumber nonaktif dan status kartu tidak terhapus oleh filter publik (FR-P0-04).
   */
  async function loadFromCloud() {
    if (!global.BSApi) {
      throw new Error('[BSStaffManager] BSApi is not available');
    }

    if (global.BSAuth && typeof global.BSAuth.isLoggedIn === 'function' && global.BSAuth.isLoggedIn() && typeof global.BSApi.getAdminData === 'function') {
      try {
        const admResp = await global.BSApi.getAdminData();
        if (admResp && admResp.ok && Array.isArray(admResp.sources)) {
          return initSources(admResp.sources);
        }
      } catch (_) {
        // Fallback if getAdminData fails
      }
    }

    if (typeof global.BSApi.getPublicConfig !== 'function') {
      throw new Error('[BSStaffManager] BSApi.getPublicConfig is not available');
    }

    const config = await global.BSApi.getPublicConfig();
    if (config && Array.isArray(config.sources)) {
      // Merge with existing inactive sources if present in local cache so we don't wipe them
      const inactiveLocal = _sources.filter((s) => s.active === false);
      const activeSet = new Set(config.sources.map((s) => s.code));
      const merged = [
        ...config.sources.map(_normalizeSourceRecord),
        ...inactiveLocal.filter((s) => !activeSet.has(s.code)),
      ];
      _sources = merged;
      _persistLocal();
    }

    return getSources();
  }

  function generateQrDataUrl(sourceCode, baseUrl) {
    if (!sourceCode) throw new Error('[BSStaffManager] generateQrDataUrl: sourceCode is required');

    let base = baseUrl
      ? String(baseUrl)
      : (global.location
          ? global.location.origin + ((window.BSConfig && BSConfig.appRoot) ? BSConfig.appRoot() : '/')
          : 'https://rizqiwidi.github.io/hotelbumi/');

    base = base.replace(/\/+$/, '') + '/';
    return base + '?source=' + encodeURIComponent(sourceCode);
  }

  function _findIndex(code) {
    const idx = _sources.findIndex((s) => s.code === code);
    if (idx === -1) {
      throw new Error('[BSStaffManager] Source not found: "' + code + '"');
    }
    return idx;
  }

  function _uniquifyCode(proposed) {
    const allCodes = new Set(
      _sources.flatMap((s) => [s.code, ...(s.legacy_codes || [])])
    );

    if (!allCodes.has(proposed)) return proposed;

    let counter = 2;
    while (allCodes.has(proposed + '-' + counter)) {
      counter++;
    }
    return proposed + '-' + counter;
  }

  function _persistLocal() {
    try {
      global.localStorage &&
        global.localStorage.setItem('bs_sources_cache', JSON.stringify(_sources));
    } catch (_) {}
  }

  function _bootFromLocal() {
    try {
      const raw = global.localStorage && global.localStorage.getItem('bs_sources_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          _sources = parsed.map(_normalizeSourceRecord);
        }
      }
    } catch (_) {
      _sources = [];
    }
  }

  _bootFromLocal();

  global.BSStaffManager = {
    initSources,
    generateSlug,
    addSource,
    updateSource,
    deleteSource,
    rotateCode,
    deactivateSource,
    getSources,
    getActiveSources,
    syncToCloud,
    loadFromCloud,
    generateQrDataUrl,
  };
})(window);
