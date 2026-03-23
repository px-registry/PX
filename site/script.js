/* PX Site — Script v8
   Nav, reveal, FAQ, copy, interactive demo
   ────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Nav scroll ── */
  var nav = document.getElementById('navbar');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  /* ── Mobile nav ── */
  var ham = document.querySelector('.nav__ham');
  var links = document.querySelector('.nav__links');
  if (ham && links) {
    ham.addEventListener('click', function () {
      links.classList.toggle('open');
      ham.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  /* ── FAQ accordion ── */
  document.querySelectorAll('.faq__q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq__item').forEach(function (i) { i.classList.remove('open'); });
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ── Copy to clipboard ── */
  document.querySelectorAll('.cta-code').forEach(function (el) {
    el.addEventListener('click', function () {
      var text = el.textContent.replace(/^\$\s*/, '').trim();
      navigator.clipboard.writeText(text).then(function () {
        el.classList.add('copied');
        setTimeout(function () { el.classList.remove('copied'); }, 1500);
      });
    });
  });

  /* ── Scroll reveal ── */
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.reveal').forEach(function (el) {
      observer.observe(el);
    });
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('visible');
    });
  }

  /* ════════════════════════════════════
     Interactive Demo — drag & drop → verify → Lens
     ════════════════════════════════════ */
  var demoFiles = document.getElementById('demo-files');
  var demoPack = document.getElementById('demo-pack');
  var packIdle = document.getElementById('pack-idle');
  var packVerify = document.getElementById('pack-verify');
  var demoResult = document.getElementById('demo-result');
  var demoRan = false;

  if (demoFiles && demoPack) {
    // Drag events on individual files
    demoFiles.querySelectorAll('.demo-file').forEach(function (file) {
      file.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', 'px');
        file.classList.add('dragging');
      });
      file.addEventListener('dragend', function () {
        file.classList.remove('dragging');
      });
    });

    // Drop zone
    demoPack.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (!demoRan) demoPack.classList.add('drag-over');
    });
    demoPack.addEventListener('dragleave', function () {
      demoPack.classList.remove('drag-over');
    });
    demoPack.addEventListener('drop', function (e) {
      e.preventDefault();
      demoPack.classList.remove('drag-over');
      if (demoRan) return;
      runDemo();
    });

    // Also allow clicking the drop zone
    demoPack.addEventListener('click', function () {
      if (demoRan) return;
      runDemo();
    });
  }

  function runDemo() {
    demoRan = true;

    // Dim file list
    demoFiles.classList.add('dimmed');

    // Show verification
    packIdle.style.display = 'none';
    packVerify.style.display = 'block';

    var checks = packVerify.querySelectorAll('.demo-check');
    checks.forEach(function (check) {
      setTimeout(function () {
        check.classList.add('visible');
      }, parseInt(check.dataset.delay));
    });

    // After all checks, transition to result
    var lastDelay = 0;
    checks.forEach(function (c) {
      var d = parseInt(c.dataset.delay);
      if (d > lastDelay) lastDelay = d;
    });

    setTimeout(function () {
      // Fade out left + right
      demoFiles.style.display = 'none';
      demoPack.classList.add('hidden');

      // Show result
      demoResult.style.display = 'block';
      // Force reflow then add visible
      demoResult.offsetHeight;
      demoResult.classList.add('visible');
    }, lastDelay + 800);
  }

})();
