#!/usr/bin/env node
'use strict';

/**
 * PX CLI — Proof Exchange Command Line Interface
 *
 * PX makes proof you can hand off.
 *
 * Zero external dependencies. Node.js built-ins only.
 * Every byte of dependency is a cost multiplier when
 * Traffic Clock activates. This CLI sets the weight standard.
 *
 * Commands:
 *   px init              Create an empty PX workspace
 *   px init --demo       Create a workspace with sample profiles
 *   px init --genesis    Create a workspace that verifies PX itself
 *   px generate          Generate evidence from system state
 *   px verify            Verify evidence against profiles
 *   px pack              Create a Draft Packet
 *   px status            Show current workspace state
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ══════════════════════════════════════════
// Constants
// ══════════════════════════════════════════

const VERSION = '0.1.0';
const PX_DIR = 'px';
const CONFIG_FILE = 'px.config.json';
const PROFILES_DIR = 'profiles';
const EVIDENCE_DIR = 'evidence';
const OUTPUT_DIR = 'output';

// ══════════════════════════════════════════
// Console output helpers
// ══════════════════════════════════════════

const CLR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  grey: '\x1b[90m',
};

function log(msg = '') {
  console.log(msg);
}

function info(msg) {
  console.log(`  ${CLR.cyan}▸${CLR.reset} ${msg}`);
}

function success(msg) {
  console.log(`  ${CLR.green}✓${CLR.reset} ${msg}`);
}

function warn(msg) {
  console.log(`  ${CLR.yellow}⚠${CLR.reset} ${msg}`);
}

function fail(msg) {
  console.error(`  ${CLR.red}✗${CLR.reset} ${msg}`);
}

function heading(msg) {
  log();
  log(`  ${CLR.bold}${msg}${CLR.reset}`);
  log();
}

function dimText(msg) {
  return `${CLR.dim}${msg}${CLR.reset}`;
}

// ══════════════════════════════════════════
// File system helpers
// ══════════════════════════════════════════

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function pxRoot() {
  return path.join(process.cwd(), PX_DIR);
}

function pxPath(...segments) {
  return path.join(pxRoot(), ...segments);
}

function relativePx(...segments) {
  return `./${PX_DIR}/${segments.join('/')}`;
}

// ══════════════════════════════════════════
// Demo data — SOC 2 profiles
// ══════════════════════════════════════════

function demoConfig() {
  return {
    px_version: VERSION,
    project: 'my-saas-app',
    target_framework: 'SOC2',
    created_at: new Date().toISOString(),
    evidence_dir: EVIDENCE_DIR,
    output_dir: OUTPUT_DIR,
    profiles: [
      'soc2-access-control',
      'soc2-encryption',
      'soc2-patch-management',
      'soc2-monitoring',
    ],
  };
}

function demoProfiles() {
  return {
    'soc2-access-control': {
      profile_id: 'soc2-access-control',
      profile_version: '1.0.0',
      framework: 'SOC2',
      category: 'CC6.1 — Logical and Physical Access Controls',
      description: 'Verifies that access control configurations meet SOC 2 requirements.',
      rules: [
        {
          field: 'mfa_enforced',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Multi-factor authentication must be enforced for all users.',
        },
        {
          field: 'password_min_length',
          type: 'number',
          required: true,
          minimum: 12,
          description: 'Minimum password length must be at least 12 characters.',
        },
        {
          field: 'idle_session_timeout_minutes',
          type: 'number',
          required: true,
          maximum: 30,
          description: 'Idle sessions must time out within 30 minutes.',
        },
        {
          field: 'admin_accounts',
          type: 'array',
          required: true,
          max_items: 5,
          description: 'Administrative accounts should be limited (max 5).',
        },
        {
          field: 'rbac_enabled',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Role-based access control must be enabled.',
        },
        {
          field: 'service_account_rotation_days',
          type: 'number',
          required: true,
          maximum: 90,
          description: 'Service account credentials must rotate within 90 days.',
        },
      ],
    },

    'soc2-encryption': {
      profile_id: 'soc2-encryption',
      profile_version: '1.0.0',
      framework: 'SOC2',
      category: 'CC6.7 — Encryption in Transit and at Rest',
      description: 'Verifies that encryption configurations meet SOC 2 requirements.',
      rules: [
        {
          field: 'encryption_at_rest',
          type: 'string',
          required: true,
          allowed: ['AES-256', 'AES-256-GCM', 'ChaCha20-Poly1305'],
          description: 'Data at rest must be encrypted with approved algorithms.',
        },
        {
          field: 'encryption_in_transit',
          type: 'string',
          required: true,
          allowed: ['TLS-1.2', 'TLS-1.3'],
          description: 'Data in transit must use TLS 1.2 or higher.',
        },
        {
          field: 'key_management_service',
          type: 'string',
          required: true,
          description: 'A key management service must be specified.',
        },
        {
          field: 'key_rotation_days',
          type: 'number',
          required: true,
          maximum: 365,
          description: 'Encryption keys must rotate at least annually.',
        },
      ],
    },

    'soc2-patch-management': {
      profile_id: 'soc2-patch-management',
      profile_version: '1.0.0',
      framework: 'SOC2',
      category: 'CC7.1 — System Operations and Monitoring',
      description: 'Verifies that patch management practices meet SOC 2 requirements.',
      rules: [
        {
          field: 'critical_patch_sla_hours',
          type: 'number',
          required: true,
          maximum: 72,
          description: 'Critical patches must be applied within 72 hours.',
        },
        {
          field: 'high_patch_sla_days',
          type: 'number',
          required: true,
          maximum: 14,
          description: 'High-severity patches must be applied within 14 days.',
        },
        {
          field: 'auto_update_enabled',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Automatic updates should be enabled for OS and dependencies.',
        },
        {
          field: 'outstanding_critical_patches',
          type: 'number',
          required: true,
          maximum: 0,
          description: 'No outstanding critical patches should exist.',
        },
        {
          field: 'last_scan_days_ago',
          type: 'number',
          required: true,
          maximum: 7,
          description: 'Vulnerability scan must have run within the last 7 days.',
        },
        {
          field: 'dependency_audit_enabled',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Dependency auditing (e.g., npm audit, pip audit) must be enabled.',
        },
      ],
    },

    'soc2-monitoring': {
      profile_id: 'soc2-monitoring',
      profile_version: '1.0.0',
      framework: 'SOC2',
      category: 'CC7.2 — Detection and Monitoring',
      description: 'Verifies that monitoring and detection configurations meet SOC 2 requirements.',
      rules: [
        {
          field: 'centralized_logging',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Centralized logging must be enabled.',
        },
        {
          field: 'log_retention_days',
          type: 'number',
          required: true,
          minimum: 90,
          description: 'Logs must be retained for at least 90 days.',
        },
        {
          field: 'alerting_enabled',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Alerting must be enabled for security events.',
        },
        {
          field: 'intrusion_detection',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Intrusion detection system must be active.',
        },
        {
          field: 'uptime_monitoring',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Uptime monitoring must be active for production systems.',
        },
        {
          field: 'alert_response_sla_minutes',
          type: 'number',
          required: true,
          maximum: 60,
          description: 'Critical alerts must have a response SLA of 60 minutes or less.',
        },
        {
          field: 'security_dashboard',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'A security dashboard must be maintained.',
        },
        {
          field: 'log_tampering_protection',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'Logs must be protected against tampering.',
        },
        {
          field: 'incident_runbook_exists',
          type: 'boolean',
          required: true,
          expected: true,
          description: 'An incident response runbook must exist.',
        },
      ],
    },
  };
}

// ══════════════════════════════════════════
// Genesis data — PX verifying itself
// ══════════════════════════════════════════

const GENESIS_TARGETS = [
  { id: 'px-governance-vocabulary',       file: 'governance-vocabulary.json' },
  { id: 'px-verification-basis',          file: 'verification-basis-registry.json' },
  { id: 'px-evidence-profile-registry',   file: 'evidence-profile-registry.json' },
  { id: 'px-root-ops-policy',             file: 'root-ops-policy.json' },
  { id: 'px-delegation-policy',           file: 'delegation-policy.json' },
];

function genesisConfig() {
  return {
    px_version: VERSION,
    project: 'px-genesis',
    target_framework: 'PX_SELF_VERIFICATION',
    mode: 'genesis',
    source_dir: 'v1',
    created_at: new Date().toISOString(),
    evidence_dir: EVIDENCE_DIR,
    output_dir: OUTPUT_DIR,
    profiles: GENESIS_TARGETS.map(t => t.id),
  };
}

function genesisProfile(target) {
  return {
    profile_id: target.id,
    profile_version: '1.0.0',
    framework: 'PX_SELF_VERIFICATION',
    category: 'PX Governance Structure',
    description: `Verifies the structural integrity of ${target.file}.`,
    source_path: path.join('v1', target.file),
    mode: 'genesis',
    rules: [
      {
        field: 'source_exists',
        type: 'boolean',
        required: true,
        expected: true,
        description: `The file v1/${target.file} must exist.`,
      },
      {
        field: 'json_parseable',
        type: 'boolean',
        required: true,
        expected: true,
        description: 'The file must contain valid JSON.',
      },
      {
        field: 'byte_size',
        type: 'number',
        required: true,
        minimum: 1,
        description: 'The file must not be empty.',
      },
      {
        field: 'artifact_hash',
        type: 'string',
        required: true,
        description: 'SHA-256 hash of the file content.',
      },
      {
        field: 'top_level_key_count',
        type: 'number',
        required: true,
        minimum: 1,
        description: 'The JSON must have at least one top-level key.',
      },
      {
        field: 'has_version_key',
        type: 'boolean',
        required: true,
        expected: true,
        description: 'The JSON must contain a "version" key.',
      },
    ],
  };
}

/**
 * Read a real file from disk and extract structural evidence.
 * No mocks. Real hashes. Real sizes. Real structure.
 */
