/* PX Site — Script v9
   Nav, reveal, FAQ, copy, demo
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
      var codeEl = el.querySelector('code');
      var text = codeEl ? codeEl.textContent : el.textContent;
      text = text.replace(/^\$\s*/, '').trim();
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
     Demo — button-triggered verification
     ════════════════════════════════════ */
  var demoFiles = document.getElementById('demo-files');
  var demoRunBtn = document.getElementById('demo-run');
  var demoVerify = document.getElementById('demo-verify');
  var demoResult = document.getElementById('demo-result');

  if (demoRunBtn && demoFiles && demoVerify && demoResult) {
    demoRunBtn.addEventListener('click', function () {
      // Hide button and dim files
      demoRunBtn.classList.add('hidden');
      demoFiles.classList.add('dimmed');

      // Show verification panel
      demoVerify.style.display = 'block';

      // Animate checks in sequence
      var checks = demoVerify.querySelectorAll('.demo-check');
      var lastDelay = 0;
      checks.forEach(function (check) {
        var delay = parseInt(check.dataset.delay);
        if (delay > lastDelay) lastDelay = delay;
        setTimeout(function () {
          check.classList.add('visible');
        }, delay);
      });

      // Show result after checks complete
      setTimeout(function () {
        demoVerify.style.display = 'none';
        demoFiles.style.display = 'none';
        demoResult.style.display = 'block';
        demoResult.offsetHeight; // force reflow
        demoResult.classList.add('visible');
      }, lastDelay + 700);
    });
  }

})();
