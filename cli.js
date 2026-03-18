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
// Verification Seal
// ══════════════════════════════════════════

function generateSeal(evidenceHash, created, allPass, ruleCount) {
  // evidenceHash is "sha256:<hex>", extract hex part chars 8-11
  const hex = evidenceHash.replace(/^sha256:/, '');
  const hashPart = hex.substring(8, 12).toUpperCase();
  const date = new Date(created);
  const quarter = 'Q' + (Math.floor(date.getMonth() / 3) + 1);
  const timePart = date.getFullYear() + quarter;
  const resultPart = allPass ? 'PASS' : 'FAIL';
  return 'PX-' + hashPart + '-' + timePart + '-' + resultPart + '-' + ruleCount;
}

// ══════════════════════════════════════════
// Lens HTML template
// ══════════════════════════════════════════

const LENS_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PX Lens</title>
<style>
:root{--pass:#16a34a;--fail:#dc2626;--draft:#d97706;--bg:#fafafa;--fg:#111;--muted:#666;--border:#ddd;--card:#fff;--mono:"Consolas","Monaco","Courier New",monospace}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--fg);line-height:1.5;max-width:960px;margin:0 auto;padding:24px}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid var(--fg);padding-bottom:16px;margin-bottom:24px}
.logo{font-size:28px;font-weight:700;letter-spacing:-1px}
.seal{font-family:var(--mono);font-size:16px;background:var(--fg);color:var(--bg);padding:6px 14px;border-radius:4px;letter-spacing:1px}
.draft-badge{display:inline-block;background:var(--draft);color:#fff;font-size:12px;font-weight:600;padding:2px 10px;border-radius:3px;text-transform:uppercase;margin-left:12px}
.btn-export{background:var(--fg);color:var(--bg);border:none;padding:8px 20px;font-size:14px;cursor:pointer;border-radius:4px;margin-top:8px}
.btn-export:hover{opacity:.85}
nav{display:flex;gap:0;border-bottom:1px solid var(--border);margin-bottom:24px}
nav button{background:none;border:none;border-bottom:2px solid transparent;padding:10px 24px;font-size:14px;cursor:pointer;color:var(--muted);font-weight:500}
nav button.active{color:var(--fg);border-bottom-color:var(--fg);font-weight:600}
nav button:hover{color:var(--fg)}
section{display:none}
section.active{display:block}
.field{margin-bottom:10px}
.field-label{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600}
.field-value{font-size:15px;margin-top:2px}
.field-value.mono{font-family:var(--mono);font-size:13px;word-break:break-all}
.result-banner{padding:16px 20px;border-radius:6px;font-size:18px;font-weight:700;margin:20px 0}
.result-banner.pass{background:#dcfce7;color:var(--pass)}
.result-banner.fail{background:#fef2f2;color:var(--fail)}
.null-fields{background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:14px 18px;margin:16px 0;font-size:13px;color:#92400e}
.null-fields code{font-family:var(--mono);background:#fef9c3;padding:1px 4px;border-radius:2px}
.replay-indicator{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:4px;font-size:13px;font-weight:500;margin-top:12px}
.replay-indicator.ok{background:#dcfce7;color:var(--pass)}
.replay-indicator.warn{background:#fef2f2;color:var(--fail)}
.one-liner{font-size:13px;color:var(--muted);margin-top:16px;font-style:italic}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
th,td{text-align:left;padding:8px 12px;border-bottom:1px solid var(--border)}
th{font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:600}
td.pass-cell{color:var(--pass);font-weight:600}
td.fail-cell{color:var(--fail);font-weight:600}
.fail-detail{font-size:12px;color:var(--fail);font-family:var(--mono)}
.scope-note{font-size:12px;color:var(--muted);margin-top:16px;padding:10px 14px;background:#f5f5f5;border-radius:4px}
.trace{font-family:var(--mono);font-size:12px;background:#1e1e1e;color:#d4d4d4;padding:20px;border-radius:6px;overflow-x:auto;line-height:1.7;white-space:pre-wrap}
.trace .ts{color:#858585}
.trace .pass{color:#4ec9b0}
.trace .fail{color:#f44747}
.trace .dim{color:#858585}
.trace .label{color:#9cdcfe}
.cli-cmd{font-family:var(--mono);font-size:13px;background:#f5f5f5;padding:12px 16px;border-radius:4px;margin:12px 0;border:1px solid var(--border)}
.no-trust{font-size:13px;color:var(--muted);margin-top:16px;padding:12px 16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:4px}
footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);text-align:center}
@media print{
  body{max-width:100%;padding:0;font-size:11px}
  .btn-export,nav{display:none!important}
  section{display:block!important;page-break-before:always}
  section:first-of-type{page-break-before:avoid}
  header{page-break-after:avoid}
  .print-header{display:block;font-family:var(--mono);font-size:10px;color:var(--muted);text-align:right;margin-bottom:4px}
  .trace{background:#f5f5f5!important;color:#111!important;border:1px solid #ccc}
  .trace .ts,.trace .dim{color:#666!important}
  .trace .pass{color:var(--pass)!important}
  .trace .fail{color:var(--fail)!important}
  .result-banner.pass{border:2px solid var(--pass);background:#fff!important}
  .result-banner.fail{border:2px solid var(--fail);background:#fff!important}
  table{font-size:11px}
  th,td{padding:4px 8px;border:1px solid #ccc}
  footer{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;border-top:1px solid #ccc;padding:4px}
}
</style>
</head>
<body>
<header>
  <div>
    <span class="logo">PX Lens</span>
    <span class="draft-badge">Draft</span>
  </div>
  <div style="text-align:right">
    <div class="seal" id="seal"></div>
    <button class="btn-export" onclick="window.print()">Export PDF</button>
  </div>
</header>
<nav>
  <button class="active" data-tab="summary">Summary</button>
  <button data-tab="controls">Controls</button>
  <button data-tab="replay">Replay</button>
</nav>
<main>
  <section id="summary" class="active"></section>
  <section id="controls"></section>
  <section id="replay"></section>
</main>
<footer>Verification re-executed in your browser. No network used. No data leaves this page.</footer>
<script>
const MANIFEST=/*__MANIFEST__*/null;
const EVIDENCE=/*__EVIDENCE__*/null;
const PROFILE=/*__PROFILE__*/null;
const STORED_RESULTS=/*__RESULTS__*/null;

function resolveDotPath(obj,dotPath){
  var segs=dotPath.split('.');var cur=obj;
  for(var i=0;i<segs.length;i++){
    if(cur===null||cur===undefined||typeof cur!=='object')return undefined;
    cur=cur[segs[i]];
  }
  return cur;
}
function verifyRule(value,rule){
  if(value===undefined||value===null)return{pass:false,reason:'path "'+rule.path+'" not found in evidence'};
  var op=rule.operator||'eq';
  if(op==='eq')return value===rule.expected?{pass:true,reason:'ok'}:{pass:false,reason:'got: '+JSON.stringify(value)+', expected: '+JSON.stringify(rule.expected)};
  if(op==='gte'){if(typeof value!=='number')return{pass:false,reason:'expected number for gte, got '+typeof value};return value>=rule.expected?{pass:true,reason:'ok'}:{pass:false,reason:'got: '+value+', expected: >= '+rule.expected};}
  if(op==='lte'){if(typeof value!=='number')return{pass:false,reason:'expected number for lte, got '+typeof value};return value<=rule.expected?{pass:true,reason:'ok'}:{pass:false,reason:'got: '+value+', expected: <= '+rule.expected};}
  return{pass:false,reason:'unknown operator: '+op};
}
function runVerify(profile,evidence){
  var results=[];
  for(var i=0;i<profile.rules.length;i++){
    var rule=profile.rules[i];var value=resolveDotPath(evidence,rule.path);var check=verifyRule(value,rule);
    results.push({id:rule.id,description:rule.description||'',pass:check.pass,reason:check.reason,path:rule.path,expected:rule.expected,got:value});
  }
  return results;
}
async function sha256(text){
  var data=new TextEncoder().encode(text);
  var hash=await crypto.subtle.digest('SHA-256',data);
  return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
}

function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML;}

document.addEventListener('DOMContentLoaded',function(){
  if(!MANIFEST||!EVIDENCE||!PROFILE||!STORED_RESULTS){
    document.querySelector('main').innerHTML='<div style="padding:40px;text-align:center;color:var(--fail)"><h2>No data embedded</h2><p>This lens.html has no verification data. Generate it via <code>px pack</code>.</p></div>';
    return;
  }

  var seal=MANIFEST.seal||'';
  document.getElementById('seal').textContent=seal;

  var allPass=STORED_RESULTS.every(function(r){return r.pass});
  var passCount=STORED_RESULTS.filter(function(r){return r.pass}).length;
  var totalCount=STORED_RESULTS.length;

  // ── Summary ──
  var summaryHtml='<div class="print-header" style="display:none">PX Lens — Verification Report | '+esc(seal)+'</div>';
  summaryHtml+='<div class="result-banner '+(allPass?'pass':'fail')+'">'+(allPass?'ALL PASS':'FAILED')+' — '+passCount+'/'+totalCount+' rules verified</div>';
  summaryHtml+='<div class="field"><div class="field-label">Recipient</div><div class="field-value">'+esc(MANIFEST.intended_recipient||'Not specified')+'</div></div>';
  summaryHtml+='<div class="field"><div class="field-label">Purpose</div><div class="field-value">'+esc(MANIFEST.stated_purpose||'Not specified')+'</div></div>';
  summaryHtml+='<div class="field"><div class="field-label">Created</div><div class="field-value">'+esc(MANIFEST.created_at||'')+'</div></div>';
  summaryHtml+='<div class="field"><div class="field-label">Profile</div><div class="field-value">'+esc((PROFILE.name||PROFILE.profile_id||'')+' v'+(PROFILE.profile_version||''))+'</div></div>';
  summaryHtml+='<div class="field"><div class="field-label">Evidence Hash</div><div class="field-value mono">'+esc(MANIFEST.packet_hash||'')+'</div></div>';
  summaryHtml+='<div class="null-fields"><strong>Draft — internal only. Not a Submission.</strong><br>Reserved fields: <code>submission_id</code> <code>sct</code> <code>acceptance_receipt</code> <code>recipient_binding</code> — all <code>null</code>.</div>';
  summaryHtml+='<div class="one-liner">PX verified exported evidence against declared rules. Same input produces the same result.</div>';
  summaryHtml+='<div style="margin-top:8px;font-size:13px;color:var(--muted)">Independent replay available. See Replay tab.</div>';
  summaryHtml+='<div class="replay-indicator" id="recompute-summary"></div>';
  document.getElementById('summary').innerHTML=summaryHtml;

  // ── Controls ──
  var ctrlHtml='<div class="print-header" style="display:none">PX Lens — Controls | '+esc(seal)+'</div>';
  ctrlHtml+='<div class="field"><div class="field-label">Profile</div><div class="field-value">'+esc((PROFILE.name||PROFILE.profile_id||'')+' v'+(PROFILE.profile_version||''))+'</div></div>';
  if(PROFILE.source_type)ctrlHtml+='<div class="field"><div class="field-label">Source Type</div><div class="field-value">'+esc(PROFILE.source_type)+'</div></div>';
  ctrlHtml+='<table><thead><tr><th>#</th><th>Rule ID</th><th>Description</th><th>Result</th></tr></thead><tbody>';
  for(var i=0;i<STORED_RESULTS.length;i++){
    var r=STORED_RESULTS[i];
    ctrlHtml+='<tr><td>'+(i+1)+'</td><td style="font-family:var(--mono);font-size:13px">'+esc(r.id)+'</td><td>'+esc(r.description||'')+'</td>';
    if(r.pass){ctrlHtml+='<td class="pass-cell">PASS</td>';}
    else{ctrlHtml+='<td class="fail-cell">FAIL<br><span class="fail-detail">'+esc(r.reason||'')+'</span></td>';}
    ctrlHtml+='</tr>';
  }
  ctrlHtml+='</tbody></table>';
  ctrlHtml+='<div class="scope-note">This verification covers exported state only. It does not represent live system status.<br>Same input, same result. This verification can be independently reproduced.</div>';
  document.getElementById('controls').innerHTML=ctrlHtml;

  // ── Replay ──
  var replayHtml='<div class="print-header" style="display:none">PX Lens — Replay | '+esc(seal)+'</div>';
  var now=new Date();
  var ts=function(){return'['+now.toTimeString().slice(0,8)+'.'+String(now.getMilliseconds()).padStart(3,'0')+']';};
  var traceLines=[];
  traceLines.push('<span class="ts">'+ts()+'</span> <span class="label">Loading profile:</span> '+esc((PROFILE.name||PROFILE.profile_id)+' v'+(PROFILE.profile_version||''))+' ('+PROFILE.rules.length+' rules)');
  traceLines.push('<span class="ts">'+ts()+'</span> <span class="label">Loading evidence:</span> '+STORED_RESULTS.length+' fields');
  for(var i=0;i<STORED_RESULTS.length;i++){
    var r=STORED_RESULTS[i];
    traceLines.push('<span class="ts">'+ts()+'</span> Rule '+(i+1)+'/'+STORED_RESULTS.length+': <span class="label">'+esc(r.id)+'</span>');
    traceLines.push('               Path: '+esc(r.path)+' \\u2192 '+esc(JSON.stringify(r.got)));
    traceLines.push('               Expected: '+esc(JSON.stringify(r.expected))+' — '+(r.pass?'<span class="pass">PASS</span>':'<span class="fail">FAIL</span> '+esc(r.reason||'')));
  }
  traceLines.push('<span class="ts">'+ts()+'</span> <span class="label">Verification complete:</span> '+passCount+'/'+totalCount+(allPass?' <span class="pass">ALL PASS</span>':' <span class="fail">FAILED</span>'));
  traceLines.push('<span class="ts">'+ts()+'</span> <span class="label">Packet hash:</span> <span class="dim">'+esc(MANIFEST.packet_hash||'')+'</span>');
  replayHtml+='<div class="trace">'+traceLines.join('\\n')+'</div>';
  replayHtml+='<div style="margin-top:16px"><div class="field-label">Bundled Files</div><div class="field-value" style="font-size:13px">draft-manifest.json, bundled-profile.json, bundled-evidence.json</div></div>';
  replayHtml+='<div style="margin-top:12px"><div class="field-label">CLI Replay Command</div><div class="cli-cmd">node cli.js verify --manifest=draft-manifest.json</div></div>';
  replayHtml+='<div class="replay-indicator" id="recompute-replay"></div>';
  replayHtml+='<div class="no-trust">No trust required. The verification was re-executed in your browser and matches the stored results. For full independent verification, run the CLI command above with the bundled files.</div>';
  document.getElementById('replay').innerHTML=replayHtml;

  // ── Browser recompute ──
  setTimeout(function(){
    var recomputed=runVerify(PROFILE,EVIDENCE);
    var match=true;
    if(recomputed.length!==STORED_RESULTS.length){match=false;}
    else{for(var i=0;i<recomputed.length;i++){if(recomputed[i].pass!==STORED_RESULTS[i].pass){match=false;break;}}}
    var els=document.querySelectorAll('.replay-indicator');
    for(var j=0;j<els.length;j++){
      if(match){els[j].className='replay-indicator ok';els[j].innerHTML='\\u2713 Replay verified — stored results match browser recompute';}
      else{els[j].className='replay-indicator warn';els[j].innerHTML='\\u26A0 Recompute mismatch — stored results may have been altered';}
    }
    // Update no-trust note if mismatch
    if(!match){var nt=document.querySelector('.no-trust');if(nt)nt.innerHTML='<strong>\\u26A0 Warning:</strong> Browser recompute produced different results from the stored values. The stored results in this file may have been altered after generation.';}
  },50);

  // ── Tab switching ──
  var tabs=document.querySelectorAll('nav button');
  for(var i=0;i<tabs.length;i++){
    tabs[i].addEventListener('click',function(){
      for(var j=0;j<tabs.length;j++){tabs[j].classList.remove('active');}
      this.classList.add('active');
      var sections=document.querySelectorAll('main section');
      for(var j=0;j<sections.length;j++){sections[j].classList.remove('active');}
      document.getElementById(this.getAttribute('data-tab')).classList.add('active');
    });
  }
});
</script>
</body>
</html>`;

function generateLensHtml(manifest, evidenceData, profileData, verifyResults) {
  return LENS_TEMPLATE
    .replace('/*__MANIFEST__*/null', JSON.stringify(manifest))
    .replace('/*__EVIDENCE__*/null', JSON.stringify(evidenceData))
    .replace('/*__PROFILE__*/null', JSON.stringify(profileData))
    .replace('/*__RESULTS__*/null', JSON.stringify(verifyResults));
}

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

  // ── Manifest replay mode: --manifest ──
  if (flags.manifest) {
    heading('Replaying verification from manifest...');

    const manifestPath = path.resolve(process.cwd(), flags.manifest);
    if (!fileExists(manifestPath)) {
      fail(`Manifest not found: ${flags.manifest}`);
      log();
      process.exit(1);
    }

    let manifestData;
    try {
      manifestData = readJSON(manifestPath);
    } catch (e) {
      fail(`Manifest is not valid JSON: ${flags.manifest}`);
      info(e.message);
      log();
      process.exit(1);
    }

    const manifestDir = path.dirname(manifestPath);

    // Resolve bundled files
    const bundledProfileName = manifestData.bundled_profile || 'bundled-profile.json';
    const bundledEvidenceName = manifestData.bundled_evidence || 'bundled-evidence.json';
    const bundledProfilePath = path.join(manifestDir, bundledProfileName);
    const bundledEvidencePath = path.join(manifestDir, bundledEvidenceName);

    if (!fileExists(bundledProfilePath)) {
      fail(`Bundled profile not found: ${bundledProfileName}`);
      info(`Expected at: ${path.relative(process.cwd(), bundledProfilePath)}`);
      log();
      process.exit(1);
    }
    if (!fileExists(bundledEvidencePath)) {
      fail(`Bundled evidence not found: ${bundledEvidenceName}`);
      info(`Expected at: ${path.relative(process.cwd(), bundledEvidencePath)}`);
      log();
      process.exit(1);
    }

    const bundledProfile = readJSON(bundledProfilePath);
    const bundledEvidence = readJSON(bundledEvidencePath);

    const mode = manifestData.verification_mode || (bundledProfile.mode === 'workspace' ? 'workspace' : 'custom');

    let replayAllPass;

    if (mode === 'workspace') {
      // Workspace replay: re-verify each evidence against its matching profile
      const profiles = bundledProfile.profiles || [];
      const evidenceList = bundledEvidence.evidence || [];
      const profileMap = {};
      for (const p of profiles) profileMap[p.profile_id] = p;

      let totalPassed = 0;
      let totalFailed = 0;
      let totalFields = 0;

      for (const ev of evidenceList) {
        const profile = profileMap[ev.profile_ref];
        if (!profile) {
          warn(`No profile found for ${ev.profile_ref} — skipping`);
          continue;
        }
        const result = verifyEvidence(ev, profile);
        const displayName = profile.profile_id.replace('soc2-', '').replace('px-', '');
        const padded = displayName.padEnd(22);

        if (result.failed === 0) {
          log(`  ${CLR.green}✓${CLR.reset} ${padded} ${CLR.green}PASS${CLR.reset}  ${dimText(`(${result.passed}/${result.total} fields)`)}`);
        } else {
          log(`  ${CLR.red}✗${CLR.reset} ${padded} ${CLR.red}FAIL${CLR.reset}  ${dimText(`(${result.passed}/${result.total} fields)`)}`);
          for (const r of result.results) {
            if (!r.pass) {
              log(`    ${CLR.red}→${CLR.reset} ${CLR.dim}${r.field}${CLR.reset}: ${r.reason}`);
            }
          }
        }

        totalPassed += result.passed;
        totalFailed += result.failed;
        totalFields += result.total;
      }

      replayAllPass = totalFailed === 0;
      log();
      if (replayAllPass) {
        log(`  ${CLR.bold}${CLR.green}■ REPLAY PASS${CLR.reset} — ${totalPassed}/${totalFields} fields verified`);
      } else {
        log(`  ${CLR.bold}${CLR.red}■ REPLAY FAILED${CLR.reset} — ${totalPassed}/${totalFields} fields, ${totalFailed} failed`);
      }
    } else {
      // Custom profile replay
      const result = runCustomVerify(bundledProfile, bundledEvidence);
      replayAllPass = printCustomVerifyResults(result, bundledProfile);
    }

    // Check consistency with manifest claim
    const manifestClaim = manifestData.evidence_summary && manifestData.evidence_summary.all_pass;

    log();
    if (replayAllPass && manifestClaim) {
      log(`  ${CLR.bold}${CLR.green}Replay matches manifest: ALL PASS${CLR.reset}`);
    } else if (!replayAllPass && !manifestClaim) {
      log(`  ${CLR.bold}${CLR.yellow}Replay matches manifest: FAILED${CLR.reset}`);
    } else {
      log(`  ${CLR.bold}${CLR.red}Replay DOES NOT match manifest claim${CLR.reset}`);
    }

    if (manifestData.intended_recipient) {
      info(`Intended recipient: ${manifestData.intended_recipient}`);
    }
    if (manifestData.stated_purpose) {
      info(`Stated purpose: ${manifestData.stated_purpose}`);
    }
    log();
    process.exit(replayAllPass ? 0 : 1);
  }

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

    let profileData, evidenceData;
    try {
      profileData = readJSON(profilePath);
    } catch (e) {
      fail(`Profile is not valid JSON: ${flags.profile}`);
      info(e.message);
      log();
      process.exit(1);
    }
    try {
      evidenceData = readJSON(evidencePath);
    } catch (e) {
      fail(`Evidence is not valid JSON: ${flags.evidence}`);
      info(e.message);
      log();
      process.exit(1);
    }

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

    let profileData, evidenceData;
    try {
      profileData = readJSON(profilePath);
    } catch (e) {
      fail(`Profile is not valid JSON: ${flags.profile}`);
      info(e.message);
      log();
      process.exit(1);
    }
    try {
      evidenceData = readJSON(evidencePath);
    } catch (e) {
      fail(`Evidence is not valid JSON: ${flags.evidence}`);
      info(e.message);
      log();
      process.exit(1);
    }

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

    // Build per-rule results for lens embedding
    const lensResults = result.results.map(r => {
      const rule = profileData.rules.find(rl => rl.id === r.id);
      return {
        id: r.id,
        description: r.description || '',
        pass: r.pass,
        reason: r.reason || 'ok',
        path: r.path,
        expected: rule ? rule.expected : null,
        got: r.value,
      };
    });

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

    const seal = generateSeal(evidenceHash, now.toISOString(), true, result.total);

    const manifest = {
      manifest_type: 'DRAFT_MANIFEST',
      manifest_ref: manifestRef,
      packet_ref: packetId,
      seal: seal,
      created_at: now.toISOString(),
      generator: `px-cli/${VERSION}`,
      project: profileData.profile_id,
      framework: 'CUSTOM_PROFILE',
      verification_mode: 'custom',
      evidence_summary: {
        total: evidenceRefs.length,
        passed: evidenceRefs.length,
        failed: 0,
        all_pass: true,
        profiles: evidenceRefs.map(e => ({
          profile_ref: e.profile_ref,
          evidence_class: e.evidence_class,
          fields_checked: e.fields_checked,
          fields_passed: e.fields_passed,
          conformance: 'PASS',
        })),
      },
      packet_hash: packetHash,
      intended_recipient: flags.recipient || null,
      stated_purpose: flags.purpose || null,
      bundled_profile: 'bundled-profile.json',
      bundled_evidence: 'bundled-evidence.json',
      submission_state: 'NOT_SUBMITTED',
      submission_id: null,
      sct: null,
      acceptance_receipt: null,
      recipient_binding: null,
      parent_manifest_refs: [],
      clearing_batch_ref: null,
    };

    // Write to px/output/
    const outputDir = pxPath(OUTPUT_DIR);
    ensureDir(outputDir);

    writeJSON(path.join(outputDir, 'draft-manifest.json'), manifest);
    success(`Created ${relativePx(OUTPUT_DIR, 'draft-manifest.json')}`);

    writeJSON(path.join(outputDir, 'draft-packet.json'), packet);
    success(`Created ${relativePx(OUTPUT_DIR, 'draft-packet.json')}`);

    // Bundle exact inputs for recipient replay
    writeJSON(path.join(outputDir, 'bundled-profile.json'), profileData);
    success(`Created ${relativePx(OUTPUT_DIR, 'bundled-profile.json')}`);

    writeJSON(path.join(outputDir, 'bundled-evidence.json'), evidenceData);
    success(`Created ${relativePx(OUTPUT_DIR, 'bundled-evidence.json')}`);

    // Generate self-contained lens.html
    const lensHtml = generateLensHtml(manifest, evidenceData, profileData, lensResults);
    fs.writeFileSync(path.join(outputDir, 'lens.html'), lensHtml, 'utf8');
    success(`Created ${relativePx(OUTPUT_DIR, 'lens.html')}`);

    log();
    info(`Packet ID:  ${packetId}`);
    info(`Seal:       ${seal}`);
    info(`Evidence:   ${result.total} rules, all verified`);
    info(`Hash:       ${packetHash.slice(0, 20)}...`);
    if (flags.recipient) info(`Recipient:  ${flags.recipient}`);
    if (flags.purpose) info(`Purpose:    ${flags.purpose}`);
    log();
    log(`  ${CLR.bold}${CLR.green}Your proof is ready for internal review.${CLR.reset}`);
    log(`  ${CLR.dim}Open lens.html in a browser to see your verification report.${CLR.reset}`);
    log();
    log(`  ${CLR.dim}Recipient can replay:${CLR.reset}`);
    log(`  ${CLR.cyan}node cli.js verify --manifest=${relativePx(OUTPUT_DIR, 'draft-manifest.json')}${CLR.reset}`);
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
    verification_mode: 'workspace',
    evidence_summary: {
      total: evidenceRefs.length,
      passed: evidenceRefs.length,
      failed: 0,
      all_pass: true,
      profiles: evidenceRefs.map(e => ({
        profile_ref: e.profile_ref,
        evidence_class: e.evidence_class,
        fields_checked: e.fields_checked,
        fields_passed: e.fields_passed,
        conformance: 'PASS',
      })),
    },
    packet_hash: packetHash,
    intended_recipient: flags.recipient || null,
    stated_purpose: flags.purpose || null,
    bundled_profile: 'bundled-profile.json',
    bundled_evidence: 'bundled-evidence.json',

    // ═══════════════════════════════════════════════════════
    // THE BOUNDARY.
    //
    // These four fields are null in every Draft.
    // They are populated only in a Submission.
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

  // ── Bundle replay inputs ──
  // Collect all profiles and evidence for recipient replay
  const allProfileFiles = fs.readdirSync(pxPath(PROFILES_DIR)).filter(f => f.endsWith('.json'));
  const allProfiles = allProfileFiles.map(pf => readJSON(pxPath(PROFILES_DIR, pf)));
  const allEvidence = evidenceFiles.map(ef => readJSON(pxPath(EVIDENCE_DIR, ef)));

  writeJSON(pxPath(OUTPUT_DIR, 'bundled-profile.json'), {
    mode: 'workspace',
    profiles: allProfiles,
  });
  success(`Created ${relativePx(OUTPUT_DIR, 'bundled-profile.json')}`);

  writeJSON(pxPath(OUTPUT_DIR, 'bundled-evidence.json'), {
    mode: 'workspace',
    evidence: allEvidence,
  });
  success(`Created ${relativePx(OUTPUT_DIR, 'bundled-evidence.json')}`);

  // ── Summary ──
  log();
  log(`  ${CLR.bold}Draft Packet created.${CLR.reset}`);
  log();
  info(`Packet ID:  ${packetId}`);
  info(`Evidence:   ${evidenceRefs.length} files, all verified`);
  info(`Fields:     ${evidenceRefs.reduce((a, e) => a + e.fields_checked, 0)} checked, all passed`);
  info(`Hash:       ${packetHash.slice(0, 20)}...`);
  if (flags.recipient) info(`Recipient:  ${flags.recipient}`);
  if (flags.purpose) info(`Purpose:    ${flags.purpose}`);
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

// ── px check ─────────────────────────────

function cmdCheck(args) {
  const separatorIndex = args.indexOf('--');
  const flagArgs = separatorIndex >= 0 ? args.slice(0, separatorIndex) : args;
  const collectorArgs = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];

  const flags = parseFlags(flagArgs);

  if (!flags.profile) {
    fail('Usage: px check --profile=<profile-file> [-- collector args]');
    log();
    process.exit(1);
  }

  const profilePath = path.resolve(process.cwd(), flags.profile);
  if (!fileExists(profilePath)) {
    fail(`Profile not found: ${flags.profile}`);
    log();
    process.exit(1);
  }

  let profileData;
  try {
    profileData = readJSON(profilePath);
  } catch (e) {
    fail(`Profile is not valid JSON: ${flags.profile}`);
    info(e.message);
    log();
    process.exit(1);
  }

  const sourceType = profileData.source_type;
  if (!sourceType) {
    fail('Profile has no source_type field. Use verify --profile --evidence instead.');
    log();
    process.exit(1);
  }

  const collectorPath = path.resolve(process.cwd(), 'collectors', `${sourceType}.sh`);
  if (!fileExists(collectorPath)) {
    fail(`Collector not found: collectors/${sourceType}.sh`);
    info('Fallback:');
    info(`  node cli.js verify --profile=${flags.profile} --evidence=<your-evidence.json>`);
    log();
    process.exit(1);
  }

  heading('Collecting evidence...');
  info(`Running collectors/${sourceType}.sh`);

  let collectorOutput;
  try {
    const { execFileSync } = require('child_process');
    collectorOutput = execFileSync('bash', [collectorPath, ...collectorArgs], {
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (e) {
    fail(`Collector failed: ${e.message}`);
    info('Fallback:');
    info(`  node cli.js verify --profile=${flags.profile} --evidence=<your-evidence.json>`);
    log();
    process.exit(1);
  }

  let evidenceData;
  try {
    evidenceData = JSON.parse(collectorOutput);
  } catch (e) {
    fail('Collector output is not valid JSON.');
    info(e.message);
    log();
    process.exit(1);
  }

  const evidenceDir = path.join(process.cwd(), '.px', 'evidence');
  if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:]/g, '-');
  const evidenceFile = path.join(evidenceDir, `${sourceType}-${stamp}.json`);
  fs.writeFileSync(evidenceFile, JSON.stringify(evidenceData, null, 2));

  success(`Evidence saved: ${path.relative(process.cwd(), evidenceFile)}`);

  const result = runCustomVerify(profileData, evidenceData);
  const allPass = printCustomVerifyResults(result, profileData);

  log();
  if (allPass) {
    info('To pack:');
    info(`  node cli.js pack --profile=${flags.profile} --evidence=${path.relative(process.cwd(), evidenceFile)}`);
    log();
    process.exit(0);
  } else {
    info('Pack not generated.');
    log();
    process.exit(1);
  }
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
  log(`    verify --manifest=<file>                    Replay verification from a packed Draft`);
  log(`    pack   --profile=<file> --evidence=<file>   Pack after custom verification`);
  log(`    pack   --recipient=<val> --purpose=<val>    Add metadata to Draft manifest (optional)`);
  log(`    check  --profile=<file>                     Collect evidence + verify in one step`);
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
  'check':    cmdCheck,
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
