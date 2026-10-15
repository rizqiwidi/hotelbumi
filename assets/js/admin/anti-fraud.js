/**
 * BUMI SURABAYA v6.3
 * anti-fraud.js — Anti-Fraud Engine (8 rules, FR-P0-06 & FR-P1-01)
 *
 * Rules:
 *  AF-01  velocity    — too many visits from same device to same source in 24h window
 *  AF-02  burst       — sudden spike of visits to same source in 10-minute bucket
 *  AF-03  self_tap    — event device_id matches a registered staff device
 *  AF-04  low_quality — visit dwell time < threshold (5s) with 0 interactions
 *  AF-05  hopping     — same device scans > N different sources within 1h window
 *  AF-06  bot         — honeypot filled, or identical event type spam < 500ms, or visit dwell < 1000ms with 0 interactions
 *  AF-07  shared_ip   — many distinct devices share the same non-placeholder IP address
 *  AF-08  odd_hour    — event outside configured operating hours (06:00–23:00 WIB)
 */

(function(window) {
  'use strict';

  var RULES = {
    'AF-01': {
      id: 'AF-01',
      name: 'Velocity Limit',
      severity: 'high',
      action: 'reduce_score',
      desc: 'Frekuensi kunjungan per perangkat ke sumber yang sama melebihi batas dalam 24 jam'
    },
    'AF-02': {
      id: 'AF-02',
      name: 'Burst Detection',
      severity: 'medium',
      action: 'reduce_score',
      desc: 'Lonjakan kunjungan ke satu sumber dalam durasi singkat 10 menit'
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
      desc: 'Sinyal bot terdeteksi (honeypot terisi atau spam event identik < 500ms)'
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

  var DEFAULTS = {
    velocity_window_ms:    86400000, // AF-01: rolling window 24 jam (ms)
    velocity_max_events:   3,        // AF-01: max kunjungan per device per sumber per 24 jam
    burst_window_ms:       600000,   // AF-02: 10-minute bucket (ms)
    burst_max_events:      5,        // AF-02: max kunjungan per sumber dalam 10 menit
    low_dwell_ms:          5000,     // AF-04: minimum dwell ms (5 detik)
    hopping_window_ms:     3600000,  // AF-05: 1-hour window (ms)
    hopping_max_sources:   4,        // AF-05: max unique sources per device dalam 1 jam
    bot_min_dwell_ms:      500,      // AF-06: minimum ms between identical events from same device
    shared_ip_max_devices: 10,       // AF-07: max distinct devices per IP
    odd_hour_start:        6,        // AF-08: jam operasional mulai WIB (06:00 inclusive)
    odd_hour_end:          23        // AF-08: jam operasional selesai WIB (23:00 exclusive)
  };

  function mergeThresholds(thresholds) {
    var t = {};
    var k;
    for (k in DEFAULTS) { t[k] = DEFAULTS[k]; }
    if (thresholds && typeof thresholds === 'object') {
      for (k in thresholds) {
        if (Object.prototype.hasOwnProperty.call(thresholds, k) &&
            Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
          var numVal = Number(thresholds[k]);
          if (!isNaN(numVal)) t[k] = numVal;
        }
      }
    }
    // Normalisasi pengaman: jika konfigurasi lama menyimpan odd_hour_start: 0, odd_hour_end: 5
    // (yang merepresentasikan jam ganjil 00-05, bukan jam operasional 06-23), konversi ke 6..23 (FR-P0-06)
    if (t.odd_hour_start === 0 && t.odd_hour_end <= 6) {
      t.odd_hour_start = 6;
      t.odd_hour_end = 23;
    }
    if (t.bot_min_dwell_ms > 2000) {
      t.bot_min_dwell_ms = 500;
    }
    return t;
  }

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

  function flagEvent(map, eventId, rule) {
    if (!map.has(eventId)) map.set(eventId, []);
    var arr = map.get(eventId);
    if (arr.indexOf(rule) === -1) arr.push(rule);
  }

  /**
   * AF-01 velocity — per (device_id + source_id + event_type) rolling-window count (FR-P1-01).
   * Mencegah interaksi normal dalam 1 sesi (1 visit + klik promo + klik review) dianggap spam velocity.
   */
  function applyVelocity(events, flagsByEventId, t) {
    var byDevSourceType = {};
    events.forEach(function(ev) {
      var did = String(ev.device_id || '');
      if (!did) return;
      var sid = String(ev.source_id || ev.source || 'general');
      var et  = String(ev.event_type || ev.event || ev.type || 'visit');
      var key = did + '|' + sid + '|' + et;
      if (!byDevSourceType[key]) byDevSourceType[key] = [];
      byDevSourceType[key].push(ev);
    });

    Object.keys(byDevSourceType).forEach(function(key) {
      var devEvents = byDevSourceType[key].slice().sort(function(a, b) {
        return toMs(a.timestamp) - toMs(b.timestamp);
      });
      var start = 0;
      for (var i = 0; i < devEvents.length; i++) {
        var tNow = toMs(devEvents[i].timestamp);
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
   * AF-02 burst — lonjakan kunjungan (visit) per source_id dalam bucket 10 menit (FR-P1-01).
   */
  function applyBurst(events, flagsByEventId, t) {
    var buckets = {};
    events.forEach(function(ev) {
      var et = String(ev.event_type || ev.event || ev.type || '');
      if (et !== 'visit') return;
      var ms   = toMs(ev.timestamp);
      if (!ms) return;
      var sid  = String(ev.source_id || ev.source || 'general');
      var buck = sid + '|' + Math.floor(ms / t.burst_window_ms);
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

  function isPlaceholderIp(ip) {
    if (!ip) return true;
    var s = String(ip).trim().toLowerCase();
    return s === '' || s === 'client-ip' || s === 'unknown' || s === 'null' || s === 'undefined' || s === '-' || s === '127.0.0.1';
  }

  /**
   * AF-04 low_quality — dwell time < threshold (5000ms) dan interaksi 0 pada event visit.
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
   * AF-06 bot — sinyal honeypot aktif, visit dwell < 1000ms tanpa interaksi, atau spam event bertipe SAMA < 500ms (FR-P0-06).
   */
  function applyBot(events, flagsByEventId, t) {
    events.forEach(function(ev) {
      if (ev.bot_flag === true || ev.bot_flag === 'TRUE') {
        flagEvent(flagsByEventId, String(ev.event_id), 'AF-06');
      }
      var et = String(ev.event_type || ev.event || ev.type || '');
      var dwell = Number(ev.dwell_ms) || 0;
      var inter = Number(ev.interactions) || 0;
      if (et === 'visit' && dwell > 0 && dwell < 1000 && inter === 0) {
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
        var prevEv = devEvents[i - 1];
        var currEv = devEvents[i];
        var prevType = String(prevEv.event_type || prevEv.event || '');
        var currType = String(currEv.event_type || currEv.event || '');
        // Hanya tandai bot jika tipe event identik ditembak beruntun < bot_min_dwell_ms (500ms)
        if (prevType && prevType === currType) {
          var delta = toMs(currEv.timestamp) - toMs(prevEv.timestamp);
          if (delta >= 0 && delta < t.bot_min_dwell_ms) {
            flagEvent(flagsByEventId, String(currEv.event_id), 'AF-06');
            flagEvent(flagsByEventId, String(prevEv.event_id), 'AF-06');
          }
        }
      }
    });
  }

  /**
   * AF-07 shared_ip — banyak perangkat unik berbagi IP yang sama.
   */
  function applySharedIp(events, flagsByEventId, t) {
    var byIp = {};
    events.forEach(function(ev) {
      var ip = String(ev.ip_address || ev.ip || '');
      if (isPlaceholderIp(ip)) return;
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
   * AF-08 odd_hour — event outside [odd_hour_start, odd_hour_end) in WIB (UTC+7).
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

  function evaluateEvents(events, staffDevices, thresholds) {
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

  function calculateQualityScore(srcEvents, flagsByEventId, excludedDevices) {
    var score = 0;
    if (!Array.isArray(srcEvents)) return score;
    var exSet = excludedDevices || {};

    srcEvents.forEach(function(ev) {
      var eid = String(ev.event_id || '');
      if (ev.device_id && exSet[String(ev.device_id)]) return;

      if (flagsByEventId && flagsByEventId.has(eid)) {
        var actions = getEventActions(flagsByEventId.get(eid));
        if (actions.isScoreZeroed) return;
      }

      var type = String(ev.event_type || ev.type || '');

      if (type === 'visit') {
        score += 1;
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

  function getLeaderboard(events, sources, staffDevices, thresholds) {
    var result = evaluateEvents(events, staffDevices, thresholds);
    var flagsByEventId = result.flagsByEventId;
    var t = mergeThresholds(thresholds);
    var excludedDevices = buildStaffSet(staffDevices);

    var bySource = {};
    if (Array.isArray(events)) {
      events.forEach(function(ev) {
        var sid = String(ev.source_id || '');
        if (!bySource[sid]) bySource[sid] = [];
        bySource[sid].push(ev);
      });
    }

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
        if (isExcluded) return;

        if (hasFlags) {
          var actions = getEventActions(flagsByEventId.get(eid));
          if (actions.isRejected) return;
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

    if (Array.isArray(sources)) {
      sources.forEach(function(src) {
        var sid = String(src.source_id || src.code || src.id || '');
        if (!sid) return;
        allSourceIds[sid] = true;
        var srcEvents = bySource[sid] || [];
        rows.push(processSourceEvents(sid, src.name || sid, src.location || src.outlet || '', srcEvents));
      });
    }

    Object.keys(bySource).forEach(function(sid) {
      if (allSourceIds[sid]) return;
      var srcEvents = bySource[sid];
      rows.push(processSourceEvents(sid, sid, '', srcEvents));
    });

    rows.sort(function(a, b) {
      if (b.quality_score !== a.quality_score) return b.quality_score - a.quality_score;
      return b.valid_visits - a.valid_visits;
    });

    return rows;
  }

  /**
   * Map backend threshold keys (fraud_thresholds in Sheets config)
   * to the internal DEFAULTS keys used by the rules.
   * FIXED (FR-P0-06): low_dwell_ms maps to low_dwell_ms (NOT bot_min_dwell_ms!).
   */
  var BACKEND_THRESHOLD_MAP = {
    velocity_limit:  'velocity_max_events',
    burst_count:     'burst_max_events',
    hopping_sources: 'hopping_max_sources',
    low_dwell_ms:    'low_dwell_ms',
    bot_min_dwell_ms:'bot_min_dwell_ms'
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
      if (thresholds.low_dwell_s !== undefined && mapped.low_dwell_ms === undefined) {
        mapped.low_dwell_ms = Number(thresholds.low_dwell_s) * 1000;
      }
      Object.keys(thresholds).forEach(function (k) {
        if (mapped[k] === undefined &&
            Object.prototype.hasOwnProperty.call(DEFAULTS, k)) {
          mapped[k] = thresholds[k];
        }
      });
    }
    return mapped;
  }

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
        if (isExcluded) return;

        if (flags.has(eid)) {
          var actions = getEventActions(flags.get(eid));
          if (actions.isRejected) return;
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
        active: meta.active !== false
      };
      sourceRows.push(row);

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
      leaderboard:    { staff: staffRows, outlets: outletRows },
      totalVisits:    totalVisits,
      avgQualityScore:totalVisits > 0 ? Math.min(5, scoreSum / totalVisits) : 0,
      totalReviews:   totalReviews,
      totalWa:        totalWa,
      conversionRate: totalVisits > 0 ? totalReviews / totalVisits : 0,
      daily:          daily,
      sources:        sourceRows,
      fraudSummary:   evalRes.summary,
      flagsByEventId: flags
    };
  }

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