function extractGenesisEvidence(sourcePath) {
  const fullPath = path.resolve(process.cwd(), sourcePath);

  // Does the file exist?
  if (!fs.existsSync(fullPath)) {
    return {
      source_exists: false,
      json_parseable: false,
      byte_size: 0,
      artifact_hash: null,
      top_level_key_count: 0,
      has_version_key: false,
    };
  }

  const content = fs.readFileSync(fullPath);
  const hash = 'sha256:' + crypto.createHash('sha256').update(content).digest('hex');
  const byteSize = content.length;

  // Can it be parsed as JSON?
  let parsed = null;
  let parseable = false;
  try {
    parsed = JSON.parse(content.toString('utf8'));
    parseable = true;
  } catch (e) {
    // Not valid JSON
  }

  return {
    source_exists: true,
    json_parseable: parseable,
    byte_size: byteSize,
    artifact_hash: hash,
    top_level_key_count: parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.keys(parsed).length
      : 0,
    has_version_key: parsed && typeof parsed === 'object' && ('version' in parsed || (parsed.payload && typeof parsed.payload === 'object' && 'version' in parsed.payload)),
  };
}

// ══════════════════════════════════════════
// Commands
// ══════════════════════════════════════════

// ── px init ──────────────────────────────

function cmdInit(args) {
  const demo = args.includes('--demo');
  const genesis = args.includes('--genesis');

  heading(genesis
    ? 'Initializing PX Genesis workspace...'
    : demo
    ? 'Initializing PX demo workspace...'
    : 'Initializing PX workspace...');

  // Check if workspace already exists
  if (fileExists(pxRoot())) {
    fail(`Workspace already exists at ${relativePx()}`);
    log(`  Run from a different directory, or remove the existing workspace.`);
    log();
    process.exit(1);
  }

  // Create directory structure
  ensureDir(pxPath(PROFILES_DIR));
  ensureDir(pxPath(EVIDENCE_DIR));
  ensureDir(pxPath(OUTPUT_DIR));
  success(`Created ${relativePx()}`);
  success(`Created ${relativePx(PROFILES_DIR)}`);
  success(`Created ${relativePx(EVIDENCE_DIR)}`);
  success(`Created ${relativePx(OUTPUT_DIR)}`);

  if (genesis) {
    // Genesis mode: PX verifies itself
    const config = genesisConfig();
    writeJSON(pxPath(CONFIG_FILE), config);
    success(`Created ${relativePx(CONFIG_FILE)}`);
    info(`  Project: ${config.project}`);
    info(`  Framework: ${config.target_framework}`);

    // Check that v1/ directory exists
    const v1Dir = path.resolve(process.cwd(), 'v1');
    if (!fileExists(v1Dir)) {
      log();
      warn(`Directory ./v1/ not found.`);
      info(`Genesis mode expects governance files in ./v1/`);
      info(`Run this command from the PX repository root.`);
    }

    // Write 5 genesis profiles
    for (const target of GENESIS_TARGETS) {
      const profile = genesisProfile(target);
      const fileName = `${target.id}.json`;
      writeJSON(pxPath(PROFILES_DIR, fileName), profile);
      const ruleCount = profile.rules.length;
      success(`Created ${relativePx(PROFILES_DIR, fileName)} ${dimText(`(${ruleCount} rules, target: ${target.file})`)}`);
    }

    log();
    info(`Genesis workspace ready. ${GENESIS_TARGETS.length} profiles targeting ./v1/ governance files.`);

  } else if (demo) {
    // Write config
    const config = demoConfig();
    writeJSON(pxPath(CONFIG_FILE), config);
    success(`Created ${relativePx(CONFIG_FILE)}`);
    info(`  Project: ${config.project}`);
    info(`  Framework: ${config.target_framework}`);

    // Write profiles
    const profiles = demoProfiles();
    for (const [name, profile] of Object.entries(profiles)) {
      const fileName = `${name}.json`;
      writeJSON(pxPath(PROFILES_DIR, fileName), profile);
      const ruleCount = profile.rules.length;
      success(`Created ${relativePx(PROFILES_DIR, fileName)} ${dimText(`(${ruleCount} rules)`)}`);
    }

    log();
    info(`Demo workspace ready with ${Object.keys(profiles).length} SOC 2 profiles.`);
  } else {
    // Write minimal config
    const config = {
      px_version: VERSION,
      project: path.basename(process.cwd()),
      target_framework: null,
      created_at: new Date().toISOString(),
      evidence_dir: EVIDENCE_DIR,
      output_dir: OUTPUT_DIR,
      profiles: [],
    };
    writeJSON(pxPath(CONFIG_FILE), config);
    success(`Created ${relativePx(CONFIG_FILE)}`);
    log();
    info('Empty workspace created.');
    info(`Add profiles to ${relativePx(PROFILES_DIR)} to get started.`);
    info('Or run: px init --demo (SOC 2 sample) or px init --genesis (self-verification)');
  }

  log();
  log(`  ${CLR.bold}Next step:${CLR.reset} run ${CLR.cyan}px generate${CLR.reset}`);
  log();
}

