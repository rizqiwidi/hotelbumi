/**
 * BUMI SURABAYA v5.0
 * staff-manager.js — CRUD staf, rotasi kode, status kartu
 *
 * Manages the in-memory sources array and syncs to Google Sheets via BSApi.
 *
 * Dependencies (globals expected):
 *   - BSApi   : { saveAllAdminData(payload), getPublicConfig() }
 *   - BSConfig : { clearCache() }
 */

(function (global) {
  'use strict';

  /* ─────────────────────────────────────────────
   * Internal state
   * ───────────────────────────────────────────── */

  /** @type {Array<SourceRecord>} */
  let _sources = [];

  /**
   * @typedef {Object} SourceRecord
   * @property {string}   code             - Unique URL-safe slug  e.g. "staff-budi-santoso"
   * @property {string}   name             - Human-readable name
   * @property {string}   type             - "staff" | "sales" | "nfc" | "outlet"
   * @property {string}   role             - e.g. "waitress", "manager", "Sales Manager"
   * @property {string}   outlet           - outlet identifier
   * @property {string}   whatsapp         - WhatsApp number for sales or staff (format 628xx); empty = global fallback
   * @property {boolean}  active           - whether the source is active
   * @property {boolean}  kartu_diprogram  - whether the NFC/QR card has been programmed
   * @property {string[]} legacy_codes     - previous codes after rotations
   * @property {string}   created_at       - ISO timestamp
   * @property {string}   updated_at       - ISO timestamp
   */

  /* ─────────────────────────────────────────────
   * Slug helpers
   * ───────────────────────────────────────────── */

  /**
   * Normalise an arbitrary string to a URL-safe segment matching /^[a-z0-9-]+$/.
   *
   * Steps:
   *  1. Lower-case
   *  2. Transliterate common accented / Indonesian characters
   *  3. Replace any non-alphanumeric run with a single hyphen
   *  4. Strip leading/trailing hyphens
   *
   * @param {string} raw
   * @returns {string}
   */
  function _normalise(raw) {
    // Basic transliteration map (Latin Extended + common special chars)
    const MAP = {
      à: 'a', á: 'a', â: 'a', ã: 'a', ä: 'a', å: 'a',
      è: 'e', é: 'e', ê: 'e', ë: 'e',
      ì: 'i', í: 'i', î: 'i', ï: 'i',
      ò: 'o', ó: 'o', ô: 'o', õ: 'o', ö: 'o',
      ù: 'u', ú: 'u', û: 'u', ü: 'u',
      ý: 'y', ÿ: 'y',
      ñ: 'n', ç: 'c', ß: 'ss',
      // Indonesian specific
      '&': 'dan',
    };

    return String(raw)
      .toLowerCase()
      .replace(/[^\u0000-\u007E]/g, (ch) => MAP[ch] || '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate a URL-safe slug from a name and source type.
   *
   * Examples:
   *   generateSlug('Budi Santoso', 'staff') → 'staff-budi-santoso'
   *   generateSlug('Meja 01',     'nfc')   → 'nfc-meja-01'
   *
   * If the produced slug already exists in _sources, appends -2, -3, … until unique.
   *
   * @param {string} name
   * @param {string} type
   * @returns {string}
   */
  function generateSlug(name, type) {
    const prefix = _normalise(type || 'src');
    const body   = _normalise(name || 'unknown');
    const base   = prefix + '-' + body;

    // Validate final result matches spec
    const SAFE_RE = /^[a-z0-9-]+$/;
    const slug    = base || 'src-unknown';

    if (!SAFE_RE.test(slug)) {
      throw new Error('[BSStaffManager] generateSlug: produced invalid slug "' + slug + '"');
    }

    // Uniqueness check
    const existing = new Set(_sources.map((s) => s.code));
    if (!existing.has(slug)) return slug;

    let counter = 2;
    while (existing.has(slug + '-' + counter)) {
      counter++;
    }
    return slug + '-' + counter;
  }

  /* ─────────────────────────────────────────────
   * CRUD operations
   * ───────────────────────────────────────────── */

  /**
   * Add a new source record.
   *
   * @param {{ name: string, type: string, role?: string, outlet?: string, whatsapp?: string }} opts
   * @returns {SourceRecord}
   */
  function addSource({ name, type, role = '', outlet = '', whatsapp = '' } = {}) {
    if (!name) throw new Error('[BSStaffManager] addSource: "name" is required');
    if (!type) throw new Error('[BSStaffManager] addSource: "type" is required');

    const code = generateSlug(name, type);
    const now  = new Date().toISOString();

    /** @type {SourceRecord} */
    const record = {
      code,
      name,
      type,
      role,
      outlet,
      whatsapp:        whatsapp ? String(whatsapp).replace(/[^0-9]/g, '') : '',
      active:          true,
      kartu_diprogram: false,
      legacy_codes:    [],
      created_at:      now,
      updated_at:      now,
    };

    _sources.push(record);
    _persistLocal();
    return record;
  }

  /**
   * Update fields on an existing source identified by its current code.
   *
   * Protected fields that cannot be changed via updateSource:
   *   code, legacy_codes, created_at
   *
   * @param {string} code
   * @param {Partial<SourceRecord>} updates
   * @returns {SourceRecord}
   */
  function updateSource(code, updates = {}) {
    const idx = _findIndex(code);

    // Prevent accidental overwrite of structural fields
    const PROTECTED = new Set(['code', 'legacy_codes', 'created_at']);
    const sanitised = Object.fromEntries(
      Object.entries(updates).filter(([k]) => !PROTECTED.has(k))
    );

    _sources[idx] = Object.assign({}, _sources[idx], sanitised, {
      updated_at: new Date().toISOString(),
    });

    _persistLocal();
    return _sources[idx];
  }

  /**
   * Rotate the code for a source (SRC-04, QRN-05):
   *  1. MENCABUT kode lama secara default (revoked = true, legacy migration off by default).
   *  2. Menghasilkan kode baru berversi (e.g. "staff-budi-v2").
   *  3. Menandai kartu_diprogram = false dan needs_reprint = true (aset fisik perlu diganti, QRN-05).
   *  4. Mode migrasi hanya jika eksplisit diminta (opts.migration_mode === true) dengan masa tenggang berlabel.
   *
   * @param {string} code  - current code of the source to rotate
   * @param {Object} [opts]
   * @param {boolean} [opts.migration_mode=false]
   * @param {number}  [opts.grace_days=7]
   * @returns {SourceRecord}  - updated record with new code
   */
  function rotateCode(code, opts = {}) {
    const idx    = _findIndex(code);
    const source = _sources[idx];

    // Tentukan versi baru
    const version = (source.legacy_codes || []).length + 2; // v2, v3, …
    const baseCode = code.replace(/-v\d+$/, '');
    const newCode = _uniquifyCode(baseCode + '-v' + version);

    const now = new Date();
    const isMigration = Boolean(opts.migration_mode);
    const graceDays = Number(opts.grace_days) || 7;
    const migrationUntil = isMigration
      ? new Date(now.getTime() + graceDays * 86400000).toISOString()
      : null;

    _sources[idx] = Object.assign({}, source, {
      code:            newCode,
      legacy_codes:    [...(source.legacy_codes || []), code],
      revoked_codes:   [...(source.revoked_codes || []), (!isMigration ? code : null)].filter(Boolean),
      migration_mode:  isMigration,
      migration_until: migrationUntil,
      kartu_diprogram: false, // Kartu lama dicabut, perlu diprogram ulang (QRN-05)
      needs_reprint:   true,  // Menandai aset stiker/kartu perlu diganti
      updated_at:      now.toISOString(),
    });

    _persistLocal();
    return _sources[idx];
  }

  /**
   * Soft-delete a source by setting active = false.
   *
   * @param {string} code
   * @returns {SourceRecord}
   */
  function deactivateSource(code) {
    return updateSource(code, { active: false });
  }

  /**
   * Hard-delete a source by removing it from the sources array.
   *
   * @param {string} code
   * @returns {SourceRecord}
   */
  function deleteSource(code) {
    const idx = _findIndex(code);
    const removed = _sources.splice(idx, 1)[0];
    _persistLocal();
    return removed;
  }

  /**
   * Return a shallow copy of the full sources array.
   *
   * @returns {SourceRecord[]}
   */
  function getSources() {
    return _sources.slice();
  }

  /**
   * Return only sources where active === true.
   *
   * @returns {SourceRecord[]}
   */
  function getActiveSources() {
    return _sources.filter((s) => s.active);
  }

  /* ─────────────────────────────────────────────
   * Cloud sync
   * ───────────────────────────────────────────── */

  /**
   * Push the current sources array to Google Sheets via BSApi.
   * Also clears the BSConfig cache so stale data isn't served.
   *
   * @returns {Promise<any>}
   */
  async function syncToCloud() {
    if (!global.BSApi || typeof global.BSApi.saveAllAdminData !== 'function') {
      throw new Error('[BSStaffManager] BSApi.saveAllAdminData is not available');
    }

    const payload = { sources: getSources() };
    const result  = await global.BSApi.saveAllAdminData(payload);

    // Clear config cache so guests get fresh data on next load
    if (global.BSConfig && typeof global.BSConfig.clearCache === 'function') {
      global.BSConfig.clearCache();
    }

    return result;
  }

  /**
   * Pull the latest sources from Google Sheets / public config endpoint.
   * Merges or replaces the internal state.
   *
   * @returns {Promise<SourceRecord[]>}
   */
  async function loadFromCloud() {
    if (!global.BSApi || typeof global.BSApi.getPublicConfig !== 'function') {
      throw new Error('[BSStaffManager] BSApi.getPublicConfig is not available');
    }

    const config = await global.BSApi.getPublicConfig();

    if (config && Array.isArray(config.sources)) {
      _sources = config.sources.map((s) => ({
        // Ensure all expected fields are present even if cloud record is partial
        role:            '',
        outlet:          '',
        whatsapp:        '',
        active:          true,
        kartu_diprogram: false,
        legacy_codes:    [],
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
        ...s,
      }));
      _persistLocal();
    }

    return getSources();
  }

  /* ─────────────────────────────────────────────
   * QR code helper
   * ───────────────────────────────────────────── */

  /**
   * Return the full URL that should be encoded into a QR code for this source.
   *
   * @param {string} sourceCode  - the source's current code
   * @param {string} [baseUrl]   - base URL of guest page (defaults to window.location.origin + '/')
   * @returns {string}  full URL  e.g. "https://hotel.example.com/?source=staff-budi-santoso"
   */
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

  /* ─────────────────────────────────────────────
   * Private helpers
   * ───────────────────────────────────────────── */

  /**
   * Find array index for a given code; throws if not found.
   * @param {string} code
   * @returns {number}
   */
  function _findIndex(code) {
    const idx = _sources.findIndex((s) => s.code === code);
    if (idx === -1) {
      throw new Error('[BSStaffManager] Source not found: "' + code + '"');
    }
    return idx;
  }

  /**
   * Ensure a proposed code is unique among *all* codes (current + legacy).
   * If a conflict is found, appends -2, -3, … until clear.
   *
   * @param {string} proposed
   * @returns {string}
   */
  function _uniquifyCode(proposed) {
    const allCodes = new Set(
      _sources.flatMap((s) => [s.code, ...s.legacy_codes])
    );

    if (!allCodes.has(proposed)) return proposed;

    let counter = 2;
    while (allCodes.has(proposed + '-' + counter)) {
      counter++;
    }
    return proposed + '-' + counter;
  }

  /**
   * Persist the current _sources array to localStorage for offline resilience.
   * Silently no-ops if localStorage is unavailable (e.g., private browsing
   * with storage blocked, or server-side execution).
   */
  function _persistLocal() {
    try {
      global.localStorage &&
        global.localStorage.setItem('bs_sources_cache', JSON.stringify(_sources));
    } catch (_) {
      /* storage unavailable — ignore */
    }
  }

  /**
   * Attempt to bootstrap _sources from localStorage.
   * Called once at module load time; cloud data should be fetched via
   * loadFromCloud() after the page is ready.
   */
  function _bootFromLocal() {
    try {
      const raw = global.localStorage && global.localStorage.getItem('bs_sources_cache');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          _sources = parsed;
        }
      }
    } catch (_) {
      /* corrupted cache — start fresh */
      _sources = [];
    }
  }

  /* ─────────────────────────────────────────────
   * Module initialisation
   * ───────────────────────────────────────────── */

  _bootFromLocal();

  /* ─────────────────────────────────────────────
   * Public API
   * ───────────────────────────────────────────── */

  global.BSStaffManager = {
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
