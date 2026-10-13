/**
 * BUMI SURABAYA v5.0
 * anti-fraud.js — Anti-Fraud Engine (8 rules, PRD §7)
 *
 * FIX v4 bug: flagsByEventId keyed by event.event_id (UUID string), NOT array index.
 *
 * Rules:
 *  AF-01  velocity    — too many events from same device in short window
 *  AF-02  burst       — sudden spike of events in 1-minute bucket
 *  AF-03  self_tap    — event device_id matches a registered staff device
 *  AF-04  low_quality — quality score < threshold
 *  AF-05  hopping     — same device scans multiple different sources rapidly
 *  AF-06  bot         — identical timestamps or zero dwell-time patterns
 *  AF-07  shared_ip   — many distinct devices share the same IP address
 *  AF-08  odd_hour    — event outside configured operating hours
 *
 * Quality score per valid event (PRD §7.3):
 *  visit event           = +1
 *  scroll_max > 50       = +1 bonus
 *  promotion_click or
 *    outlet_click        = +2
 *  whatsapp_click        = +2
 *  google_review_click   = +3
 *  direct_feedback_submit = +3
 *  flagged event         =  0 (override)
 *  excluded device       =  0 (override)
 */

(function(window) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Unified Anti-Fraud Rules Specification (PRD §7.7, AF-ALL-01 s/d AF-ALL-03)
  // ---------------------------------------------------------------------------
  var RULES = {
    'AF-01': {
      id: 'AF-01',
      name: 'Velocity Limit',
      severity: 'high',
      action: 'reduce_score',
      desc: 'Frekuensi event per perangkat melebihi batas dalam 24 jam'
    },
    'AF-02': {
      id: 'AF-02',
      name: 'Burst Detection',
      severity: 'medium',
      action: 'reduce_score',
      desc: 'Lonjakan event dalam durasi singkat 10 menit'
    },
    'AF-03': {
      id: 'AF-03',
      name: 'Self-Tap Staff',
      severity: 'critical',
      action: 'reject_event',
      desc: 'Event berasal dari perangkat staf terdaftar'
    },
    'AF-04': {
      id: 'AF-04',
      name: 'Low Quality',
      severity: 'medium',
      action: 'reduce_score',
      desc: 'Dwell time terlalu singkat (< 5 detik) tanpa interaksi'
    },
    'AF-05': {
      id: 'AF-05',
      name: 'Source Hopping',
      severity: 'medium',
      action: 'reduce_score',
      desc: 'Perangkat memindai lebih dari batas sumber unik dalam 1 jam'
    },
    'AF-06': {
      id: 'AF-06',
      name: 'Bot Signal',
      severity: 'critical',
      action: 'reject_event',
      desc: 'Sinyal bot terdeteksi (honeypot terisi atau interval waktu 0ms)'
    },
    'AF-07': {
      id: 'AF-07',
      name: 'Shared IP Anomaly',
      severity: 'low',
      action: 'flag_only',
      desc: 'Banyak perangkat berbagi alamat IP yang sama (informasional / flag only)'
    },
    'AF-08': {
      id: 'AF-08',
      name: 'Odd Hour',
      severity: 'low',
      action: 'flag_only',
      desc: 'Kunjungan di luar jam operasional hotel (06.00-23.00 WIB)'
    }
  };

  /** Helper klasifikasi aksi aturan (AF-ALL-01) */
  function getEventActions(ruleIds) {
    var hasReject = false;
    var hasReduce = false;
    (ruleIds || []).forEach(function(rid) {
      var r = RULES[rid];
      if (r) {
        if (r.action === 'reject_event') hasReject = true;
        if (r.action === 'reduce_score') hasReduce = true;
      }
    });
    return {
      hasReject: hasReject,
      hasReduce: hasReduce,
      isRejected: hasReject,
      isScoreZeroed: hasReject || hasReduce,
      isFlagOnly: !hasReject && !hasReduce && (ruleIds && ruleIds.length > 0)
    };
  }

  // ---------------------------------------------------------------------------
  // Defaults (overridden by thresholds from config)
  // ---------------------------------------------------------------------------
  var DEFAULTS = {
    velocity_window_ms:    86400000, // AF-01: rolling window 24 jam (ms)
    velocity_max_events:   3,        // AF-01: max kunjungan per device per 24 jam
    burst_window_ms:       600000,   // AF-02: 10-minute bucket (ms)
    burst_max_events:      5,        // AF-02: max total events dalam 10 menit
    low_dwell_ms:          5000,     // AF-04: minimum dwell ms
    hopping_window_ms:     3600000,  // AF-05: 1-hour window (ms)
    hopping_max_sources:   4,        // AF-05: max unique sources per device dalam 1 jam
    bot_min_dwell_ms:      500,      // AF-06: minimum ms between events from same device
    shared_ip_max_devices: 10,       // AF-07: max distinct devices per IP
    odd_hour_start:        6,        // AF-08: jam operasional mulai WIB (inclusive)
    odd_hour_end:          23        // AF-08: jam operasional selesai WIB (exclusive)
  };

  function mergeThresholds(thresholds) {
    var t = {};
    var k;
    for (k in DEFAULTS) { t[k] = DEFAULTS[k]; }
    if (thresholds && typeof thresholds === 'object') {
      for (k in thresholds) {
        if (Object.prototype.hasOwnProperty.call(thresholds, k) &&
            Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
          t[k] = Number(thresholds[k]);
        }
      }
    }
    return t;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function toMs(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    return new Date(val).getTime() || 0;
  }

  function buildStaffSet(staffDevices) {
    var set = {};
    if (!Array.isArray(staffDevices)) return set;
    staffDevices.forEach(function(sd) {
      if (sd && sd.device_id) set[String(sd.device_id)] = true;
    });
    return set;
  }

  /**
   * Ensure Map entry exists as an array and push a rule code.
   * @param {Map} map
   * @param {string} eventId
   * @param {string} rule
   */
  function flagEvent(map, eventId, rule) {
    if (!map.has(eventId)) map.set(eventId, []);
    var arr = map.get(eventId);
    if (arr.indexOf(rule) === -1) arr.push(rule);
  }

  // ---------------------------------------------------------------------------
  // Rule implementations
  // ---------------------------------------------------------------------------

  /**
   * AF-01 velocity — per device rolling-window event count.
   * Sort events by device + timestamp; sliding window per device.
   */
  function applyVelocity(events, flagsByEventId, t) {
    // Group by device_id
    var byDevice = {};
    events.forEach(function(ev) {
      var did = String(ev.device_id || '');
      if (!did) return;
      if (!byDevice[did]) byDevice[did] = [];
      byDevice[did].push(ev);
    });

    Object.keys(byDevice).forEach(function(did) {
      var devEvents = byDevice[did].slice().sort(function(a, b) {
        return toMs(a.timestamp) - toMs(b.timestamp);
      });
      var start = 0;
      for (var i = 0; i < devEvents.length; i++) {
        var tNow = toMs(devEvents[i].timestamp);
        // slide start forward
        while (toMs(devEvents[start].timestamp) < tNow - t.velocity_window_ms) {
          start++;
        }
        var windowCount = i - start + 1;
        if (windowCount > t.velocity_max_events) {
          flagEvent(flagsByEventId, String(devEvents[i].event_id), 'AF-01');
        }
      }
    });
  }

  /**
   * AF-02 burst — global events per 1-minute bucket.
   */
  function applyBurst(events, flagsByEventId, t) {
    var buckets = {};
    events.forEach(function(ev) {
      var ms   = toMs(ev.timestamp);
      var buck = Math.floor(ms / t.burst_window_ms);
      if (!buckets[buck]) buckets[buck] = [];
      buckets[buck].push(ev);
    });
    Object.keys(buckets).forEach(function(buck) {
      var bucket = buckets[buck];
      if (bucket.length > t.burst_max_events) {
        bucket.forEach(function(ev) {
          flagEvent(flagsByEventId, String(ev.event_id), 'AF-02');
        });
      }
    });
  }

  /**
   * AF-03 self_tap — event device_id is a registered staff device.
   */
  function applySelfTap(events, flagsByEventId, staffSet) {
    events.forEach(function(ev) {
      if (ev.device_id && staffSet[String(ev.device_id)]) {
        flagEvent(flagsByEventId, String(ev.event_id), 'AF-03');
      }
    });
  }

  /**
   * AF-05 hopping — same device scans > N unique sources within window.
   */
  function applyHopping(events, flagsByEventId, t) {
    var byDevice = {};
    events.forEach(function(ev) {
      var did = String(ev.device_id || '');
      if (!did) return;
      if (!byDevice[did]) byDevice[did] = [];
      byDevice[did].push(ev);
    });

    Object.keys(byDevice).forEach(function(did) {
      var devEvents = byDevice[did].slice().sort(function(a, b) {
        return toMs(a.timestamp) - toMs(b.timestamp);
      });
      var start = 0;
      for (var i = 0; i < devEvents.length; i++) {
        var tNow = toMs(devEvents[i].timestamp);
        while (toMs(devEvents[start].timestamp) < tNow - t.hopping_window_ms) {
          start++;
        }
        // count unique sources in window [start..i]
        var srcSet = {};
        for (var j = start; j <= i; j++) {
          if (devEvents[j].source_id) srcSet[String(devEvents[j].source_id)] = true;
        }
        if (Object.keys(srcSet).length > t.hopping_max_sources) {
          flagEvent(flagsByEventId, String(devEvents[i].event_id), 'AF-05');
        }
      }
    });
  }

  /**
   * Helper: Periksa apakah IP merupakan placeholder atau nilai tidak sah (AF-07).
   */
  function isPlaceholderIp(ip) {
    if (!ip) return true;
    var s = String(ip).trim().toLowerCase();
    return s === '' || s === 'client-ip' || s === 'unknown' || s === 'null' || s === 'undefined' || s === '-' || s === '127.0.0.1';
  }

  /**
   * AF-04 low_quality — dwell time < threshold dan interaksi 0 pada event visit.
   */
  function applyLowQuality(events, flagsByEventId, t) {
    events.forEach(function(ev) {
      var et = String(ev.event_type || ev.event || ev.type || '');
      if (et === 'visit') {
        var dwell = Number(ev.dwell_ms) || 0;
        var inter = Number(ev.interactions) || 0;
        if (dwell > 0 && dwell < t.low_dwell_ms && inter === 0) {
          flagEvent(flagsByEventId, String(ev.event_id), 'AF-04');
        }
      }
    });
  }

  /**
   * AF-06 bot — sinyal honeypot aktif atau event berturutan dari device sama dengan dwell < threshold.
   */
  function applyBot(events, flagsByEventId, t) {
    events.forEach(function(ev) {
      if (ev.bot_flag === true || ev.bot_flag === 'TRUE') {
        flagEvent(flagsByEventId, String(ev.event_id), 'AF-06');
      }
    });

    var byDevice = {};
    events.forEach(function(ev) {
      var did = String(ev.device_id || '');
      if (!did) return;
      if (!byDevice[did]) byDevice[did] = [];
      byDevice[did].push(ev);
    });

    Object.keys(byDevice).forEach(function(did) {
      var devEvents = byDevice[did].slice().sort(function(a, b) {
        return toMs(a.timestamp) - toMs(b.timestamp);
      });
      for (var i = 1; i < devEvents.length; i++) {
        var prev = toMs(devEvents[i - 1].timestamp);
        var curr = toMs(devEvents[i].timestamp);
        var dwell = curr - prev;
        if (dwell >= 0 && dwell < t.bot_min_dwell_ms) {
          flagEvent(flagsByEventId, String(devEvents[i].event_id),     'AF-06');
          flagEvent(flagsByEventId, String(devEvents[i - 1].event_id), 'AF-06');
        }
      }
    });
  }

  /**
   * AF-07 shared_ip — banyak perangkat unik berbagi IP yang sama.
   * Mengabaikan nilai placeholder ("client-ip", "unknown", kosong, dll).
   */
  function applySharedIp(events, flagsByEventId, t) {
    var byIp = {};
    events.forEach(function(ev) {
      var ip = String(ev.ip_address || ev.ip || '');
      if (isPlaceholderIp(ip)) return; // Abaikan placeholder (AF-07)
      if (!byIp[ip]) byIp[ip] = { devices: {}, events: [] };
      if (ev.device_id) byIp[ip].devices[String(ev.device_id)] = true;
      byIp[ip].events.push(ev);
    });
    Object.keys(byIp).forEach(function(ip) {
      var entry = byIp[ip];
      if (Object.keys(entry.devices).length > t.shared_ip_max_devices) {
        entry.events.forEach(function(ev) {
          flagEvent(flagsByEventId, String(ev.event_id), 'AF-07');
        });
      }
    });
  }

  /**
   * AF-08 odd_hour — event outside [odd_hour_start, odd_hour_end) in WIB (UTC+7),
   * regardless of the viewer's local timezone.
   */
  function applyOddHour(events, flagsByEventId, t) {
    events.forEach(function(ev) {
      var ms   = toMs(ev.timestamp);
      if (!ms) return;
      var hour = (new Date(ms).getUTCHours() + 7) % 24; // WIB
      if (hour < t.odd_hour_start || hour >= t.odd_hour_end) {
        flagEvent(flagsByEventId, String(ev.event_id), 'AF-08');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Main evaluator
  // ---------------------------------------------------------------------------

  /**
   * Evaluate all fraud rules against the event array.
   *
   * @param {Array}  events       - raw events from Sheets
   * @param {Array}  staffDevices - [{device_id, staff_code}]
   * @param {object} thresholds   - fraud_thresholds from config
   * @returns {{ flagsByEventId: Map<string,string[]>, summary: object }}
   */
  function evaluateEvents(events, staffDevices, thresholds) {
    /** @type {Map<string, string[]>} */
    var flagsByEventId = new Map();
    var t = mergeThresholds(thresholds);
    var staffSet = buildStaffSet(staffDevices);

    if (!Array.isArray(events) || events.length === 0) {
      return { flagsByEventId: flagsByEventId, summary: { total: 0, flagged: 0, rules: {} } };
    }

    applyVelocity(events,   flagsByEventId, t);
    applyBurst(events,      flagsByEventId, t);
    applySelfTap(events,    flagsByEventId, staffSet);
    applyLowQuality(events, flagsByEventId, t);
    applyHopping(events,    flagsByEventId, t);
    applyBot(events,        flagsByEventId, t);
    applySharedIp(events,   flagsByEventId, t);
    applyOddHour(events,    flagsByEventId, t);
    // AF-04 (low_quality) is applied after quality scoring — see getLeaderboard

    // Build summary
    var ruleCount = {};
    flagsByEventId.forEach(function(rules) {
      rules.forEach(function(r) {
        ruleCount[r] = (ruleCount[r] || 0) + 1;
      });
    });

    return {
      flagsByEventId: flagsByEventId,
      summary: {
        total:   events.length,
        flagged: flagsByEventId.size,
        rules:   ruleCount
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Quality score (PRD §7.3 & §7.7)
  // ---------------------------------------------------------------------------

  /**
   * Calculate total quality score for a source (array of events belonging to it).
   *
   * @param {Array}                srcEvents       - events for this source
   * @param {Map<string,string[]>} flagsByEventId - output of evaluateEvents
   * @param {object}               excludedDevices - set of device_ids to exclude (keyed)
   * @returns {number}
   */
  function calculateQualityScore(srcEvents, flagsByEventId, excludedDevices) {
    var score = 0;
    if (!Array.isArray(srcEvents)) return score;
    var exSet = excludedDevices || {};

    srcEvents.forEach(function(ev) {
      var eid = String(ev.event_id || '');

      // Excluded device (AF-03) → 0
      if (ev.device_id && exSet[String(ev.device_id)]) return;

      // Flagged event: check action (reject_event and reduce_score zero out score; flag_only does not)
      if (flagsByEventId && flagsByEventId.has(eid)) {
        var actions = getEventActions(flagsByEventId.get(eid));
        if (actions.isScoreZeroed) return;
      }

      var type = String(ev.event_type || ev.type || '');

      if (type === 'visit') {
        score += 1;
        // scroll_max bonus
        var scroll = Number(ev.scroll_max || ev.scroll_depth || 0);
        if (scroll > 50) score += 1;
      } else if (type === 'promotion_click' || type === 'outlet_click') {
        score += 2;
      } else if (type === 'whatsapp_click') {
        score += 2;
      } else if (type === 'google_review_click') {
        score += 3;
      } else if (type === 'direct_feedback_submit') {
        score += 3;
      }
    });

    return score;
  }

  // ---------------------------------------------------------------------------
  // Leaderboard builder
  // ---------------------------------------------------------------------------

  /**
   * Build leaderboard with quality scores and fraud flags.
   *
   * @param {Array}  events       - raw events
   * @param {Array}  sources      - [{source_id, name, location, ...}]
   * @param {Array}  staffDevices - [{device_id, staff_code}]
   * @param {object} thresholds   - fraud_thresholds from config
   * @returns {Array<object>}     - sorted leaderboard entries
   */
  function getLeaderboard(events, sources, staffDevices, thresholds) {
    var result = evaluateEvents(events, staffDevices, thresholds);
    var flagsByEventId = result.flagsByEventId;
    var t = mergeThresholds(thresholds);

    // Build excluded device set (staff)
    var excludedDevices = buildStaffSet(staffDevices);

    // Group events by source_id
    var bySource = {};
    if (Array.isArray(events)) {
      events.forEach(function(ev) {
        var sid = String(ev.source_id || '');
        if (!bySource[sid]) bySource[sid] = [];
        bySource[sid].push(ev);
      });
    }

    // Build leaderboard rows
    var rows = [];
    var allSourceIds = {};

    function processSourceEvents(sid, name, location, srcEvents) {
      var qScore = calculateQualityScore(srcEvents, flagsByEventId, excludedDevices);
      var validVisits = 0;
      var flaggedCount = 0;

      srcEvents.forEach(function(ev) {
        var eid = String(ev.event_id || '');
        var isExcluded = Boolean(ev.device_id && excludedDevices[String(ev.device_id)]);
        var hasFlags = flagsByEventId.has(eid);
        if (hasFlags) flaggedCount++;
        if (isExcluded) return; // AF-03 self-tap excluded

        if (hasFlags) {
          var actions = getEventActions(flagsByEventId.get(eid));
          if (actions.isRejected) return; // reject_event (e.g. AF-03, AF-06) drops visit
        }
        if ((ev.event_type || ev.type) === 'visit') validVisits++;
      });

      var af04Flagged = Boolean(t.quality_min_score > 0 && qScore < t.quality_min_score);

      return {
        source_id:    sid,
        name:         name || sid,
        location:     location || '',
        total_events: srcEvents.length,
        valid_visits: validVisits,
        flagged:      flaggedCount,
        quality_score:qScore,
        af04_flagged: af04Flagged
      };
    }

    // Include configured sources
    if (Array.isArray(sources)) {
      sources.forEach(function(src) {
        var sid = String(src.source_id || src.code || src.id || '');
        if (!sid) return;
        allSourceIds[sid] = true;
        var srcEvents = bySource[sid] || [];
        rows.push(processSourceEvents(sid, src.name || sid, src.location || src.outlet || '', srcEvents));
      });
    }

    // Include unconfigured sources that appear in events
    Object.keys(bySource).forEach(function(sid) {
      if (allSourceIds[sid]) return;
      var srcEvents = bySource[sid];
      rows.push(processSourceEvents(sid, sid, '', srcEvents));
    });

    // Sort by quality_score DESC, then valid_visits DESC
    rows.sort(function(a, b) {
      if (b.quality_score !== a.quality_score) return b.quality_score - a.quality_score;
      return b.valid_visits - a.valid_visits;
    });

    return rows;
  }

  // ---------------------------------------------------------------------------
  // Backend field normalization + threshold key mapping
  // ---------------------------------------------------------------------------

  /**
   * Map backend threshold keys (fraud_thresholds in Sheets config)
   * to the internal DEFAULTS keys used by the rules.
   */
  var BACKEND_THRESHOLD_MAP = {
    velocity_limit:  'velocity_max_events',
    burst_count:     'burst_max_events',
    hopping_sources: 'hopping_max_sources',
    low_dwell_ms:    'bot_min_dwell_ms',
    low_dwell_s:     'dwell_min_seconds'
  };

  function mapBackendThresholds(thresholds) {
    var mapped = {};
    if (thresholds && typeof thresholds === 'object') {
      Object.keys(BACKEND_THRESHOLD_MAP).forEach(function (bk) {
        var v = thresholds[bk];
        if (v !== undefined && v !== null && v !== '') {
          mapped[BACKEND_THRESHOLD_MAP[bk]] = Number(v);
        }
      });
      // Pass through any native keys as-is
      Object.keys(thresholds).forEach(function (k) {
        if (mapped[k] === undefined &&
            Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
          mapped[k] = thresholds[k];
        }
      });
    }
    return mapped;
  }

  /**
   * Normalize one backend event (get_events_data shape) to the field names
   * the fraud rules expect: timestamp, source_id, event_type.
   * Backend sends: ts_server/ts_client, source, event.
   */
  function normalizeEvent(ev) {
    if (!ev || typeof ev !== 'object') return ev;
    var out = {};
    var k;
    for (k in ev) {
      if (Object.prototype.hasOwnProperty.call(ev, k)) out[k] = ev[k];
    }
    if (!out.timestamp)  out.timestamp  = ev.ts_server || ev.ts_client || '';
    if (!out.source_id)  out.source_id  = ev.source || '';
    if (!out.event_type) out.event_type = ev.event || ev.type || '';
    return out;
  }

  function dayKey(ts) {
    var ms = toMs(ts);
    if (!ms) return '';
    var d = new Date(ms);
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m +
           '-' + (day < 10 ? '0' : '') + day;
  }

  // ---------------------------------------------------------------------------
  // Dashboard-facing evaluator (called by admin/index.html)
  // ---------------------------------------------------------------------------

  /**
   * Evaluate events and return dashboard-ready aggregates.
   *
   * @param {Array}  events       - raw events from get_events_data
   * @param {object} thresholds   - fraud_thresholds (backend keys supported)
   * @param {Array}  [sources]    - optional [{code|source_id|id, name, type, outlet}]
   * @param {Array}  [staffDevices]- optional [{device_id, staff_code}] for AF-03
   * @returns {object} {
   *   leaderboard: { staff: [], outlets: [] },
   *   totalVisits, avgQualityScore (0-5), totalReviews, totalWa,
   *   conversionRate, daily: [{date, visits, reviews}], sources: [],
   *   fraudSummary
   * }
   */
  function evaluate(events, thresholds, sources, staffDevices) {
    var norm = (Array.isArray(events) ? events : []).map(normalizeEvent);
    var t = mapBackendThresholds(thresholds);
    var staffList = Array.isArray(staffDevices) ? staffDevices : [];
    var evalRes = evaluateEvents(norm, staffList, t);
    var flags = evalRes.flagsByEventId;
    var excludedDevices = buildStaffSet(staffList);

    var metaById = {};
    (Array.isArray(sources) ? sources : []).forEach(function (s) {
      var id = String(s.code || s.source_id || s.id || '');
      if (id) metaById[id] = s;
    });

    var bySource = {};
    norm.forEach(function (ev) {
      var sid = String(ev.source_id || 'general');
      if (!bySource[sid]) bySource[sid] = [];
      bySource[sid].push(ev);
    });

    var totalVisits = 0, totalReviews = 0, totalWa = 0, scoreSum = 0;
    var dailyMap = {};
    var staffRows = [], outletRows = [], sourceRows = [];

    Object.keys(bySource).forEach(function (sid) {
      var list = bySource[sid];
      var meta = metaById[sid] || {};
      var stype = String(meta.type || (list[0] && list[0].source_type) || '');
      var name = meta.name || sid;
      var outlet = meta.outlet || '';

      var visits = 0, reviews = 0, wa = 0;
      list.forEach(function (ev) {
        var eid = String(ev.event_id || '');
        var isExcluded = Boolean(ev.device_id && excludedDevices[String(ev.device_id)]);
        if (isExcluded) return; // AF-03 self-tap

        if (flags.has(eid)) {
          var actions = getEventActions(flags.get(eid));
          if (actions.isRejected) return; // reject_event (e.g. AF-03, AF-06) drops the event
        }

        var et = String(ev.event_type || '');
        if (et === 'visit') {
          visits++; totalVisits++;
        } else if (et === 'google_review_click') {
          reviews++; totalReviews++;
        } else if (et === 'whatsapp_click') {
          wa++; totalWa++;
        }
        var d = dayKey(ev.timestamp);
        if (d) {
          if (!dailyMap[d]) dailyMap[d] = { date: d, visits: 0, reviews: 0 };
          if (et === 'visit') dailyMap[d].visits++;
          if (et === 'google_review_click') dailyMap[d].reviews++;
        }
      });

      var score = calculateQualityScore(list, flags, excludedDevices);
      scoreSum += score;

      var row = {
        code: sid, name: name, type: stype, outlet: outlet,
        visits: visits, reviews: reviews, waClicks: wa,
        score: score,
        conversionRate: visits > 0 ? reviews / visits : 0,
        active: true
      };
      sourceRows.push(row);

      // Pengelompokan leaderboard terstandar (ANA-08):
      // Hanya staf dan sales yang masuk peringkat staf. Hanya outlet F&B yang masuk peringkat gerai.
      // NFC (stiker meja) dan general tidak dicampur ke peringkat gerai F&B.
      if (stype === 'staff' || stype === 'sales') {
        staffRows.push({ name: name, code: sid, score: score, reviews: reviews, outlet: outlet, role: meta.role || stype });
      } else if (stype === 'outlet') {
        outletRows.push({ name: name, score: score, reviews: reviews, visits: visits });
      }
    });

    var daily = Object.keys(dailyMap).map(function (k) { return dailyMap[k]; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    function byScoreDesc(a, b) { return (b.score || 0) - (a.score || 0); }
    staffRows.sort(byScoreDesc);
    outletRows.sort(byScoreDesc);
    sourceRows.sort(byScoreDesc);

    return {
      leaderboard:   { staff: staffRows, outlets: outletRows },
      totalVisits:   totalVisits,
      avgQualityScore: totalVisits > 0 ? Math.min(5, scoreSum / totalVisits) : 0,
      totalReviews:  totalReviews,
      totalWa:       totalWa,
      conversionRate: totalVisits > 0 ? totalReviews / totalVisits : 0,
      daily:         daily,
      sources:       sourceRows,
      fraudSummary:  evalRes.summary,
      flagsByEventId: flags
    };
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------
  window.BSAntiFraud = {
    RULES:                 RULES,
    DEFAULTS:              DEFAULTS,
    getEventActions:       getEventActions,
    mapBackendThresholds:  mapBackendThresholds,
    evaluate:              evaluate,
    evaluateEvents:        evaluateEvents,
    calculateQualityScore: calculateQualityScore,
    getLeaderboard:        getLeaderboard
  };

})(window);