// ══════════════════════════════════════════
// Demo evidence data
// ══════════════════════════════════════════

function demoEvidenceData() {
  // 3 profiles pass cleanly. patch-management has 1 deliberate failure
  // (outstanding_critical_patches = 2, violating maximum: 0).
  // This makes the demo realistic — real systems have findings.
  return {
    'soc2-access-control': {
      mfa_enforced: true,
      password_min_length: 14,
      idle_session_timeout_minutes: 15,
      admin_accounts: ['ops-admin', 'cto'],
      rbac_enabled: true,
      service_account_rotation_days: 60,
    },
    'soc2-encryption': {
      encryption_at_rest: 'AES-256-GCM',
      encryption_in_transit: 'TLS-1.3',
      key_management_service: 'AWS KMS (us-east-1)',
      key_rotation_days: 180,
    },
    'soc2-patch-management': {
      critical_patch_sla_hours: 48,
      high_patch_sla_days: 10,
      auto_update_enabled: true,
      outstanding_critical_patches: 2,   // ← deliberate failure
      last_scan_days_ago: 3,
      dependency_audit_enabled: true,
    },
    'soc2-monitoring': {
      centralized_logging: true,
      log_retention_days: 180,
      alerting_enabled: true,
      intrusion_detection: true,
      uptime_monitoring: true,
      alert_response_sla_minutes: 30,
      security_dashboard: true,
      log_tampering_protection: true,
      incident_runbook_exists: true,
    },
  };
}

// ══════════════════════════════════════════
// Evidence file builder
// ══════════════════════════════════════════

function buildEvidenceFile(profileId, data, config) {
  const now = new Date();
  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const evidenceContent = JSON.stringify(data);

  return {
    evidence_id: `ev-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${profileId}`,
    profile_ref: profileId,
    generator: `px-cli/${VERSION}`,
    collected_at: now.toISOString(),
    collection_window: {
      from: monthAgo.toISOString(),
      to: now.toISOString(),
    },
    evidence_class: profileId.replace(/^soc2-/, '').replace(/^px-/, ''),
    data: data,
    artifact_hash: 'sha256:' + crypto.createHash('sha256').update(evidenceContent).digest('hex'),
    verification_state: 'UNVERIFIED',
    verification_result: null,
  };
}

// ── px generate ──────────────────────────

function cmdGenerate(args) {
  heading('Generating evidence...');

  // Guard: workspace must exist
  if (!fileExists(pxRoot())) {
    fail('No PX workspace found.');
    info(`Run ${CLR.cyan}px init --demo${CLR.reset} first.`);
    log();
    process.exit(1);
  }

  const config = readJSON(pxPath(CONFIG_FILE));

  // Guard: must have profiles
  const profileFiles = fs.readdirSync(pxPath(PROFILES_DIR))
    .filter(f => f.endsWith('.json'));

  if (profileFiles.length === 0) {
    fail('No profiles found.');
    info(`Add profiles to ${relativePx(PROFILES_DIR)} or run ${CLR.cyan}px init --demo${CLR.reset}.`);
    log();
    process.exit(1);
  }

  // Guard: evidence already exists?
  const existingEvidence = fs.readdirSync(pxPath(EVIDENCE_DIR))
    .filter(f => f.endsWith('.evidence.json'));
  if (existingEvidence.length > 0 && !args.includes('--force')) {
    warn(`Evidence already exists (${existingEvidence.length} file(s)).`);
    info(`Run with ${CLR.cyan}--force${CLR.reset} to regenerate.`);
    log();
    process.exit(1);
  }

  // Load demo data or generate from profiles
  const isGenesis = config.mode === 'genesis';
  const demoData = isGenesis ? null : demoEvidenceData();

  if (isGenesis) {
    info('Genesis mode: reading real files from ./v1/');
    log();
  }

  // Generate evidence for each profile
  let generated = 0;
  for (const profileFile of profileFiles) {
    const profile = readJSON(pxPath(PROFILES_DIR, profileFile));
    const profileId = profile.profile_id;

    let data;
    if (isGenesis && profile.source_path) {
      // Genesis: extract real evidence from actual governance files
      data = extractGenesisEvidence(profile.source_path);
      if (!data.source_exists) {
        warn(`Source not found: ${profile.source_path}`);
      }
    } else if (demoData && demoData[profileId]) {
      // Demo: use pre-defined sample data
      data = demoData[profileId];
    } else {
      // Empty scaffold from profile rules
      data = {};
      for (const rule of profile.rules) {
        data[rule.field] = null;
      }
    }

    const evidence = buildEvidenceFile(profileId, data, config);
    const fileName = `${profile.evidence_class || profileId}.evidence.json`;
    writeJSON(pxPath(EVIDENCE_DIR, fileName), evidence);

    const fieldCount = Object.keys(data).length;
    success(`Generated ${relativePx(EVIDENCE_DIR, fileName)} ${dimText(`(${fieldCount} fields)`)}`);
    generated++;
  }

  log();
  info(`${generated} evidence file(s) generated.`);
  log();
  log(`  ${CLR.bold}Next step:${CLR.reset} run ${CLR.cyan}px verify${CLR.reset}`);
  log();
}

