/**
 * PX Cloud — App Controller
 *
 * 4-screen SPA: Drop → Detect → Structure/Review → Pack
 * Zero dependencies. Browser-only processing.
 */

'use strict';

(function() {

  // ══════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════

  var state = {
    screen: 'drop',        // current screen
    files: [],             // { file: File, name, path, size, type, hash }
    hashed: 0,             // count of files hashed so far
    questionnaire: null,   // parsed questionnaire { headers, rows, cols }
    questions: [],          // { id, text, answer, evidenceRef, candidates[], resolved }
    evidenceFiles: [],     // subset of files that are evidence (non-questionnaire)
    autoResolved: 0,
    needsReview: 0,
    missing: 0,
    reviewIdx: 0,
    manifest: null,
    packBlob: null,
  };

  // ══════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════

  function $(id) { return document.getElementById(id); }
  function esc(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function showToast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    setTimeout(function() { t.classList.remove('show'); }, 2200);
  }

  // ══════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════

  var SCREENS = ['drop', 'detect', 'structure', 'pack', 'send'];

  function goTo(name) {
    state.screen = name;
    for (var i = 0; i < SCREENS.length; i++) {
      var el = $('screen-' + SCREENS[i]);
      el.classList.toggle('active', SCREENS[i] === name);

      // Step indicator
      var num = $('sn-' + (i+1));
      var txt = $('st-' + (i+1));
      var idx = SCREENS.indexOf(name);
      num.className = 'step__num' + (i < idx ? ' step__num--done' : i === idx ? ' step__num--active' : '');
      num.textContent = i < idx ? '\u2713' : String(i+1);
      txt.className = 'step__text' + (i === idx ? ' step__text--active' : '');
      if (i < 3) {
        var line = $('sl-' + (i+1));
        line.className = 'step__line' + (i < idx ? ' step__line--done' : '');
      }
    }
  }

  // ══════════════════════════════════════════
  // SCREEN 1: DROP INBOX
  // ══════════════════════════════════════════

  var dropZone = $('drop-zone');
  var fileInput = $('file-input');

  // Prevent default drag behaviors on entire page
  ['dragenter','dragover','dragleave','drop'].forEach(function(evt) {
    document.addEventListener(evt, function(e) { e.preventDefault(); e.stopPropagation(); });
  });

  dropZone.addEventListener('dragenter', function() { dropZone.classList.add('drop--over'); });
  dropZone.addEventListener('dragover', function() { dropZone.classList.add('drop--over'); });
  dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('drop--over'); });
  dropZone.addEventListener('drop', function(e) {
    dropZone.classList.remove('drop--over');
    handleDrop(e.dataTransfer);
  });

  dropZone.addEventListener('click', function(e) {
    if (e.target.closest('#btn-browse') || e.target.closest('#btn-browse-folder')) return;
    fileInput.click();
  });
  $('btn-browse').addEventListener('click', function(e) {
    e.stopPropagation();
    fileInput.removeAttribute('webkitdirectory');
    fileInput.click();
  });
  // Folder browse button
  var folderBtn = document.createElement('button');
  folderBtn.className = 'drop__btn';
  folderBtn.id = 'btn-browse-folder';
  folderBtn.textContent = 'Choose folder';
  folderBtn.style.marginLeft = '8px';
  folderBtn.style.background = 'transparent';
  folderBtn.style.color = 'var(--ink)';
  folderBtn.style.border = '1px solid var(--border)';
  $('btn-browse').parentNode.insertBefore(folderBtn, $('btn-browse').nextSibling);
  folderBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    fileInput.setAttribute('webkitdirectory', '');
    fileInput.click();
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files.length > 0) {
      var files = Array.from(fileInput.files);
      // Attach webkitRelativePath as _path for folder uploads
      files.forEach(function(f) {
        if (f.webkitRelativePath) f._path = f.webkitRelativePath;
      });
      processFiles(files);
    }
  });

  // Recursively read directory entries (Promise-based for reliability)
  async function handleDrop(dataTransfer) {
    var items = dataTransfer.items;
    var files = [];

    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      var entries = [];
      for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      files = await readAllEntries(entries, '');
    } else {
      files = Array.from(dataTransfer.files);
    }
    if (files.length === 0) {
      showToast('No files found. Try selecting individual files.');
    }
    processFiles(files);
  }

  async function readAllEntries(entries, pathPrefix) {
    var allFiles = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (entry.isFile) {
        var file = await new Promise(function(resolve, reject) {
          entry.file(resolve, reject);
        });
        file._path = pathPrefix + file.name;
        allFiles.push(file);
      } else if (entry.isDirectory) {
        // readEntries may return results in batches — must loop until empty
        var dirEntries = await readDirectoryEntries(entry);
        var subFiles = await readAllEntries(dirEntries, pathPrefix + entry.name + '/');
        allFiles = allFiles.concat(subFiles);
      }
    }
    return allFiles;
  }

  function readDirectoryEntries(dirEntry) {
    return new Promise(function(resolve) {
      var reader = dirEntry.createReader();
      var accumulated = [];
      (function readBatch() {
        reader.readEntries(function(batch) {
          if (batch.length === 0) {
            resolve(accumulated);
          } else {
            accumulated = accumulated.concat(Array.from(batch));
            readBatch(); // Chrome returns max 100 per call, must keep reading
          }
        }, function() {
          resolve(accumulated); // On error, return what we have
        });
      })();
    });
  }

  function processFiles(rawFiles) {
    // Filter out hidden files and system files
    state.files = rawFiles
      .filter(function(f) {
        var p = f._path || f.webkitRelativePath || f.name;
        // Skip hidden files/dirs, OS junk, and zero-byte files
        if (p.startsWith('.') || p.indexOf('/.') !== -1) return false;
        if (p.indexOf('__MACOSX') !== -1) return false;
        if (f.name === 'Thumbs.db' || f.name === 'desktop.ini' || f.name === '.DS_Store') return false;
        if (f.size === 0) return false;
        return true;
      })
      .map(function(f) {
        return {
          file: f,
          name: f.name,
          path: f._path || f.webkitRelativePath || f.name,
          size: f.size,
          type: PXCore.detectFileType(f.name),
          hash: null,
        };
      });

    if (state.files.length === 0) {
      showToast('No files detected');
      return;
    }

    goTo('detect');
    startDetect();
  }

  // ══════════════════════════════════════════
  // SCREEN 2: DETECT
  // ══════════════════════════════════════════

  async function startDetect() {
    var files = state.files;
    $('detect-title').textContent = 'Detected';
    $('detect-count').textContent = files.length + ' files';

    // Group by type
    renderTypeGroups();

    // Hash files progressively
    state.hashed = 0;
    var fill = $('hash-fill');
    var text = $('hash-text');
    var total = files.length;

    for (var i = 0; i < files.length; i++) {
      try {
        files[i].hash = await PXCore.hashFile(files[i].file);
      } catch(e) {
        files[i].hash = 'error';
      }
      state.hashed = i + 1;
      var pct = Math.round((state.hashed / total) * 100);
      fill.style.width = pct + '%';
      text.textContent = 'Hashing: ' + state.hashed + '/' + total;
    }

    fill.style.width = '100%';
    text.textContent = total + ' files hashed';
    $('hash-progress').style.display = 'none';

    // Enable next button
    $('btn-to-structure').classList.remove('btn--disabled');

    // Re-render with hashes
    renderTypeGroups();
  }

  function renderTypeGroups() {
    var groups = {};
    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      if (!groups[f.type]) groups[f.type] = [];
      groups[f.type].push(f);
    }

    var html = '';
    var typeOrder = ['questionnaire','evidence-structured','evidence-document','evidence-screenshot','config','sbom','archive','binary','document','unknown'];
    for (var t = 0; t < typeOrder.length; t++) {
      var type = typeOrder[t];
      var items = groups[type];
      if (!items) continue;
      var info = PXCore.getTypeLabel(type);
      html += '<div class="type-group">';
      html += '<div class="type-group__head"><span class="type-group__icon">' + info.icon + '</span> ' + esc(info.label) + ' <span class="type-group__count">(' + items.length + ')</span></div>';
      for (var i = 0; i < items.length; i++) {
        var f = items[i];
        html += '<div class="file-row">';
        html += '<span class="file-row__name" title="' + esc(f.path) + '">' + esc(f.path) + '</span>';
        html += '<span class="file-row__size">' + PXCore.formatBytes(f.size) + '</span>';
        if (f.hash && f.hash !== 'error') {
          html += '<span class="file-row__hash" title="' + esc(f.hash) + '">' + esc(f.hash.substring(0, 18)) + '...</span>';
          html += '<span class="file-row__status file-row__status--ok">\u2713</span>';
        } else if (f.hash === 'error') {
          html += '<span class="file-row__status" style="color:var(--fail)">err</span>';
        } else {
          html += '<span class="file-row__status file-row__status--pending">\u2026</span>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    $('type-groups').innerHTML = html;
  }

  // ══════════════════════════════════════════
  // SCREEN 3: STRUCTURE (Author Preview + Review)
  // ══════════════════════════════════════════

  async function startStructure() {
    // Separate questionnaire from evidence
    var questFiles = state.files.filter(function(f) { return f.type === 'questionnaire'; });
    state.evidenceFiles = state.files.filter(function(f) { return f.type !== 'questionnaire'; });

    state.questions = [];
    state.questionnaire = null;

    // Try to parse the first questionnaire (CSV only for MVP)
    if (questFiles.length > 0) {
      var qFile = questFiles[0];
      if (qFile.name.toLowerCase().endsWith('.csv')) {
        try {
          var text = await qFile.file.text();
          var rows = PXCore.parseCSV(text);
          if (rows.length > 1) {
            var cols = PXCore.detectQuestionnaireColumns(rows[0]);
            state.questionnaire = { headers: rows[0], rows: rows.slice(1), cols: cols };

            // Build questions
            for (var i = 0; i < state.questionnaire.rows.length; i++) {
              var row = state.questionnaire.rows[i];
              var qText = cols.question >= 0 ? row[cols.question] : row[0];
              var aText = cols.answer >= 0 ? row[cols.answer] : '';
              var eRef = cols.evidence >= 0 ? row[cols.evidence] : '';
              var qId = cols.id >= 0 ? row[cols.id] : 'Q' + (i+1);

              if (!qText || qText.trim() === '') continue;

              // Match evidence
              var candidates = PXCore.matchEvidence(qText, state.evidenceFiles.map(function(f) { return f; }));

              // Check if evidence reference in questionnaire matches a file
              var directMatch = null;
              if (eRef) {
                for (var j = 0; j < state.evidenceFiles.length; j++) {
                  if (state.evidenceFiles[j].name.toLowerCase() === eRef.toLowerCase() ||
                      state.evidenceFiles[j].path.toLowerCase().indexOf(eRef.toLowerCase()) !== -1) {
                    directMatch = state.evidenceFiles[j];
                    break;
                  }
                }
              }

              state.questions.push({
                id: qId,
                text: qText,
                answer: aText,
                evidenceRef: eRef,
                candidates: candidates,
                resolved: directMatch ? directMatch : (candidates.length === 1 ? candidates[0].file : null),
                autoResolved: directMatch !== null || candidates.length === 1,
              });
            }
          }
        } catch(e) {
          // CSV parse failed, continue without questionnaire
        }
      } else {
        // Non-CSV questionnaire — show message
        showToast('Excel files are not supported yet. Please export to CSV.');
      }
    }

    // If no questionnaire, treat all files as evidence pack (no review needed)
    if (state.questions.length === 0) {
      state.autoResolved = state.evidenceFiles.length;
      state.needsReview = 0;
      state.missing = 0;
    } else {
      state.autoResolved = state.questions.filter(function(q) { return q.autoResolved; }).length;
      state.needsReview = state.questions.filter(function(q) { return !q.autoResolved && q.candidates.length > 0; }).length;
      state.missing = state.questions.filter(function(q) { return !q.autoResolved && q.candidates.length === 0; }).length;
    }

    renderAuthorPreview();
  }

  function renderAuthorPreview() {
    var total = state.questions.length || state.evidenceFiles.length;
    var remaining = state.needsReview + state.missing;

    var countEl = $('preview-count');
    var subEl = $('preview-sub');

    if (remaining === 0) {
      countEl.innerHTML = 'Ready to pack';
      subEl.textContent = total + ' items confirmed';
    } else {
      countEl.innerHTML = '<span>' + remaining + '</span> items need your input';
      subEl.textContent = 'Resolve these before packing';
    }

    // Stat cards
    var cardsHtml = '';
    cardsHtml += '<div class="stat-card stat-card--green"><div class="stat-card__num">' + state.autoResolved + '</div><div class="stat-card__label">Auto-confirmed</div></div>';
    cardsHtml += '<div class="stat-card stat-card--amber"><div class="stat-card__num">' + state.needsReview + '</div><div class="stat-card__label">Needs review</div></div>';
    cardsHtml += '<div class="stat-card stat-card--red"><div class="stat-card__num">' + state.missing + '</div><div class="stat-card__label">Missing</div></div>';
    $('stat-cards').innerHTML = cardsHtml;

    // Show/hide review button
    var startReviewBtn = $('btn-start-review');
    var packBtn = $('btn-pack');

    if (remaining > 0) {
      startReviewBtn.style.display = '';
      packBtn.classList.add('btn--disabled', 'btn--lock');
      packBtn.classList.remove('btn--unlock');
    } else {
      startReviewBtn.style.display = 'none';
      packBtn.classList.remove('btn--disabled', 'btn--lock');
      packBtn.classList.add('btn--unlock');
    }
  }

  // ── Review Queue ──

  function startReview() {
    $('author-preview').style.display = 'none';
    $('review-queue').style.display = 'block';
    $('btn-start-review').style.display = 'none';
    state.reviewIdx = 0;
    showNextReviewCard();
  }

  function getUnresolvedQuestions() {
    return state.questions.filter(function(q) { return !q.resolved; });
  }

  function showNextReviewCard() {
    var unresolved = getUnresolvedQuestions();
    var totalQ = state.questions.length;
    var remaining = unresolved.length;

    $('review-counter').textContent = 'Remaining: ' + remaining + ' / ' + totalQ;

    if (remaining === 0) {
      // All resolved — back to preview
      $('review-queue').style.display = 'none';
      $('author-preview').style.display = 'block';
      state.needsReview = 0;
      state.missing = 0;
      state.autoResolved = state.questions.length;
      renderAuthorPreview();
      showToast('\u2713 All items resolved');
      return;
    }

    var q = unresolved[0];
    var container = $('review-card-container');

    var html = '<div class="review-card" id="current-card">';
    html += '<div class="review-card__q">' + esc(q.id) + ': ' + esc(q.text) + '</div>';

    if (q.candidates.length > 0) {
      for (var i = 0; i < Math.min(q.candidates.length, 3); i++) {
        var c = q.candidates[i];
        var key = i === 0 ? 'Enter' : String(i + 1);
        html += '<div class="review-card__candidate" data-cidx="' + i + '">';
        html += '<div style="flex:1"><div class="review-card__fname">' + esc(c.file.name) + '</div>';
        html += '<div class="review-card__why">Score: ' + c.score + ' &middot; ' + PXCore.formatBytes(c.file.size) + '</div></div>';
        html += '<div class="review-card__kbd">' + key + '</div>';
        html += '</div>';
      }
    } else {
      html += '<div style="padding:16px 0;color:var(--ink45);font-size:13px">No matching evidence found for this question.</div>';
    }

    html += '<div class="review-actions">';
    if (q.candidates.length > 0) {
      html += '<button class="btn btn--pass" data-action="accept-0">Accept best match</button>';
    }
    html += '<button class="btn btn--ghost" data-action="skip">Skip (N/A)</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // Bind candidate clicks
    var candidates = container.querySelectorAll('.review-card__candidate');
    for (var i = 0; i < candidates.length; i++) {
      (function(el, idx) {
        el.addEventListener('click', function() { resolveQuestion(q, idx); });
      })(candidates[i], parseInt(candidates[i].getAttribute('data-cidx')));
    }

    // Bind action buttons
    var actions = container.querySelectorAll('[data-action]');
    for (var i = 0; i < actions.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function() {
          var action = btn.getAttribute('data-action');
          if (action === 'skip') {
            q.resolved = { name: 'N/A', skip: true };
            animateCardOut();
          } else if (action.startsWith('accept-')) {
            resolveQuestion(q, parseInt(action.split('-')[1]));
          }
        });
      })(actions[i]);
    }
  }

  function resolveQuestion(q, candidateIdx) {
    if (q.candidates[candidateIdx]) {
      q.resolved = q.candidates[candidateIdx].file;
    }
    animateCardOut();
  }

  function animateCardOut() {
    var card = $('current-card');
    if (card) {
      card.classList.add('review-card--exit');
      setTimeout(function() { showNextReviewCard(); }, 160);
    } else {
      showNextReviewCard();
    }
  }

  // Keyboard support for Review Queue
  document.addEventListener('keydown', function(e) {
    if (state.screen !== 'structure') return;
    if ($('review-queue').style.display === 'none') return;

    var unresolved = getUnresolvedQuestions();
    if (unresolved.length === 0) return;
    var q = unresolved[0];

    if (e.key === 'Enter') {
      e.preventDefault();
      if (q.candidates.length > 0) resolveQuestion(q, 0);
    } else if (e.key === '2' && q.candidates.length > 1) {
      e.preventDefault();
      resolveQuestion(q, 1);
    } else if (e.key === '3' && q.candidates.length > 2) {
      e.preventDefault();
      resolveQuestion(q, 2);
    } else if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      q.resolved = { name: 'N/A', skip: true };
      animateCardOut();
    }
  });

  // ══════════════════════════════════════════
  // SCREEN 4: PACK
  // ══════════════════════════════════════════

  async function buildPack() {
    goTo('pack');
    $('pack-title').textContent = 'Building pack...';
    $('pack-sub').textContent = 'Generating manifest and Lens...';

    // Build evidence data object — include ALL file contents
    var evidenceData = {};
    var fileList = [];

    for (var i = 0; i < state.files.length; i++) {
      var f = state.files[i];
      fileList.push({
        name: f.path,
        size: f.size,
        type: f.type,
        hash: f.hash,
      });

      var key = f.name.replace(/\.[^.]+$/, '').replace(/[-. ]/g, '_');
      try {
        if (f.name.toLowerCase().endsWith('.json')) {
          var text = await f.file.text();
          evidenceData[key] = JSON.parse(text);
        } else if (f.name.toLowerCase().endsWith('.csv')) {
          var csvText = await f.file.text();
          evidenceData[key] = { _type: 'csv', rows: PXCore.parseCSV(csvText) };
        } else if (/\.(txt|md|yaml|yml|toml|ini|log|xml|html?)$/i.test(f.name)) {
          evidenceData[key] = { _type: 'text', content: await f.file.text() };
        } else if (/\.(png|jpe?g|gif)$/i.test(f.name)) {
          // Base64-encode images (capped at 2MB to avoid huge bundles)
          if (f.size <= 2 * 1024 * 1024) {
            var buf = await f.file.arrayBuffer();
            var bytes = new Uint8Array(buf);
            var binary = '';
            for (var b = 0; b < bytes.length; b++) binary += String.fromCharCode(bytes[b]);
            evidenceData[key] = { _type: 'image', mime: f.file.type, base64: btoa(binary), size: f.size };
          } else {
            evidenceData[key] = { _type: 'image', mime: f.file.type, size: f.size, hash: f.hash, _note: 'too large to embed' };
          }
        } else if (/\.(pdf|docx?|xlsx?|zip|tar|gz|exe|dmg)$/i.test(f.name)) {
          // Binary files — store metadata only
          evidenceData[key] = { _type: 'binary', mime: f.file.type || 'application/octet-stream', size: f.size, hash: f.hash };
        } else {
          // Unknown — try text, fall back to metadata
          try {
            evidenceData[key] = { _type: 'text', content: await f.file.text() };
          } catch(e2) {
            evidenceData[key] = { _type: 'unknown', size: f.size, hash: f.hash };
          }
        }
      } catch(e) {
        evidenceData[key] = { _type: 'error', size: f.size, hash: f.hash };
      }
    }

    // Build profile from questionnaire questions if available
    var profile = {
      profile_id: 'cloud-pack-v1',
      profile_version: '1.0.0',
      name: 'Cloud Pack',
      description: state.files.length + ' files',
      rules: [],
    };

    var results = [];
    if (state.questions.length > 0) {
      for (var i = 0; i < state.questions.length; i++) {
        var q = state.questions[i];
        profile.rules.push({
          id: q.id,
          description: q.text,
          path: q.id,
        });
        results.push({
          id: q.id,
          description: q.text,
          pass: q.resolved !== null,
          reason: q.resolved ? 'matched: ' + (q.resolved.name || 'N/A') : 'no evidence',
          path: q.id,
          expected: 'evidence',
          got: q.resolved ? (q.resolved.name || 'N/A') : null,
        });
      }
    } else {
      // No questionnaire — all files are evidence, all pass
      for (var i = 0; i < state.files.length; i++) {
        var f = state.files[i];
        results.push({
          id: f.path,
          description: PXCore.getTypeLabel(f.type).label + ': ' + f.name,
          pass: f.hash !== 'error',
          reason: f.hash !== 'error' ? 'ok' : 'hash error',
          path: f.path,
          expected: 'present',
          got: f.hash ? f.hash.substring(0, 20) + '...' : null,
        });
      }
    }

    var passCount = results.filter(function(r) { return r.pass; }).length;
    var totalCount = results.length;
    var allPass = passCount === totalCount;

    // Compute packet hash
    var packetContent = JSON.stringify({ files: fileList, results: results });
    var packetHash = await PXCore.hashString(packetContent);

    var now = new Date().toISOString();
    var seal = PXCore.generateSeal(packetHash, now, allPass, totalCount);

    var manifest = PXCore.buildManifest({
      createdAt: now,
      seal: seal,
      project: 'cloud-pack',
      framework: state.questionnaire ? 'QUESTIONNAIRE' : 'GENERIC',
      verificationMode: 'cloud',
      packetHash: packetHash,
      evidenceSummary: {
        total: state.files.length,
        passed: passCount,
        failed: totalCount - passCount,
        all_pass: allPass,
        profiles: [{
          profile_ref: 'cloud-pack-v1',
          evidence_class: 'cloud-evidence',
          fields_checked: totalCount,
          fields_passed: passCount,
          conformance: allPass ? 'PASS' : 'FAIL',
          failures: results.filter(function(r) { return !r.pass; }).map(function(r) {
            return { field: r.id, reason: r.reason };
          }),
        }],
      },
    });

    state.manifest = manifest;

    // Generate Lens HTML
    var lensHtml = '';
    await PXCore.loadLensTemplate();
    lensHtml = PXCore.generateLensHtml(manifest, evidenceData, profile, results);

    // Build downloadable pack (JSON bundle — no zip library needed)
    var packBundle = {
      'draft-manifest.json': JSON.stringify(manifest, null, 2),
      'draft-packet.json': JSON.stringify({ files: fileList }, null, 2),
      'bundled-profile.json': JSON.stringify(profile, null, 2),
      'bundled-evidence.json': JSON.stringify(evidenceData, null, 2),
    };
    if (lensHtml) {
      packBundle['lens-v2.html'] = lensHtml;
    }

    // Store for download
    state.packBundle = packBundle;

    // Render results — Lens is the primary artifact
    $('pack-title').textContent = allPass ? 'Pack ready' : 'Pack ready (with issues)';
    $('pack-sub').textContent = seal + ' \u00b7 ' + state.files.length + ' files \u00b7 ' + passCount + '/' + totalCount + ' rules';

    // Show Lens as the primary artifact
    var lensSize = packBundle['lens-v2.html'] ? new Blob([packBundle['lens-v2.html']]).size : 0;
    var mainHtml = '';
    if (lensSize > 0) {
      mainHtml += '<div class="pack-file" style="background:var(--pass-card)"><span class="pack-file__name" style="font-weight:700">lens-v2.html</span><span class="pack-file__size">' + PXCore.formatBytes(lensSize) + '</span></div>';
    }
    $('pack-files').innerHTML = mainHtml;

    // Render record files (collapsible details)
    var recordEl = $('record-files');
    if (recordEl) {
      var recHtml = '';
      var recordKeys = Object.keys(packBundle).filter(function(k) { return k !== 'lens-v2.html'; });
      for (var i = 0; i < recordKeys.length; i++) {
        var rk = recordKeys[i];
        var rSize = new Blob([packBundle[rk]]).size;
        recHtml += '<div class="pack-file" style="cursor:pointer" data-record-file="' + esc(rk) + '"><span class="pack-file__name">' + esc(rk) + '</span><span class="pack-file__size">' + PXCore.formatBytes(rSize) + '</span></div>';
      }
      recordEl.innerHTML = recHtml;
      // Bind clicks to download individual record files
      var recRows = recordEl.querySelectorAll('[data-record-file]');
      for (var i = 0; i < recRows.length; i++) {
        (function(row) {
          row.addEventListener('click', function() {
            var fname = row.getAttribute('data-record-file');
            if (state.packBundle[fname]) {
              downloadFile(fname, state.packBundle[fname], 'application/json');
            }
          });
        })(recRows[i]);
      }
    }
  }

  // Primary: download Lens only (self-contained, everything embedded)
  function downloadPack() {
    if (!state.packBundle) return;
    if (state.packBundle['lens-v2.html']) {
      downloadFile('lens-v2.html', state.packBundle['lens-v2.html'], 'text/html');
      showToast('\u2713 Lens downloaded — send this file to the recipient');
    } else {
      // Fallback: download manifest if no Lens
      downloadFile('draft-manifest.json', state.packBundle['draft-manifest.json'], 'application/json');
      showToast('\u2713 Manifest downloaded');
    }
  }

  function downloadFile(name, content, type) {
    var blob = new Blob([content], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ══════════════════════════════════════════
  // EVENT BINDINGS
  // ══════════════════════════════════════════

  $('btn-back-drop').addEventListener('click', function() {
    goTo('drop');
  });

  $('btn-to-structure').addEventListener('click', function() {
    if (this.classList.contains('btn--disabled')) return;
    goTo('structure');
    startStructure();
  });

  $('btn-back-detect').addEventListener('click', function() {
    goTo('detect');
  });

  $('btn-start-review').addEventListener('click', function() {
    startReview();
  });

  $('btn-pack').addEventListener('click', function() {
    if (this.classList.contains('btn--disabled')) return;
    buildPack();
  });

  $('btn-download').addEventListener('click', function() { downloadPack(); });
  $('btn-send-download').addEventListener('click', function() { downloadPack(); });

  // Pack → Send
  $('btn-to-send').addEventListener('click', function() {
    goTo('send');
    // Populate send screen
    var m = state.manifest;
    var totalR = state.packBundle ? Object.keys(state.packBundle).length : 0;
    var qCount = state.questions.length;
    var fCount = state.files.length;
    var failCount = (m && m.evidence_summary) ? m.evidence_summary.failed : 0;
    var summaryText = 'Pack complete';
    if (qCount > 0) summaryText += ' (' + qCount + ' questions / ' + (fCount - 1) + ' evidence';
    else summaryText += ' (' + fCount + ' files';
    if (failCount > 0) summaryText += ' / ' + failCount + ' FAIL';
    summaryText += ')';
    $('send-summary').textContent = summaryText;
    $('send-seal').textContent = m ? m.seal : '';
  });

  // Send email via mailto
  $('btn-send-email').addEventListener('click', function() {
    var email = $('send-email').value.trim();
    if (!email) { showToast('Enter an email address'); $('send-email').focus(); return; }
    var m = state.manifest;
    var project = (m && m.project) || 'Pack';
    var framework = (m && m.framework) || '';
    var subject = encodeURIComponent(project + (framework ? ' ' + framework : '') + ' — verified pack (PX)');
    var body = encodeURIComponent(
      'Please find the verified pack attached.\n\n' +
      'Open the attached lens-v2.html in your browser to review.\n' +
      'No installation needed — it runs entirely offline.\n\n' +
      (m ? 'Seal: ' + m.seal + '\n' : '') +
      'Created: ' + (m ? m.created_at : '') + '\n\n' +
      '— Sent via PX (https://px-registry.org)'
    );
    window.open('mailto:' + encodeURIComponent(email) + '?subject=' + subject + '&body=' + body, '_self');
    showToast('Mail client opened — attach lens-v2.html');
    // Also auto-download the Lens so they have it ready to attach
    downloadPack();
  });

  // Restart (from any screen)
  function resetState() {
    state.files = [];
    state.hashed = 0;
    state.questionnaire = null;
    state.questions = [];
    state.evidenceFiles = [];
    state.autoResolved = 0;
    state.needsReview = 0;
    state.missing = 0;
    state.reviewIdx = 0;
    state.manifest = null;
    state.packBundle = null;
    fileInput.value = '';
    $('hash-progress').style.display = '';
    $('hash-fill').style.width = '0';
    $('btn-to-structure').classList.add('btn--disabled');
    $('review-queue').style.display = 'none';
    $('author-preview').style.display = '';
    goTo('drop');
  }
  $('btn-restart').addEventListener('click', resetState);
  $('btn-send-restart').addEventListener('click', resetState);

  // ══════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════

  // Pre-load lens template
  PXCore.loadLensTemplate();

})();
