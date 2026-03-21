/**
 * PX Core — Browser Edition
 *
 * Zero-dependency verification engine.
 * Ported from cli.js for browser execution.
 * All processing happens in-browser. No data leaves the page.
 */

'use strict';

var PXCore = (function() {

  var VERSION = '0.1.0';

  // ── Path resolution ──

  function resolveDotPath(obj, dotPath) {
    var segs = dotPath.split('.');
    var cur = obj;
    for (var i = 0; i < segs.length; i++) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
      cur = cur[segs[i]];
    }
    return cur;
  }

  // ── Rule verification ──

  function verifyRule(value, rule) {
    if (value === undefined || value === null) {
      return { pass: false, reason: 'file_not_found: ' + (rule.path || rule.field || rule.id) };
    }
    var op = rule.operator || 'eq';

    // Workspace-style rules (field + minimum/maximum/expected)
    if (rule.field && !rule.path) {
      if (rule.expected !== undefined) {
        return value === rule.expected
          ? { pass: true, reason: 'ok' }
          : { pass: false, reason: 'got ' + JSON.stringify(value) + ', expected ' + JSON.stringify(rule.expected) };
      }
      if (rule.minimum !== undefined) {
        return (typeof value === 'number' && value >= rule.minimum)
          ? { pass: true, reason: 'ok' }
          : { pass: false, reason: 'value ' + value + ' below minimum ' + rule.minimum };
      }
      if (rule.maximum !== undefined) {
        return (typeof value === 'number' && value <= rule.maximum)
          ? { pass: true, reason: 'ok' }
          : { pass: false, reason: 'value ' + value + ' exceeds maximum ' + rule.maximum };
      }
      if (rule.max_items !== undefined && Array.isArray(value)) {
        return value.length <= rule.max_items
          ? { pass: true, reason: 'ok' }
          : { pass: false, reason: 'count ' + value.length + ' exceeds max ' + rule.max_items };
      }
      // Required only — presence check
      if (rule.required) {
        return { pass: true, reason: 'ok' };
      }
      return { pass: true, reason: 'ok' };
    }

    // Custom profile style (path + operator + expected)
    if (op === 'eq') {
      return value === rule.expected
        ? { pass: true, reason: 'ok' }
        : { pass: false, reason: 'got ' + JSON.stringify(value) + ', expected ' + JSON.stringify(rule.expected) };
    }
    if (op === 'gte') {
      return (typeof value === 'number' && value >= rule.expected)
        ? { pass: true, reason: 'ok' }
        : { pass: false, reason: 'value ' + value + ' below minimum ' + rule.expected };
    }
    if (op === 'lte') {
      return (typeof value === 'number' && value <= rule.expected)
        ? { pass: true, reason: 'ok' }
        : { pass: false, reason: 'value ' + value + ' exceeds maximum ' + rule.expected };
    }
    return { pass: false, reason: 'unknown operator: ' + op };
  }

  function runVerify(profile, evidenceData) {
    var rules = profile.rules || [];
    var results = [];
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      var path = rule.path || rule.field;
      var value = resolveDotPath(evidenceData, path);
      var check = verifyRule(value, rule);
      results.push({
        id: rule.id || (profile.profile_id + '.' + path),
        description: rule.description || '',
        pass: check.pass,
        reason: check.reason,
        path: path,
        expected: rule.expected !== undefined ? rule.expected : (rule.minimum !== undefined ? '>=' + rule.minimum : rule.maximum !== undefined ? '<=' + rule.maximum : '?'),
        got: value
      });
    }
    return results;
  }

  // ── SHA-256 (WebCrypto) ──

  async function hashBuffer(buffer) {
    var digest = await crypto.subtle.digest('SHA-256', buffer);
    var bytes = new Uint8Array(digest);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      hex += bytes[i].toString(16).padStart(2, '0');
    }
    return 'sha256:' + hex;
  }

  async function hashFile(file) {
    var buffer = await file.arrayBuffer();
    return hashBuffer(buffer);
  }

  async function hashString(str) {
    var data = new TextEncoder().encode(str);
    return hashBuffer(data);
  }

  // ── Seal generation ──

  function generateSeal(packetHash, createdAt, allPass, ruleCount) {
    var hex = packetHash.replace(/^sha256:/, '');
    var hashPart = hex.substring(8, 12).toUpperCase();
    var date = new Date(createdAt);
    var quarter = 'Q' + (Math.floor(date.getMonth() / 3) + 1);
    var timePart = date.getFullYear() + quarter;
    var resultPart = allPass ? 'PASS' : 'MIXED';
    return 'PX-' + hashPart + '-' + timePart + '-' + resultPart + '-' + ruleCount;
  }

  // ── File type detection ──

  var TYPE_MAP = {
    'xlsx': 'questionnaire', 'xls': 'questionnaire', 'csv': 'questionnaire',
    'json': 'evidence-structured',
    'pdf': 'evidence-document', 'docx': 'evidence-document', 'doc': 'evidence-document',
    'png': 'evidence-screenshot', 'jpg': 'evidence-screenshot', 'jpeg': 'evidence-screenshot', 'gif': 'evidence-screenshot',
    'yaml': 'config', 'yml': 'config', 'toml': 'config', 'ini': 'config',
    'zip': 'archive', 'tar': 'archive', 'gz': 'archive', 'tgz': 'archive',
    'exe': 'binary', 'dmg': 'binary', 'deb': 'binary', 'rpm': 'binary', 'msi': 'binary',
    'spdx': 'sbom', 'cdx': 'sbom',
    'md': 'document', 'txt': 'document', 'rtf': 'document',
    'html': 'document', 'htm': 'document',
    'xml': 'evidence-structured', 'log': 'evidence-structured',
  };

  var TYPE_LABELS = {
    'questionnaire': { label: 'Questionnaire', icon: '\ud83d\udccb' },
    'evidence-structured': { label: 'Evidence (structured)', icon: '\ud83d\udcc4' },
    'evidence-document': { label: 'Evidence (document)', icon: '\ud83d\udcc4' },
    'evidence-screenshot': { label: 'Evidence (screenshot)', icon: '\ud83d\uddbc\ufe0f' },
    'config': { label: 'Config', icon: '\u2699\ufe0f' },
    'archive': { label: 'Archive', icon: '\ud83d\udce6' },
    'binary': { label: 'Binary', icon: '\ud83d\udcbe' },
    'sbom': { label: 'SBOM', icon: '\ud83d\udcdc' },
    'document': { label: 'Document', icon: '\ud83d\udcc3' },
    'unknown': { label: 'Other', icon: '\ud83d\udcc1' },
  };

  function detectFileType(fileName) {
    var ext = (fileName.split('.').pop() || '').toLowerCase();
    return TYPE_MAP[ext] || 'unknown';
  }

  function getTypeLabel(type) {
    return TYPE_LABELS[type] || TYPE_LABELS['unknown'];
  }

  // ── CSV Parser (zero-dependency) ──

  function parseCSV(text) {
    var lines = text.split(/\r?\n/);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      // Simple CSV parse: handles quoted fields with commas
      var row = [];
      var inQuote = false;
      var field = '';
      for (var j = 0; j < lines[i].length; j++) {
        var ch = lines[i][j];
        if (ch === '"') {
          if (inQuote && lines[i][j+1] === '"') { field += '"'; j++; }
          else { inQuote = !inQuote; }
        } else if (ch === ',' && !inQuote) {
          row.push(field.trim()); field = '';
        } else {
          field += ch;
        }
      }
      row.push(field.trim());
      result.push(row);
    }
    return result;
  }

  // ── Questionnaire structure detection ──

  var Q_KEYWORDS = ['question', 'q', 'item', 'control', 'requirement', '\u8cea\u554f', '\u554f\u984c', '\u7ba1\u7406\u7b56', '\u8981\u4ef6'];
  var A_KEYWORDS = ['answer', 'response', 'status', 'result', '\u56de\u7b54', '\u30b9\u30c6\u30fc\u30bf\u30b9', '\u7d50\u679c'];
  var E_KEYWORDS = ['evidence', 'proof', 'file', 'attachment', 'reference', '\u8a3c\u62e0', '\u6dfb\u4ed8'];

  function detectQuestionnaireColumns(headers) {
    var cols = { question: -1, answer: -1, evidence: -1, id: -1 };
    for (var i = 0; i < headers.length; i++) {
      var h = headers[i].toLowerCase();
      // ID column: first short column with # or id or no.
      if (cols.id === -1 && (h === 'id' || h === '#' || h === 'no' || h === 'no.')) {
        cols.id = i;
      }
      for (var k = 0; k < Q_KEYWORDS.length; k++) {
        if (h.indexOf(Q_KEYWORDS[k]) !== -1) { cols.question = i; break; }
      }
      for (var k = 0; k < A_KEYWORDS.length; k++) {
        if (h.indexOf(A_KEYWORDS[k]) !== -1) { cols.answer = i; break; }
      }
      for (var k = 0; k < E_KEYWORDS.length; k++) {
        if (h.indexOf(E_KEYWORDS[k]) !== -1) { cols.evidence = i; break; }
      }
    }
    return cols;
  }

  // ── Evidence-Question matching ──

  function matchEvidence(question, evidenceFiles) {
    var qLower = question.toLowerCase();
    var matches = [];
    for (var i = 0; i < evidenceFiles.length; i++) {
      var f = evidenceFiles[i];
      var fName = f.name.toLowerCase().replace(/[-_.]/g, ' ');
      // Extract meaningful words from filename
      var fWords = fName.replace(/\.[^.]+$/, '').split(/\s+/);
      var score = 0;
      for (var w = 0; w < fWords.length; w++) {
        if (fWords[w].length < 3) continue;
        if (qLower.indexOf(fWords[w]) !== -1) score += 2;
      }
      // Check common keyword mapping
      var keywords = extractKeywords(qLower);
      for (var k = 0; k < keywords.length; k++) {
        if (fName.indexOf(keywords[k]) !== -1) score += 3;
      }
      if (score > 0) matches.push({ file: f, score: score });
    }
    matches.sort(function(a, b) { return b.score - a.score; });
    return matches;
  }

  function extractKeywords(text) {
    var kw = [];
    var patterns = [
      { re: /\bmfa\b|multi.?factor|2fa|two.?factor/i, kw: 'mfa' },
      { re: /\bencrypt/i, kw: 'encrypt' },
      { re: /\bpassword/i, kw: 'password' },
      { re: /\bpatch/i, kw: 'patch' },
      { re: /\bfirewall/i, kw: 'firewall' },
      { re: /\bbackup/i, kw: 'backup' },
      { re: /\blog(ging|s)?\b/i, kw: 'log' },
      { re: /\baccess/i, kw: 'access' },
      { re: /\biam\b/i, kw: 'iam' },
      { re: /\bs3\b/i, kw: 's3' },
      { re: /\brds\b/i, kw: 'rds' },
      { re: /\bvpc\b/i, kw: 'vpc' },
      { re: /\bkms\b/i, kw: 'kms' },
      { re: /\bsbom\b/i, kw: 'sbom' },
      { re: /\baudit/i, kw: 'audit' },
      { re: /\bconfig/i, kw: 'config' },
      { re: /\bpolicy/i, kw: 'policy' },
      { re: /\bcert/i, kw: 'cert' },
    ];
    for (var i = 0; i < patterns.length; i++) {
      if (patterns[i].re.test(text)) kw.push(patterns[i].kw);
    }
    return kw;
  }

  // ── Manifest builder ──

  function buildManifest(opts) {
    var now = opts.createdAt || new Date().toISOString();
    var id = 'draft-' + now.slice(0,10).replace(/-/g,'') + '-' + String(Date.now()).slice(-4);
    var mRef = 'mf-' + now.slice(0,10).replace(/-/g,'') + '-' + String(Date.now()).slice(-4);

    return {
      manifest_type: 'DRAFT_MANIFEST',
      manifest_ref: mRef,
      packet_ref: id,
      seal: opts.seal || null,
      artifact_kind: 'proof-pack',
      created_at: now,
      generator: 'px-cloud/' + VERSION,
      project: opts.project || 'cloud-pack',
      framework: opts.framework || 'GENERIC',
      verification_mode: opts.verificationMode || 'cloud',
      evidence_summary: opts.evidenceSummary || {
        total: 0, passed: 0, failed: 0, all_pass: true, profiles: []
      },
      packet_hash: opts.packetHash || null,
      intended_recipient: opts.recipient || null,
      stated_purpose: opts.purpose || null,
      bundled_profile: 'bundled-profile.json',
      bundled_evidence: 'bundled-evidence.json',
      submission_state: 'NOT_SUBMITTED',
      submission_id: null,
      sct: null,
      acceptance_receipt: null,
      recipient_binding: null,
      parent_manifest_refs: [],
      clearing_batch_ref: null
    };
  }

  // ── Lens v2 HTML generation ──

  function generateLensHtml(manifest, evidence, profile, results) {
    // Fetch the lens-v2 template and inject data
    // In browser, we use inline template stored in this module
    var html = LENS_TEMPLATE;
    html = injectData(html, '__MANIFEST__', manifest);
    html = injectData(html, '__EVIDENCE__', evidence);
    html = injectData(html, '__PROFILE__', profile);
    html = injectData(html, '__RESULTS__', results);
    return html;
  }

  function injectData(tmpl, marker, data) {
    var tag = '/*' + marker + '*/';
    var idx = tmpl.indexOf(tag);
    if (idx === -1) return tmpl;
    var afterTag = idx + tag.length;
    var suffix = tmpl.substring(afterTag);
    var endMatch = suffix.match(/;\s*\n/);
    if (!endMatch) return tmpl;
    return tmpl.substring(0, afterTag) + JSON.stringify(data) + suffix.substring(endMatch.index);
  }

  // Template placeholder — loaded asynchronously
  var LENS_TEMPLATE = '';

  async function loadLensTemplate() {
    if (LENS_TEMPLATE) return;
    try {
      var resp = await fetch('../lens-v2.html');
      if (resp.ok) LENS_TEMPLATE = await resp.text();
    } catch(e) { /* Lens template not available, pack download will skip Lens */ }
  }

  // ── Format helpers ──

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ══════════════════════════════════════════
  // Public API
  // ══════════════════════════════════════════

  return {
    VERSION: VERSION,
    resolveDotPath: resolveDotPath,
    verifyRule: verifyRule,
    runVerify: runVerify,
    hashFile: hashFile,
    hashString: hashString,
    generateSeal: generateSeal,
    detectFileType: detectFileType,
    getTypeLabel: getTypeLabel,
    parseCSV: parseCSV,
    detectQuestionnaireColumns: detectQuestionnaireColumns,
    matchEvidence: matchEvidence,
    buildManifest: buildManifest,
    generateLensHtml: generateLensHtml,
    loadLensTemplate: loadLensTemplate,
    formatBytes: formatBytes,
  };

})();