// ══════════════════════════════════════════
// Custom profile verification engine
// ══════════════════════════════════════════

/**
 * Parse --key=value flags from args array.
 */
function parseFlags(args) {
  const flags = {};
  for (const arg of args) {
    const m = arg.match(/^--([^=]+)=(.+)$/);
    if (m) flags[m[1]] = m[2];
  }
  return flags;
}

/**
 * Resolve a dot-notation path against a nested object.
 * e.g. resolveDotPath(obj, "iam.password_policy.minimum_length")
 * Returns undefined if any segment is missing.
 */
function resolveDotPath(obj, dotPath) {
  const segments = dotPath.split('.');
  let current = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = current[seg];
  }
  return current;
}

/**
 * Verify a single custom-profile rule against an evidence value.
 * Operators: eq (default), gte, lte.
 * Returns { pass: boolean, reason: string }
 */
function verifyCustomRule(value, rule) {
  if (value === undefined || value === null) {
    return { pass: false, reason: `path "${rule.path}" not found in evidence` };
  }

  const op = rule.operator || 'eq';

  if (op === 'eq') {
    if (value === rule.expected) {
      return { pass: true, reason: 'ok' };
    }
    return { pass: false, reason: `got: ${JSON.stringify(value)}, expected: ${JSON.stringify(rule.expected)}` };
  }

  if (op === 'gte') {
    if (typeof value !== 'number') {
      return { pass: false, reason: `expected number for gte, got ${typeof value}` };
    }
    if (value >= rule.expected) {
      return { pass: true, reason: 'ok' };
    }
    return { pass: false, reason: `got: ${value}, expected: >= ${rule.expected}` };
  }

  if (op === 'lte') {
    if (typeof value !== 'number') {
      return { pass: false, reason: `expected number for lte, got ${typeof value}` };
    }
    if (value <= rule.expected) {
      return { pass: true, reason: 'ok' };
    }
    return { pass: false, reason: `got: ${value}, expected: <= ${rule.expected}` };
  }

  return { pass: false, reason: `unknown operator: ${op}` };
}

/**
 * Run custom profile verification.
 * Returns { passed: number, failed: number, total: number, results: [] }
 */
function runCustomVerify(profileData, evidenceData) {
  const results = [];

  for (const rule of profileData.rules) {
    const value = resolveDotPath(evidenceData, rule.path);
    const check = verifyCustomRule(value, rule);

    results.push({
      id: rule.id,
      description: rule.description,
      path: rule.path,
      value,
      pass: check.pass,
      reason: check.reason,
    });
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return { passed, failed, total: results.length, results };
}

/**
 * Print custom verification results to terminal.
 * Returns true if all passed.
 */
function printCustomVerifyResults(result, profileData) {
  log();
  log(`  ${CLR.bold}Profile:${CLR.reset} ${profileData.name || profileData.profile_id}`);
  log(`  ${CLR.bold}Version:${CLR.reset} ${profileData.profile_version}`);
  log();

  // Find max id length for alignment
  const maxLen = Math.max(...result.results.map(r => r.id.length));

  for (const r of result.results) {
    const padded = r.id.padEnd(maxLen + 2);
    if (r.pass) {
      log(`  ${CLR.green}✓${CLR.reset} Checking ${padded} ${CLR.green}PASS${CLR.reset}`);
    } else {
      log(`  ${CLR.red}✗${CLR.reset} Checking ${padded} ${CLR.red}FAIL${CLR.reset}  ${CLR.dim}(${r.reason})${CLR.reset}`);
    }
  }

  log();
  if (result.failed === 0) {
    log(`  ${CLR.bold}${CLR.green}■ ALL PASS${CLR.reset} — ${result.passed}/${result.total} rules verified`);
  } else {
    log(`  ${CLR.bold}${CLR.red}■ FAILED${CLR.reset} — ${result.passed}/${result.total} rules passed, ${result.failed} failed`);
  }
  log();

  return result.failed === 0;
}

// ══════════════════════════════════════════
// Workspace verification engine (Genesis / Demo)
// ══════════════════════════════════════════

/**
 * Verify a single field value against a rule.
 * Returns { pass: boolean, reason: string }
 */
function verifyField(value, rule) {
  // Required check
  if (rule.required && (value === null || value === undefined)) {
    return { pass: false, reason: 'missing (required)' };
  }

  // If not required and absent, skip
  if (value === null || value === undefined) {
    return { pass: true, reason: 'not present (optional)' };
  }

  // Type check
  if (rule.type === 'boolean') {
    if (typeof value !== 'boolean') {
      return { pass: false, reason: `expected boolean, got ${typeof value}` };
    }
    if (rule.expected !== undefined && value !== rule.expected) {
      return { pass: false, reason: `expected ${rule.expected}, got ${value}` };
    }
  }

  if (rule.type === 'number') {
    if (typeof value !== 'number') {
      return { pass: false, reason: `expected number, got ${typeof value}` };
    }
    if (rule.minimum !== undefined && value < rule.minimum) {
      return { pass: false, reason: `value ${value} is below minimum ${rule.minimum}` };
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      return { pass: false, reason: `value ${value} exceeds maximum ${rule.maximum}` };
    }
  }

  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      return { pass: false, reason: `expected string, got ${typeof value}` };
    }
    if (value.trim() === '') {
      return { pass: false, reason: 'empty string' };
    }
    if (rule.allowed && !rule.allowed.includes(value)) {
      return { pass: false, reason: `"${value}" not in allowed values [${rule.allowed.join(', ')}]` };
    }
  }

  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      return { pass: false, reason: `expected array, got ${typeof value}` };
    }
    if (rule.max_items !== undefined && value.length > rule.max_items) {
      return { pass: false, reason: `${value.length} items exceeds max ${rule.max_items}` };
    }
  }

  return { pass: true, reason: 'ok' };
}

/**
 * Verify evidence data against a profile's rules.
 * Returns { profile_id, results[], passed, failed, total }
 */
function verifyEvidence(evidence, profile) {
  const results = [];

  for (const rule of profile.rules) {
    const value = evidence.data[rule.field];
    const check = verifyField(value, rule);

    results.push({
      field: rule.field,
      value: value,
      pass: check.pass,
      reason: check.reason,
      description: rule.description,
    });
  }

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return {
    profile_id: profile.profile_id,
    category: profile.category,
    results,
    passed,
    failed,
    total: results.length,
  };
}

// ── px verify ────────────────────────────

function cmdVerify(args) {
  const flags = parseFlags(args);

  // ── Custom profile mode: --profile + --evidence ──
  if (flags.profile && flags.evidence) {
    heading('Verifying evidence against custom profile...');

    const profilePath = path.resolve(process.cwd(), flags.profile);
    const evidencePath = path.resolve(process.cwd(), flags.evidence);

    if (!fileExists(profilePath)) {
      fail(`Profile not found: ${flags.profile}`);
      log();
      process.exit(1);
    }
    if (!fileExists(evidencePath)) {
      fail(`Evidence not found: ${flags.evidence}`);
      log();
      process.exit(1);
    }

    const profileData = readJSON(profilePath);
    const evidenceData = readJSON(evidencePath);

    if (!profileData.rules || !Array.isArray(profileData.rules)) {
      fail('Profile has no rules array.');
      log();
      process.exit(1);
    }

    const result = runCustomVerify(profileData, evidenceData);
    const allPass = printCustomVerifyResults(result, profileData);

    if (!allPass) {
      info('Pack not generated.');
      log();
    }
    process.exit(allPass ? 0 : 1);
  }

  if (flags.profile || flags.evidence) {
    fail('Both --profile and --evidence are required for custom verification.');
    log();
    process.exit(1);
  }

  // ── Workspace mode (Genesis / Demo) ──
  heading('Verifying evidence against profiles...');

  // Guard: workspace must exist
  if (!fileExists(pxRoot())) {
    fail('No PX workspace found.');
    info(`Run ${CLR.cyan}px init --demo${CLR.reset} first.`);
    log();
    process.exit(1);
  }

  // Guard: evidence must exist
  const evidenceFiles = fs.readdirSync(pxPath(EVIDENCE_DIR))
    .filter(f => f.endsWith('.evidence.json'));

  if (evidenceFiles.length === 0) {
    fail('No evidence found.');
    info(`Run ${CLR.cyan}px generate${CLR.reset} first.`);
    log();
    process.exit(1);
  }

  // Load all profiles into a map by profile_id
  const profileFiles = fs.readdirSync(pxPath(PROFILES_DIR))
    .filter(f => f.endsWith('.json'));
  const profileMap = {};
  for (const pf of profileFiles) {
    const profile = readJSON(pxPath(PROFILES_DIR, pf));
    profileMap[profile.profile_id] = profile;
  }

  // Verify each evidence file
  const allResults = [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalFields = 0;

  for (const ef of evidenceFiles) {
    const evidence = readJSON(pxPath(EVIDENCE_DIR, ef));
    const profile = profileMap[evidence.profile_ref];

    if (!profile) {
      warn(`No profile found for ${evidence.profile_ref} — skipping ${ef}`);
      continue;
    }

    const result = verifyEvidence(evidence, profile);
    allResults.push(result);

    // Print profile result
    const label = result.evidence_class || result.profile_id;
    const displayName = profile.profile_id.replace('soc2-', '');
    const padded = displayName.padEnd(22);

    if (result.failed === 0) {
      log(`  ${CLR.green}✓${CLR.reset} ${padded} ${CLR.green}PASS${CLR.reset}  ${dimText(`(${result.passed}/${result.total} fields)`)}`);
    } else {
      log(`  ${CLR.red}✗${CLR.reset} ${padded} ${CLR.red}FAIL${CLR.reset}  ${dimText(`(${result.passed}/${result.total} fields)`)}`);

      // Show failures
      for (const r of result.results) {
        if (!r.pass) {
          log(`    ${CLR.red}→${CLR.reset} ${CLR.dim}${r.field}${CLR.reset}: ${r.reason}`);
          log(`      ${dimText(r.description)}`);
        }
      }
    }

    totalPassed += result.passed;
    totalFailed += result.failed;
    totalFields += result.total;

    // Update evidence file with verification result
    evidence.verification_state = result.failed === 0 ? 'VERIFIED' : 'FAILED';
    evidence.verification_result = {
      verified_at: new Date().toISOString(),
      profile_id: profile.profile_id,
      profile_version: profile.profile_version,
      fields_checked: result.total,
      fields_passed: result.passed,
      fields_failed: result.failed,
      failures: result.results
        .filter(r => !r.pass)
        .map(r => ({ field: r.field, reason: r.reason })),
    };
    writeJSON(pxPath(EVIDENCE_DIR, ef), evidence);
  }

  // Summary
  log();
  const profilesPassed = allResults.filter(r => r.failed === 0).length;
  const profilesFailed = allResults.filter(r => r.failed > 0).length;

  if (totalFailed === 0) {
    log(`  ${CLR.bold}Result:${CLR.reset} ${CLR.green}ALL PASS${CLR.reset}`);
    log(`  ${CLR.bold}Fields:${CLR.reset} ${totalPassed}/${totalFields}`);
    log(`  ${CLR.bold}State:${CLR.reset}  ${CLR.yellow}DRAFT${CLR.reset} (internal only)`);
  } else {
    log(`  ${CLR.bold}Result:${CLR.reset} ${CLR.red}${totalFailed} FAILURE(S)${CLR.reset}`);
    log(`  ${CLR.bold}Fields:${CLR.reset} ${totalPassed} passed, ${totalFailed} failed, ${totalFields} total`);
    log(`  ${CLR.bold}Profiles:${CLR.reset} ${profilesPassed} passed, ${profilesFailed} failed`);
    log(`  ${CLR.bold}State:${CLR.reset}  ${CLR.red}DRAFT (incomplete)${CLR.reset}`);
    log();
    info('Fix the failures above, then run px verify again.');
  }

  log();
  if (totalFailed === 0) {
    log(`  ${CLR.bold}Next step:${CLR.reset} run ${CLR.cyan}px pack${CLR.reset}`);
  }
  log();
}

// ── px pack ──────────────────────────────

function cmdPack(args) {
  const flags = parseFlags(args);

  // ── Custom profile mode: --profile + --evidence ──
  if (flags.profile && flags.evidence) {
    heading('Packing custom evidence...');

    const profilePath = path.resolve(process.cwd(), flags.profile);
    const evidencePath = path.resolve(process.cwd(), flags.evidence);

    if (!fileExists(profilePath)) {
      fail(`Profile not found: ${flags.profile}`);
      log();
      process.exit(1);
    }
    if (!fileExists(evidencePath)) {
      fail(`Evidence not found: ${flags.evidence}`);
      log();
      process.exit(1);
    }

    const profileData = readJSON(profilePath);
    const evidenceData = readJSON(evidencePath);

    if (!profileData.rules || !Array.isArray(profileData.rules)) {
      fail('Profile has no rules array.');
      log();
      process.exit(1);
    }

    // ── FAIL-CLOSE: verify first ──
    const result = runCustomVerify(profileData, evidenceData);
    const allPass = printCustomVerifyResults(result, profileData);

    if (!allPass) {
      fail('FAIL-CLOSE: Cannot pack evidence with failing rules.');
      info('Pack not generated.');
      log();
      process.exit(1);
    }

    // ── All rules pass. Build packet. ──
    const now = new Date();
    const packetId = `draft-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-4)}`;
    const manifestRef = `mf-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-4)}`;

    const profileContent = fs.readFileSync(profilePath);
    const evidenceContent = fs.readFileSync(evidencePath);
    const profileHash = 'sha256:' + crypto.createHash('sha256').update(profileContent).digest('hex');
    const evidenceHash = 'sha256:' + crypto.createHash('sha256').update(evidenceContent).digest('hex');

    const evidenceRefs = [{
      evidence_id: `ev-${now.toISOString().slice(0, 10).replace(/-/g, '')}-custom`,
      evidence_class: profileData.profile_id,
      profile_ref: profileData.profile_id,
      profile_hash: profileHash,
      artifact_hash: evidenceHash,
      schema_conformance: 'PASS',
      fields_checked: result.total,
      fields_passed: result.passed,
      verified_at: now.toISOString(),
    }];

    const packet = {
      packet_type: 'DRAFT',
      packet_id: packetId,
      created_at: now.toISOString(),
      generator: `px-cli/${VERSION}`,
      project: profileData.profile_id,
      framework: 'CUSTOM_PROFILE',
      evidence_count: evidenceRefs.length,
      verification_result: 'ALL_PASS',
      submission_state: 'NOT_SUBMITTED',
      evidence_refs: evidenceRefs,
    };

    const packetContent = JSON.stringify(packet);
    const packetHash = 'sha256:' + crypto.createHash('sha256').update(packetContent).digest('hex');

    const manifest = {
      manifest_type: 'DRAFT_MANIFEST',
      manifest_ref: manifestRef,
      packet_ref: packetId,
      created_at: now.toISOString(),
      generator: `px-cli/${VERSION}`,
      project: profileData.profile_id,
      framework: 'CUSTOM_PROFILE',
      evidence_summary: {
        total: evidenceRefs.length,
        passed: evidenceRefs.length,
        failed: 0,
        profiles: evidenceRefs.map(e => ({
          profile_ref: e.profile_ref,
          evidence_class: e.evidence_class,
          fields_checked: e.fields_checked,
          fields_passed: e.fields_passed,
          conformance: 'PASS',
        })),
      },
      packet_hash: packetHash,
      submission_state: 'NOT_SUBMITTED',
      submission_id: null,
      sct: null,
      acceptance_receipt: null,
      recipient_binding: null,
      parent_manifest_refs: [],
      clearing_batch_ref: null,
    };

    // Write to output directory beside the evidence file
    const outputDir = path.dirname(evidencePath);
    writeJSON(path.join(outputDir, 'draft-manifest.json'), manifest);
    success(`Created ${path.join(path.relative(process.cwd(), outputDir), 'draft-manifest.json')}`);

    writeJSON(path.join(outputDir, 'draft-packet.json'), packet);
    success(`Created ${path.join(path.relative(process.cwd(), outputDir), 'draft-packet.json')}`);

    log();
    info(`Packet ID:  ${packetId}`);
    info(`Evidence:   ${result.total} rules, all verified`);
    info(`Hash:       ${packetHash.slice(0, 20)}...`);
    log();
    log(`  ${CLR.bold}${CLR.green}Your proof is ready for internal review.${CLR.reset}`);
    log(`  ${CLR.dim}Open draft-manifest.json in Lens to see your verification badge.${CLR.reset}`);
    log();
    process.exit(0);
  }

  if (flags.profile || flags.evidence) {
    fail('Both --profile and --evidence are required for custom packing.');
    log();
    process.exit(1);
  }

  // ── Workspace mode (Genesis / Demo) ──
  heading('Creating Draft Packet...');

  // ── Guard: workspace ──
  if (!fileExists(pxRoot())) {
    fail('No PX workspace found.');
    info(`Run ${CLR.cyan}px init --demo${CLR.reset} first.`);
    log();
    process.exit(1);
  }

  const config = readJSON(pxPath(CONFIG_FILE));

  // ── Guard: evidence must exist ──
  const evidenceFiles = fs.readdirSync(pxPath(EVIDENCE_DIR))
    .filter(f => f.endsWith('.evidence.json'));

  if (evidenceFiles.length === 0) {
    fail('No evidence found.');
    info(`Run ${CLR.cyan}px generate${CLR.reset} first.`);
    log();
    process.exit(1);
  }

  // ── FAIL-CLOSE: every evidence file must be VERIFIED ──
  // This is not a suggestion. If any evidence is unverified or failed,
  // packing is physically blocked. No partial packs. No "good enough."

  const evidenceSet = [];
  const unverified = [];
  const failed = [];

  for (const ef of evidenceFiles) {
    const evidence = readJSON(pxPath(EVIDENCE_DIR, ef));
    evidenceSet.push({ file: ef, evidence });

    if (evidence.verification_state === 'UNVERIFIED' || !evidence.verification_result) {
      unverified.push(ef);
    } else if (evidence.verification_state === 'FAILED') {
      failed.push({
        file: ef,
        failures: (evidence.verification_result.failures || [])
          .map(f => `${f.field}: ${f.reason}`),
      });
    }
  }

  if (unverified.length > 0) {
    fail('FAIL-CLOSE: Unverified evidence cannot be packed.');
    log();
    for (const uf of unverified) {
      log(`    ${CLR.yellow}?${CLR.reset} ${uf}`);
    }
    log();
    info(`Run ${CLR.cyan}px verify${CLR.reset} before packing.`);
    log();
    process.exit(1);
  }

  if (failed.length > 0) {
    fail('FAIL-CLOSE: Evidence with failures cannot be packed.');
    log();
    for (const ff of failed) {
      log(`    ${CLR.red}✗${CLR.reset} ${ff.file}`);
      for (const reason of ff.failures) {
        log(`      ${CLR.dim}${reason}${CLR.reset}`);
      }
    }
    log();
    info('Fix the failures, run px verify, then px pack.');
    log();
    process.exit(1);
  }

  // ── All evidence verified. Build packet. ──

  const now = new Date();
  const packetId = `draft-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-4)}`;
  const manifestRef = `mf-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${String(now.getTime()).slice(-4)}`;

  // Build evidence refs with hashes
  const evidenceRefs = evidenceSet.map(({ file, evidence }) => ({
    evidence_id: evidence.evidence_id,
    evidence_class: evidence.evidence_class,
    profile_ref: evidence.profile_ref,
    artifact_hash: evidence.artifact_hash,
    schema_conformance: 'PASS',
    fields_checked: evidence.verification_result.fields_checked,
    fields_passed: evidence.verification_result.fields_passed,
    verified_at: evidence.verification_result.verified_at,
  }));

  // ── draft-packet.json ──
  const packet = {
    packet_type: 'DRAFT',
    packet_id: packetId,
    created_at: now.toISOString(),
    generator: `px-cli/${VERSION}`,
    project: config.project,
    framework: config.target_framework,
    evidence_count: evidenceRefs.length,
    verification_result: 'ALL_PASS',
    submission_state: 'NOT_SUBMITTED',
    evidence_refs: evidenceRefs,
  };

  const packetContent = JSON.stringify(packet);
  const packetHash = 'sha256:' + crypto.createHash('sha256').update(packetContent).digest('hex');

  // ── draft-manifest.json ──
  // The manifest is what Lens reads. It is also what would become
  // the Submission manifest once SCT and receipt are added.
  // The null fields are the structural boundary between Draft and Submission.
  const manifest = {
    manifest_type: 'DRAFT_MANIFEST',
    manifest_ref: manifestRef,
    packet_ref: packetId,
    created_at: now.toISOString(),
    generator: `px-cli/${VERSION}`,
    project: config.project,
    framework: config.target_framework,
    evidence_summary: {
      total: evidenceRefs.length,
      passed: evidenceRefs.length,
      failed: 0,
      profiles: evidenceRefs.map(e => ({
        profile_ref: e.profile_ref,
        evidence_class: e.evidence_class,
        fields_checked: e.fields_checked,
        fields_passed: e.fields_passed,
        conformance: 'PASS',
      })),
    },
    packet_hash: packetHash,

    // ═══════════════════════════════════════════════════════
    // THE BOUNDARY.
    //
    // These four fields are null in every Draft.
    // They are populated only in a Submission.
    //
    // sct:                  Sealed Certificate Timestamp.
    //                       Proves this packet existed at a specific time.
    //                       Signed by PX Authority with the production root key.
    //
    // acceptance_receipt:   Proof that the submission was received and recorded.
    //                       Contains packet_hash + sct + recipient_ref.
    //
    // recipient_binding:    Who this submission is directed to.
    //                       Prevents repurposing a submission across recipients.
    //
    // submission_id:        Unique, immutable identifier from PX Authority.
    //
    // Until these are populated, this manifest is DRAFT.
    // It can be reviewed internally. It cannot be handed off externally.
    // ═══════════════════════════════════════════════════════
    submission_state: 'NOT_SUBMITTED',
    submission_id: null,
    sct: null,
    acceptance_receipt: null,
    recipient_binding: null,

    // Future Clearing compatibility
    parent_manifest_refs: [],
    clearing_batch_ref: null,
  };

  // ── README.md ──
  const readme = `# PX Draft Packet

**Packet ID:** ${packetId}
**Created:** ${now.toISOString()}
**Project:** ${config.project}
**Framework:** ${config.target_framework || 'Not specified'}

## What's in this packet

| File | Purpose |
|------|---------|
| draft-packet.json | The evidence pack. Contains references and hashes for all verified evidence. |
| draft-manifest.json | The manifest. This is what Lens reads. Contains the verification summary. |
| README.md | This file. |

## Status

**Verification:** ALL PASS (${evidenceRefs.length} evidence files, ${evidenceRefs.reduce((a, e) => a + e.fields_checked, 0)} fields checked)
**Submission:** NOT SUBMITTED

## What this packet can do

- Be reviewed internally by your team
- Be loaded into Lens (open draft-manifest.json)
- Be shared with colleagues for pre-submission review
- Be re-verified at any time with \`px verify\`

## What this packet cannot do

This is a Draft Packet. It is verified locally, but it is not externally acceptable.

External acceptance requires a **Submission**, which adds:

- **Submission ID** — a unique, immutable identifier from PX Authority
- **Sealed timestamp (SCT)** — cryptographic proof this packet existed at a specific time
- **Acceptance receipt** — proof the submission was received and recorded
- **Recipient binding** — specifies who this submission is directed to

These fields are present in the manifest as \`null\`. When a Submission is created,
they are populated by PX Authority using the production root key.

**Submission is not yet available.** It requires PX production authority (in progress).
Draft is fully functional for internal use today.

---

*PX makes proof you can hand off.*
*Draft is where your team standardizes how it explains itself.*
*Submission is where that explanation becomes externally acceptable.*
`;

  // ── Write files ──
  ensureDir(pxPath(OUTPUT_DIR));

  writeJSON(pxPath(OUTPUT_DIR, 'draft-packet.json'), packet);
  success(`Created ${relativePx(OUTPUT_DIR, 'draft-packet.json')}`);

  writeJSON(pxPath(OUTPUT_DIR, 'draft-manifest.json'), manifest);
  success(`Created ${relativePx(OUTPUT_DIR, 'draft-manifest.json')}`);

  fs.writeFileSync(pxPath(OUTPUT_DIR, 'README.md'), readme);
  success(`Created ${relativePx(OUTPUT_DIR, 'README.md')}`);

  // ── Summary ──
  log();
  log(`  ${CLR.bold}Draft Packet created.${CLR.reset}`);
  log();
  info(`Packet ID:  ${packetId}`);
  info(`Evidence:   ${evidenceRefs.length} files, all verified`);
  info(`Fields:     ${evidenceRefs.reduce((a, e) => a + e.fields_checked, 0)} checked, all passed`);
  info(`Hash:       ${packetHash.slice(0, 20)}...`);
  log();

  // ── The Trojan Horse ──
  // This message is the most important thing in the entire CLI.
  // It's the moment where a free tool plants the seed of paid Submission.
  // Not by nagging. By showing what's missing.
  log(`  ${CLR.bold}${CLR.green}Your proof is ready for internal review.${CLR.reset}`);
  log();
  log(`  ${CLR.dim}Open ${CLR.reset}draft-manifest.json${CLR.dim} in Lens to see your verification badge.${CLR.reset}`);
  log(`  ${CLR.dim}Lens will show ${CLR.yellow}amber${CLR.dim} (internal) — not green.${CLR.reset}`);
  log();
  log(`  ${CLR.dim}To make this proof externally acceptable, you'll need a Submission.${CLR.reset}`);
  log(`  ${CLR.dim}Submission adds a sealed timestamp, acceptance receipt, and recipient binding.${CLR.reset}`);
  log(`  ${CLR.dim}These fields are present in the manifest as null — ready to be filled.${CLR.reset}`);
  log();
  log(`  ${CLR.dim}Submission is coming soon.${CLR.reset}`);
  log(`  ${CLR.dim}Your Draft is complete and fully usable internally right now.${CLR.reset}`);
  log();
}

// ── px status ────────────────────────────

function cmdStatus(args) {
  heading('PX Workspace Status');

  if (!fileExists(pxRoot())) {
    warn('No PX workspace found in current directory.');
    info('Run: px init --demo');
    log();
    return;
  }

  if (!fileExists(pxPath(CONFIG_FILE))) {
    fail('Workspace exists but px.config.json is missing.');
    log();
    return;
  }

  const config = readJSON(pxPath(CONFIG_FILE));

  info(`Project:   ${config.project || '(unnamed)'}`);
  info(`Framework: ${config.target_framework || '(none)'}`);
  info(`PX version: ${config.px_version || '(unknown)'}`);
  info(`Created:   ${config.created_at || '(unknown)'}`);

  // Count profiles
  const profilesPath = pxPath(PROFILES_DIR);
  let profileCount = 0;
  if (fileExists(profilesPath)) {
    profileCount = fs.readdirSync(profilesPath)
      .filter(f => f.endsWith('.json')).length;
  }
  info(`Profiles:  ${profileCount}`);

  // Count evidence
  const evidencePath = pxPath(EVIDENCE_DIR);
  let evidenceCount = 0;
  if (fileExists(evidencePath)) {
    evidenceCount = fs.readdirSync(evidencePath)
      .filter(f => f.endsWith('.json')).length;
  }
  info(`Evidence:  ${evidenceCount}`);

  // Count output
  const outputPath = pxPath(OUTPUT_DIR);
  let packetCount = 0;
  if (fileExists(outputPath)) {
    packetCount = fs.readdirSync(outputPath)
      .filter(f => f.endsWith('.json')).length;
  }
  info(`Packets:   ${packetCount}`);

  // State
  log();
  if (evidenceCount === 0) {
    info(`State: ${CLR.yellow}INITIALIZED${CLR.reset} — no evidence generated yet.`);
    info(`Next:  run ${CLR.cyan}px generate${CLR.reset}`);
  } else if (packetCount === 0) {
    info(`State: ${CLR.yellow}EVIDENCE_PRESENT${CLR.reset} — not yet verified/packed.`);
    info(`Next:  run ${CLR.cyan}px verify${CLR.reset}`);
  } else {
    info(`State: ${CLR.green}DRAFT_PACKED${CLR.reset}`);
    info(`Next:  review your Draft Packet in ${relativePx(OUTPUT_DIR)}`);
  }

  log();
}

// ── help ─────────────────────────────────

function cmdHelp() {
  log();
  log(`  ${CLR.bold}PX${CLR.reset} ${dimText(`v${VERSION}`)}`);
  log(`  ${dimText('PX makes proof you can hand off.')}`);
  log();
  log(`  ${CLR.bold}Usage:${CLR.reset}  px <command> [options]`);
  log();
  log(`  ${CLR.bold}Commands:${CLR.reset}`);
  log(`    init              Create a PX workspace`);
  log(`    init --demo       Create a workspace with SOC 2 sample profiles`);
  log(`    init --genesis    Create a workspace that verifies PX's own governance files`);
  log(`    generate          Generate evidence from system state`);
  log(`    verify            Verify evidence against profiles`);
  log(`    pack              Create a Draft Packet`);
  log(`    status            Show workspace state`);
  log();
  log(`  ${CLR.bold}Custom Profiles:${CLR.reset}`);
  log(`    verify --profile=<file> --evidence=<file>   Verify evidence against a custom profile`);
  log(`    pack   --profile=<file> --evidence=<file>   Pack after custom verification`);
  log();
  log(`  ${CLR.bold}Examples:${CLR.reset}`);
  log(`    ${CLR.cyan}px init --demo${CLR.reset}     Set up a demo workspace and explore`);
  log(`    ${CLR.cyan}px init --genesis${CLR.reset}  Verify PX's own governance files`);
  log(`    ${CLR.cyan}px generate${CLR.reset}        Generate evidence (after init)`);
  log(`    ${CLR.cyan}px verify${CLR.reset}          Check evidence against rules`);
  log(`    ${CLR.cyan}px pack${CLR.reset}            Bundle into a Draft Packet`);
  log(`    ${CLR.cyan}px verify --profile=profiles/aws-core-controls-v1.json --evidence=my-state.json${CLR.reset}`);
  log();
  log(`  ${dimText('Draft is free. Submission is when it leaves the building.')}`);
  log();
}

// ══════════════════════════════════════════
// Command router
// ══════════════════════════════════════════

const COMMANDS = {
  'init':     cmdInit,
  'generate': cmdGenerate,
  'verify':   cmdVerify,
  'pack':     cmdPack,
  'status':   cmdStatus,
  'help':     cmdHelp,
  '--help':   cmdHelp,
  '-h':       cmdHelp,
  '--version': () => { log(`px ${VERSION}`); },
  '-v':       () => { log(`px ${VERSION}`); },
};

function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // No command → show help
  if (!command) {
    cmdHelp();
    return;
  }

  const handler = COMMANDS[command];

  if (!handler) {
    fail(`Unknown command: ${command}`);
    info('Run px --help to see available commands.');
    log();
    process.exit(1);
  }

  handler(args.slice(1));
}

main();
